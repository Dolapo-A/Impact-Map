## What it does

Impact Map shows the blast radius of a code change. You point it at a folder of JavaScript or TypeScript, it reads the real import statements, and every file your change can reach lights up on a graph.

You say what changed two ways: paste a public GitHub pull request URL and the tool marks its changed files for you, or click files directly in the graph. Then press Trace impact. Files fly outward from the change, ring by ring, and everything the change can reach turns purple while everything else stays dim.

Click any node and a panel opens beside the graph with the actual chain of imports leading back to your change, and which tests cover that file. The chain is shown verbatim, so you can check every link.

Two colour channels carry the meaning. Node fill says how far a file is from your change: orange for changed, purple for affected, grey for untouched. A badge on each node says whether tests cover it: a hollow blue ring for yes, a solid red disc for no. An orange node with a red disc means you changed this and nothing tests it.

The tool refuses to guess. If a pull request names files your folder doesn't have, it lists them by name and marks nothing. If GitHub returns a 404, it says the pull request can't be read, because a private repo, a deleted repo, and a typo all look the same from the outside.

## Accomplishments that we're proud of

The mismatch check. A tool that claims every line it draws is verifiable has to refuse when the evidence doesn't line up. When a pull request disagrees with the folder you picked, Impact Map names the missing files and marks nothing. Marking the files that happen to be present would draw the blast radius of a change you didn't make, and it would look entirely plausible.

The colour encoding survives colour blindness. "How far from my change" and "is this tested" are different kinds of fact, so they can't share one fill. They also differ in shape, a hollow ring versus a filled disc, because blue and purple sit close on the spectrum and because about 8 percent of men see red and green poorly. The untested warning is the most useful thing the tool says, so it has to survive that.

The evidence is checkable. Clicking a node shows the real chain of imports back to your change. The tracer records the shortest chain, and the panel shows it end to end.

It's deterministic. The same repository always produces the same graph. The force layout seeds positions randomly by default, so we replaced the seed with fixed golden-angle steps and wrote tests that fail if one graph ever lays out two ways.

165 tests in about two seconds. The logic lives in modules with no React runtime imports, so it tests in Node without a browser. Cheap tests are what let us be wrong often and still ship.

Verified against real pull requests. We made a small public repository, opened real PRs against it, merged one and left one open, and pasted the URLs in: clean match, missing file, partial match, unreadable repository. Then we cloned the project into an empty directory and ran `npm ci`, the build, and the tests there.

## What's next for Impact Map

LLM-generated explanations. v1 explains things in templates: "imported by three files, two of which have tests." That's correct and dull. The seam is left for a model to say why an area matters, once the deterministic evidence underneath it is trusted.

Reviewer-facing annotations. The same graph serves a reviewer reading someone else's pull request, but the text per node leans toward the author. A reviewer wants to know where to start reading, not what they forgot.

Repository history mining. Churn, hot spots, which files keep changing together. That's a different product with a time dimension, and it needs a full scan of the whole repository.

More languages. Parsing is Tree-sitter, so adding a language is mostly a grammar. Go, Rust, and Python are the next ones.

Multiple change sets. Comparing two changes side by side, so you can see which one reaches further.

Authenticated GitHub. Public repositories only, unauthenticated, 60 requests an hour. A token would unlock private repos and a higher limit, at the cost of a secrets story in a browser.

Deployment. The demo runs locally. A public URL would let people try it without installing Node.
