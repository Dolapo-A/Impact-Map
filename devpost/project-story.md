# Project story

## What inspired it

I used version control for years without understanding it. The commands were fine. The model wasn't. When a change broke something three files away, I had no way to know beforehand, and the answer usually arrived from CI or from production, both expensive places to learn. I wanted to see the shape of a codebase and a change the way I never managed to see it in git.

The first version of the idea was an AI tool: feed it a change, get an explanation of what might break. Scoping it forced a decision I didn't expect to make. I took the language model out. Dependency tracing is deterministic work, and a model would make it slower, less reproducible, and capable of inventing edges. The only real promise this tool makes is that every line it draws is an import you can open and check. A guessed edge breaks that promise more thoroughly than a missing feature would. So v1 explains things in templates: "imported by three files, two of which have tests." Correct and a bit dull, and I made my peace with that.

## What I learned

I had read plenty of PRDs at work and never written one. Reading hides how many decisions a PRD settles. Writing my first one exposed mine: my scope said the tool would "trace dependencies and explain what might be affected," which sounds like a requirement and is a wish. The PRD is where wishes get interrogated. Asking what the tool does when a pull request names files the chosen folder doesn't contain produced the mismatch check, now the part of the tool I trust most. It fell out of being specific rather than arriving as an idea.

Writing it also taught me to argue with my own document. My scope said the tool runs locally when I meant in a browser, and I caught the contradiction myself later. I proposed pasting a pull request URL and clicking files as if they were alternatives, when they answer different questions: one supplies what changed, the other supplies the code to trace. Both stayed. I framed file selection per file, and the whole-folder version fixed a defect I had only half noticed, because an import pointing at a file the user didn't share is indistinguishable from an import of an npm package. Twice I wrote something consistent and wrong, and twice the only reviewer available was me.

The technical lessons were smaller and sharper. Impact runs against the direction of imports: if `cart.ts` imports `price.ts`, changing `price.ts` affects `cart.ts`. I wrote a test fixture backwards and my own tests caught me, which is the closest thing to a compliment a test suite gives. Circular imports are ordinary, so the layout collapses each cycle with Tarjan's strongly connected components before assigning depth; my first attempt relaxed depths until they settled and smeared one cycle across dozens of columns.

Determinism had to be enforced rather than assumed, because the force layout seeds positions randomly by default and would draw the same repository differently on every load. I replaced the random seed with fixed golden-angle steps,

$$\theta_i = i\,\varphi, \qquad \varphi = 2.399963 \text{ radians},$$

which spreads any number of starting points evenly around the circle without clustering, and wrote tests that fail if one graph ever lays out two ways.

The trace is a breadth-first walk over the reverse edges in $O(V + E)$, and the distance it records obeys

$$\mathrm{dist}(w) = 1 + \min_{w \to u} \mathrm{dist}(u),$$

the minimum taken over the imports $u$ of $w$ that the walk has already reached. Breadth-first order makes the first visit to a file the shortest way to reach it, which is why the chain the detail panel shows is the shortest chain available.

One lesson about tools: verify them. I was told early that the graph library ships a force-directed layout. It doesn't. Nodes sit where you put them unless you add physics yourself, and that claim sat in my spec for a while before I checked it. I now treat any convenient fact about a dependency as unverified until I have run it.

Color taught me the last thing. "How far from my change" and "is this tested" are different kinds of fact and cannot share one fill. Formally, coverage here means

$$\mathrm{covered}(f) \iff \exists\, t \in T:\ f \in \mathrm{reach}(t),$$

where $T$ is the set of test files and $\mathrm{reach}(t)$ is everything $t$ imports, directly or transitively. The two channels also differ in shape, hollow ring versus filled disc, because blue and purple sit close on the spectrum and because about 8 percent of men see red and green poorly. The untested warning is the most useful thing the tool says, so it has to survive color blindness and survive being zoomed out.

## Challenges

The worst bug was invisible by design. Edges stopped touching their nodes, and every check said the stylesheet had loaded, because the request returned HTTP 200. It returned 200 with the wrong content. I had imported the graph library's CSS by reaching into `node_modules`, which skips the bundler's module pipeline, so the dev server fell through to its HTML fallback and served `index.html` as a stylesheet. I found it by looking at byte counts instead of status codes. The status code said success and the body said otherwise.

Several other bugs were the same shape: correct-looking output hiding a wrong fact. Two source files carried literal NUL bytes as string separators, compiled fine, and made grep treat both files as binary so nobody could search them. A test mutated an array shared with the next test and still passed, leaking a cart item into an unrelated total. The bundled sample repository imported `./cart` from a folder where cart lives at `../utils/cart`, and the tool cannot catch that, because an unresolvable relative path reads as an external package and draws a tidy dashed edge. The graph was wrong and nothing flagged it. That went into the README as a limitation rather than being smoothed over.

The mismatch check had its own false alarms. Browsers report selected files with the folder name in front, `sample-repo/src/cart.ts`, while GitHub reports `src/cart.ts`, so a real pull request could never match anything. And because the tool ignores lockfiles and READMEs when graphing, it first reported those as missing, which would have flagged nearly every real pull request. Both fixes came from walking the comparison through by hand before trusting it.

Scope fought back twice, and losing both fights was good for the project. I built a third layout, radial, with changed files at the center, then removed it: two honest answers beat three, and the third existed because I liked the geometry. The test skeleton, a feature showing what a missing test would have to touch, was my idea from the planning phase and nobody's requirement. We cut it before writing it. A proof of concept that finishes is worth more than one that is complete on paper.

## How I built it

In order: scope, PRD, spec, code. The documents argued with each other productively. Answers I wrote in the PRD contradicted promises in the scope, and finding that on paper cost an edit instead of a rewrite. Building came in thin vertical slices, each ending in something runnable and a commit: folder to graph, then marking and tracing, then the coverage channel, then the detail panel, then the animation, then the pull request route. The checklist for those slices is in the repository, ticks and revisions included, a slightly embarrassing and very useful artifact.

The architecture follows one rule: `src/lib/` holds no React runtime imports. Parser, resolver, graph builder, tracer, coverage detector, both layouts, and the animation timing are plain modules that test in Node without a browser. That gives 165 tests in about two seconds, plus 12 more inside the sample repository, which is itself a runnable project. Cheap tests are what let me be wrong this often and still ship.

Parsing uses Tree-sitter compiled to WebAssembly, chosen over regex because regex misses multi-line imports and fails without saying so. The risk I accepted for that choice was real: the obvious package of prebuilt grammars was compiled against an older ABI and the runtime rejected it at load with an opaque error. A different package shipped grammars at ABI 14, inside the 13 to 15 range the runtime accepts, and it includes a separate TSX grammar, which `.tsx` files need because the plain TypeScript grammar reads JSX generics as comparisons. The grammars load from `node_modules` as local assets, so there is no CDN and no network call at parse time.

The expansion animation staggers by ring rather than by a fixed per-hop delay. With $R$ rings in the graph, ring $r$ starts at

$$t_r = \frac{r}{R}\, W, \qquad W = \min\bigl(\max(130\,R,\ 1250),\ 1500\bigr) \text{ ms},$$

and each node travels for 420 ms. That puts the whole sequence between 1.67 and 1.92 seconds, inside the 1.5 to 2 seconds the spec asked for, at any graph depth. A fixed per-hop delay would have collapsed a shallow graph's rings on top of each other, which is exactly what the first version did.

Finally I tested it the way a stranger would. I made a small public repository, opened real pull requests against it, merged one and left one open, and pasted the URLs in: clean match, missing file, partial match, unreadable repository. Then I cloned the project into an empty directory, ran `npm ci` and the build and the tests there, and drove the production bundle in a browser. The dev server hides a class of problems, and so does familiarity.
