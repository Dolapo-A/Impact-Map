---
doc: checklist
status: approved
---
<!-- `status` is the progress state every skill reads. Write `draft` when you first save this file,
     and change it to `approved` when the learner clearly approves the displayed plan ("looks good" counts).
     Do not request a second sign-off. Never skip the draft save —
     an unsaved draft dies with the conversation. -->

<!-- Progress state for `5-build`. `5-build` reads this file to find the next
     unchecked slice, and rewrites it as it goes — ticking boxes and appending to
     Revisions. Every slice MUST carry the same fields in the same order so parsing
     stays reliable. `Learner check:` gives the learner a plain-language way to
     try the completed behavior in learn mode and at fast-mode checkpoints.
     Keep this checklist in Markdown only, regardless of Review Format.

     Internally, a slice is a thin end-to-end increment that makes a real part of the product
     usable, never a lone layer like "build the data model". Slice 1 includes project
     bootstrapping — scaffold, dependencies, config — as part of delivering its first
     real behavior. -->

# Build Checklist

Build mode: learn

## Slices

- [x] **1. Point it at a folder → the dependency graph appears**
  Becomes usable: You open the page, choose a repository folder, and a graph of files and import edges renders on screen. Bootstrapping is inside this slice, not a step of its own.
  Why now: Every later slice lands on top of this, and it carries the spec's biggest technical risk — the browser/WASM TypeScript grammar. Folding it in means the risk is proven by something you can look at, not by a claim.
  PRD ref: `prd.md > The Core Journey` (steps 1-2), `prd.md > Features and Behavior` (Reading the repository)
  Spec ref: `spec.md > Components` (Folder Picker, Repository Reader, Parser, Graph Builder, Graph Canvas), `spec.md > File Structure`, `spec.md > Look and Feel`
  Build: Scaffold Vite + React + TypeScript per the spec's file structure and install dependencies. Add `src/lib/files.ts`, `resolve.ts`, `parser.ts` (Tree-sitter via the prebuilt `tree-sitter-wasms` grammars, loaded locally — no CDN), and `graph.ts`. Build the bundled `sample-repo/` with the spec's hard requirements: at least one circular import and at least one affected file with no test coverage. Render with React Flow using a deterministic layout. Dark palette from `spec.md > Look and Feel`; nodes start in the neutral untouched state.
  Verify (mechanical): `npm test` — a test that parses a fixture containing a multi-line import and a re-export and asserts both are extracted. Then `npm run dev` and confirm it starts clean, choose the `sample-repo/` folder, and confirm nodes and edges render with no console errors.
  Learner check: Run `npm install && npm run dev`, open the URL, pick the `sample-repo/` folder, and look at the graph. Tell me whether it reads clearly — and whether the layout makes sense to you as a developer.
  Commit: `Scaffold app and render dependency graph from a folder`

- [x] **2. Click files to mark them changed → trace → affected files light up**
  Becomes usable: You click files in the graph to mark them as the change, press Trace, and everything those files can reach is marked as affected while everything else stays dim.
  Why now: This is the unique kernel. A graph is only a picture; a graph that answers "what did I break?" is the product. Coloring comes before animation because the result has to be correct before it's worth polishing.
  PRD ref: `prd.md > The Core Journey` (steps 3, 5), `prd.md > Features and Behavior` (Choosing what changed, Tracing impact), `prd.md > States and Boundaries` (Loaded nothing marked, Change marked before the animation, No impact found)
  Spec ref: `spec.md > Components` (Change Selector, Tracer, Control Strip), `spec.md > Data Model` (TraceResult)
  Build: Add `src/lib/trace.ts` — cycle-safe breadth-first walk, visiting each node at most once, recording distance and the shortest import path. Add the Control Strip with the Trace button; the trace runs only when pressed, never automatically on selection. Apply the fill channel: orange changed, purple affected, grey untouched. Handle the no-impact case with a plain statement rather than an empty graph.
  Verify (mechanical): `npm test` — tracer tests including a circular-import fixture that must terminate, a distance assertion, and a shortest-path assertion. Then in the browser: mark two sample-repo files, trace, and confirm affected nodes turn purple and the console stays clean.
  Learner check: Mark two files and press Trace. Check whether the set of affected files matches what you'd expect by eye — if it highlights something you didn't anticipate, that's the product working; if it misses something you can see, tell me.
  Commit: `Mark changed files and trace blast radius`

- [x] **3. Test coverage as a second visual channel**
  Becomes usable: Every node carries a second signal showing whether tests exercise it, so the state "you changed this and nothing tests it" is readable without clicking anything.
  Why now: It completes the payoff state you designed in `2-scope` — orange core, red ring. The distance channel alone answers "what's affected"; this answers "and what would I not find out until CI."
  PRD ref: `prd.md > The Core Journey` (step 7), `prd.md > Features and Behavior` (Test coverage), `prd.md > Look and Feel`
  Spec ref: `spec.md > Components` (Test Coverage Detector, FileNode), `spec.md > Look and Feel` (the ring treatment)
  Build: Add `src/lib/coverage.ts` — structural detection: a test file covers a source file if it imports it directly or transitively. Render the channel in `FileNode.tsx` as blue (has tests) versus red (no tests), separated from fill by shape and weight rather than hue alone: a visible outline in one case, a filled dot badge in the other. This is also where you judge whether blue reads distinctly against purple.
  Verify (mechanical): `npm test` — coverage tests asserting a directly-imported file is covered, an unimported one is not, and a transitive case resolves. Then in the browser: confirm the sample repo shows at least one orange node with a red ring.
  Learner check: Look at the graph with coverage rings on. Does blue read distinctly against purple, or does it look muddy? Does the ring-vs-badge distinction survive, or does it need a stronger difference?
  Commit: `Show test coverage as a second visual channel`

- [x] **4. Click a node → detail panel beside the graph with the import chain**
  Becomes usable: Clicking any node opens a panel to the right showing the real chain of imports from a changed file to that one, and which test files exercise it. The panel sits beside the graph, never over it.
  Why now: This is the evidence half of "evidence-backed." Up to here the graph asserts impact; this slice lets you verify any claim by reading the chain. It has to come after the tracer, because the chain it shows is exactly what the tracer records.
  PRD ref: `prd.md > The Core Journey` (steps 6, 8), `prd.md > Features and Behavior` (The detail panel), `prd.md > Screens and Layout`
  Spec ref: `spec.md > Components` (Detail Panel), `spec.md > Data Model` (`pathTo`)
  Build: Add `src/components/DetailPanel.tsx`, sliding in from the right. Show the file path, the `pathTo` import chain verbatim, and the covering test files from slice 3. Layout beside the canvas so the clicked file never loses its position relative to the change.
  Verify (mechanical): `npm test` — a trace fixture asserting `pathTo` is the shortest chain. Then in the browser: click an affected node, confirm the panel opens beside the graph without covering it, the chain resolves back to a changed file, and closing it clears the selection.
  Learner check: Click an affected file. Read the import chain it shows you. Is that chain actually correct — does it match what you can find in the sample repo's code by eye?
  Commit: `Add detail panel with import chain and coverage`

- [x] **5. The expansion animation**
  Becomes usable: Pressing Trace plays the expansion — affected nodes reveal at their settled positions by distance, edges draw themselves in as their targets arrive, the affected cluster lights up, untouched nodes stay dim and still. Roughly 1.5–2 seconds.
  Why now: This is the demo beat the whole video is built around, but it is presentation over a result that is already correct by now. The physics layout explains dependency structure; the staggered reveal explains the blast radius. Animating earlier would mean animating something that still changes.
  PRD ref: `prd.md > The Core Journey` (step 5), `prd.md > Features and Behavior` (Tracing impact), `prd.md > Look and Feel` (Motion is explanation, not ornament)
  Spec ref: `spec.md > Components` (Graph Canvas), `spec.md > Look and Feel` (Motion), `spec.md > Where It Runs and How Someone Tries It` (demo video)
  Build: Stagger node arrival at its settled force-layout position by graph distance — nearest to the change first and fastest, each successive ring following with a short delay. Draw edges in as their target node arrives. Hold untouched nodes dim and static throughout. Keep the total sequence inside 1.5–2 seconds.
  Verify (mechanical): `npm run dev` and replay the trace three times, confirming consistent ordering by distance, no overlap or flicker between arriving nodes, and untouched nodes that do not move. Then record ~10 seconds of screen capture with the devtools console visible and confirm it stays clean throughout.
  Learner check: Watch the expansion a few times. Does it read as "blast radius spreading outward," or does it just look like things moving? Is there anything it does that you would rather it did not do?
  Commit: `Animate blast radius expansion by distance`

- [x] **6. Paste a PR URL → mismatch check**
  Becomes usable: You paste a public GitHub pull request URL and the tool fetches its changed files and marks them automatically. If the PR names files the chosen folder doesn't have, it says so explicitly, by name, and offers manual marking instead.
  Why now: It adds the second input route and hardens the tool's core honesty claim — a confidently wrong graph would violate the evidence thesis more seriously than any missing feature. It sits after the kernel because the manual route already delivers the full product; this makes it more convenient and more careful.
  PRD ref: `prd.md > The Core Journey` (steps 3-4), `prd.md > Features and Behavior` (Choosing what changed, The mismatch check), `prd.md > States and Boundaries` (Private or unreadable PR, PR files not present in the folder), `prd.md > Open Questions`
  Spec ref: `spec.md > Components` (GitHub PR Lookup, Mismatch Check), `spec.md > External Services and Dependencies` (the failure-mode table)
  Build: Add `src/services/github.ts` — parse owner/repo/number from a pasted URL, call `GET /repos/{owner}/{repo}/pulls/{number}/files`, use only the `filename` field. Handle the four failure modes distinctly per the spec's table: 404 reported honestly as "can't be read" rather than guessed as private or deleted, 403 as a rate limit, a rejected fetch as network unreachable. Add `MismatchNotice.tsx` listing missing files by name, explaining the folder and PR look like different repositories or commits, and always offering manual marking as a way forward.
  Verify (mechanical): `npm test` — URL parsing cases (valid, malformed, missing number). Then in the browser: paste a PR URL against a folder that doesn't contain its files and confirm the mismatch notice names them; paste an unreadable one and confirm the message differs from the missing-file case.
  Learner check: Paste a real public PR URL for a repo you have also picked a folder from. Did it mark the right files? If you deliberately paste one from a different repo, did the mismatch notice tell you clearly what went wrong?
  Commit: `Add GitHub PR lookup and mismatch check`

<!-- Slice 7 (test skeleton) was CUT before implementation, on the learner's
     decision. It never existed as code, so nothing was removed. The reason and
     the reasoning are recorded under ## Revisions rather than by leaving a
     half-remembered entry here. -->

<!-- No target slice count. Each slice leaves the project working and committed, and the
     unique kernel appears early rather than last. -->

- **Pre-ship review found and fixed three things.** (1) The tracer — the kernel — had only two tests; it now has seventeen, covering deep chains, the union of blast radii across several changed files, never marking a changed file as affected, degenerate input, and determinism. Writing them immediately caught a fixture written backwards: edges run importer → imported, so the chains had to be reversed. (2) The README described roughly half the product, omitting the tracer, coverage, the animation, and the entire pull request feature; rewritten from the built code. (3) **Two source files contained literal NUL bytes** — `graph.ts` since slice 1, `physics.ts` since it was written — used as dedupe-key separators. They compiled fine, but `file` reported them as binary and `grep` answered "Binary file matches", making them effectively unsearchable for a reviewer. Both now use the `\0` escape, which is the same runtime value in plain ASCII source.
- A false alarm worth recording: the review briefly reported "0 edges in the production build" and went looking for a serious defect. The page state had not settled; a clean rebuild and reload showed 29 edges. The production build was sound throughout, and it had been verified in a browser rather than assumed from the dev server.

## Hands-on Checkpoints

<!-- Plan early feedback where it can shape the remaining build and a final review.
     Add an integrated core-journey checkpoint only if it offers distinct value.
     A single-slice build may cover early feedback and final review in one session;
     record that here rather than inventing separate passes or extra slices.
     At each planned checkpoint, the learner tries the app and gives feedback.
     Check a box only after the learner reports back and issues are resolved. -->

- [x] Early usable behavior explored — after slice 3, where the two color channels first render together and the blue-against-purple question can be answered by looking. *Completed in practice across slices 1–5: the learner inspected the live graph at each stage, answered the blue-vs-purple question (resolved by shape, not hue), chose Physics as the preferred layout, and reported real defects — edge/node mismatch, click semantics, copy grammar, the missing folder button — each fixed and re-verified.*
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

<!-- Add agreed revision tasks as unchecked boxes here. Track findings and verification
     briefly so a fresh session can resume. No changes needed is a valid recorded result.
     Complete the box below only after all agreed revisions are verified, committed,
     retried by the learner, and they explicitly confirm readiness. -->

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

<!-- This heading is retained for routing compatibility. After final revisions,
     both modes get one 3–5 minute learning wrap-up, shorter if practice already happened.
     Guided code route by default for newcomers; a focused alternative for familiar
     plan-first users. Never require both. Record actual evidence, not claimed mastery.
     Keep personal reflection in the ignored profile, not this public record.
     Honor completed older code tours/maps; don't reopen them for new fields. -->

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: [what actually happened; real document/test/code references; unfinished work if interrupted]
Route and stops: [actual paths and symbols; guided stops completed, or reference-only route]
Edit outcome: [tried/kept/reverted/declined/not applicable; verification if changed]
Reflection: [offered/answered/declined/already covered — personal answer belongs only in the ignored profile]
Activity mode: [live app and editor, explicit static fallback, focused alternative, prior practice, or recap]

## Revisions

<!-- Leave this section empty when you write the checklist — no placeholder bullet.
     `5-build` appends a bullet here when implementation contradicts an assumption
     in the plan, in the form:

       - [What changed] — [what the build discovered that made the original plan wrong].

     One bullet per revision, no dates. This is how plan adaptation gets recorded,
     and it replaces any separate log. -->

- Slice 1 loads the Tree-sitter grammars from the local `tree-sitter-wasms` npm package instead of a CDN — the spec's open WASM-grammar risk resolved in the build's favour, with no network dependency added.
- Slice 1 actually uses `@vscode/tree-sitter-wasm`, not `tree-sitter-wasms` — the grammars in `tree-sitter-wasms` are built at an older ABI and `web-tree-sitter@0.27` rejects them on load. `@vscode/tree-sitter-wasm` ships ABI-14 grammars, inside the 13–15 range the 0.27 runtime requires. It also has a separate TSX grammar, so `.tsx` no longer needs to share the TypeScript grammar.
- Layout depth is computed by collapsing strongly-connected components (Tarjan) before taking the longest path, rather than by relaxing depths to a fixed point — relaxation pushed every file in a cycle one level deeper per pass and spread the graph dozens of columns wide.
- **The layered layout was lost during slice 2 and restored from `57a442a`** — slice 2 rewrote `layout.ts` as physics-only and its tests, deleting `computeDepths`, the Tarjan cycle-collapse, and 12 layout tests. The learner identified this as an unintended casualty, not a decision. Recovered intact and split into `layered.ts` and `physics.ts` behind a shared dispatch in `layout.ts`, with both test suites restored as separate files so neither can be silently dropped again.
- **Force-directed layout added, with the layered layout kept behind a user-facing toggle** (learner decision, after seeing the layered output). Physics pulls mutually-importing files together instead of leaving a circular import's edge as an invisible stub, but it removes the distance-from-change geometry the layered view encodes. Neither is strictly better: physics shows dependency structure honestly, layering shows blast radius literally. The toggle defers the choice to evidence rather than picking one up front. Physics is seeded deterministically (fixed phyllotaxis spiral, not `Math.random`) because `spec.md > Data Model` requires the same repository to always produce the same graph.
- **Does blue read distinctly against purple?** Resolved in slice 3: yes, because the channel differs by shape and weight rather than hue. The magenta escape hatch in `prd.md > Open Questions` was not needed.
- Coverage no longer marks a test file as covering itself — a test importing another test now records coverage for the *source* underneath but nothing for the test file, which would otherwise paint every test blue and imply they are protected by themselves. Covered and uncovered are now distinguished by shape (hollow ring vs solid disc) rather than hue alone, and a legend names both channels. A two-colour encoding with no key reads as decoration.
- **Edge draw-in needs a custom edge component, not an edge `style`.** React Flow applies an edge's `style` to the wrapping `<g>`, where `stroke-dashoffset` has no effect, and its built-in `straight` renderer discards `pathOptions.style` entirely — so a class-based animation attached to the edge silently does nothing. `src/components/DrawInEdge.tsx` puts the delay straight onto the `<path>`. Verified in the browser, not just by test.
- **The animation replays on every Trace press.** A CSS animation only re-runs when the element is newly inserted or its animation name changes, so pressing Trace again produced nothing. Fixed with a state counter (a ref mutation would not re-render, so the canvas key would never change) used as the React Flow `key`.
- **The stagger divides a fixed window across however many rings the graph has**, rather than using a flat per-hop delay. A fixed delay put a shallow graph's rings nearly on top of each other — and the sample repository is shallow — which removed the outward spread entirely. A flat *floor* cannot fix it either, because it delays every ring equally; only scaling with depth keeps the rings ordered and spaced. Total duration is asserted to land in the spec's 1.5–2s window at depths 1 through 40.
- Each node departs from the **changed file at the head of its own recorded chain**, not from a centroid, so every flight starts at a real file.
- **The partial-match path is verified live** (learner-built repo): a pull request naming one present file and one absent file reports both, marks nothing, and offers to mark just the file it found.
- **Slice 7 (test skeleton) cut before implementation, on the learner's decision.** The PRD left open "does the test skeleton survive contact with the build?" — the answer is that it never reached the build. It was an agent decision from `3-prd`, not the learner's, and was flagged from the start as the first candidate for cutting. The product is coherent without it: the coverage lookup already produces the "changed and untested" moment the kernel depends on, and the learner's own demo verifies that end to end. No skeleton code was ever written, so nothing was deleted; remaining work is the final review and learning wrap-up. The PRD's open question is resolved there. (learner-built repo): a pull request naming one present file and one absent file reports both, marks nothing, and offers to mark just the file it found. The notice also read "Mark the 1 file that are here"; the verb now agrees with the count, and tests pin both the singular and plural forms. The copy is what a user trusts in this state, so it is covered like behaviour.
- **Verified end-to-end against a real GitHub repository** (learner-built `Sample Repo`, two branches). A merged PR changing `orders.test.ts` marked exactly that one file and auto-traced; an unmerged PR naming a file absent from the folder reported it by name and marked nothing. Both paths that could not be exercised with the bundled sample repo are now proven.
- **Note for anyone re-running that test:** `orders.test copy.ts` counts as a *source* file, not a test, because the test pattern matches `*.test.ts` at the end of the name. So its absence was reported as missing for the ordinary reason — the file was never merged — rather than any special handling of spaces in filenames. The `partial` outcome (a PR that changes one present file and one absent file) is the case not yet exercised live; it is covered by unit tests and reported correctly.
- **`sample-repo/` is now a self-contained project** (learner request). It had no `package.json`, so `npm run dev` inside it walked *up* the tree, found Impact Map's own manifest, and silently started the app. Each project now has its own manifest, and the sample repo also runs: its 12 tests and `tsc --noEmit` both pass. A README explains that the folder exists to be analysed, not run, and records which structures it deliberately contains.
- **Two real bugs inside the sample repo, both surfaced by making it runnable.** `reservations.ts` imported `./cart` when cart lives in `../utils/cart` — a wrong relative path that the tool *cannot* detect, because it reports an unresolvable import as an external npm package and carries on, so the graph would have looked correct while quietly missing a real edge. And `orders.test.ts` mutated a shared `items` array, leaking a second item into the following test. Both now have tests pinning them, including one asserting no relative import is ever classified as external.
- **Stored file paths now drop the picked folder's name** (`src/lib/paths.ts`). The browser reports selected files as `impact-map/src/index.ts` while GitHub reports `src/index.ts`, so the two could never match: every file in a real pull request would be reported missing and nothing would ever auto-mark. Found by reasoning through a planned end-to-end test with a real repository, before running it. The chosen folder is the unit of trust, so its name is never part of a file's identity.
- **Files the tool does not graph are no longer counted as "missing."** A pull request that also touches `package.json` or a README is now a clean match, because those files are out of scope rather than absent. Counting them would have raised a false mismatch on nearly every real pull request. A pull request that changed nothing tracked reports a match with no files, not an alarming mismatch.
- **Lookup failures are named variants, not messages** (`src/services/github.ts`). `unreadable`, `rate-limited`, `network`, `not-a-pr-url` and `unexpected-response` each get different words and a different remedy, and a test asserts no two collapse to the same sentence. A 404 is reported as "can't be read" and never as "private", because GitHub returns one status for private, deleted and wrong and will not say which.
- **A pull request is only auto-marked on a clean match.** A partial match reports what is present and what is missing and marks nothing, because silently marking the files that happen to be present would draw the blast radius of a change the user did not make — and it would look entirely plausible.
- **The PR field is `type="text"`, not `type="url"`.** As a URL input the browser silently blocked submission of anything it did not recognise, with no message and no request made — the form just refused to do anything. The service validates and explains, so the feedback is ours. Found by testing the malformed-URL path in the browser, which the unit tests could not have caught.
- **React Flow's stylesheet was never loading, which is what made edges not follow their nodes** (learner spotted it). The import reached into `node_modules/...`, which bypasses Vite's module pipeline, so the request fell through to the HTML fallback and returned `index.html` with a 200. Without that CSS the edges pane stays 0x0 and the inner `<svg>` falls back to the SVG default 300x150, scaling every edge away from its node. The `dist/style.css` subpath is the only one the package exports for the full sheet, and it must be imported as a module. **Lesson worth carrying: a 200 response is not proof a stylesheet loaded — check the byte count and the rule, not the status code.**
- **Marking several changed files is intentional, and the copy now says so.** The learner asked whether selecting another node should deselect the first. It should not: a real pull request changes more than one file, and the tracer already unions every changed file's importers. The button reads "Add to the files I changed" and the bottom pill shows the running count, so the change set is visible rather than implied. Verified with two marked files tracing to six affected.
- **Controls moved out of the top bar** (learner decision). The folder picker is now centred in the empty canvas — the one call to action, where the graph will appear. Trace impact and the layout toggle moved into a bottom-centre pill, so nothing competes with the graph.
- **Clicking a node now inspects it; marking it as changed is a separate button inside the panel.** `prd.md` assigned two meanings to one gesture — step 3 says clicking a file marks it changed, step 6 says clicking a node opens the panel. Those cannot both be true of the same click, and `prd.md > States and Boundaries` requires that a mis-click not commit the user to a trace. Inspecting is read-only and marking is explicit, so a file can be examined without silently rewriting the change being traced. **Learner decision — flag if this contradicts what step 3 was meant to feel like.**
- **The detail panel opens before the trace runs, and says so.** Gating it on a trace existing made inspecting impossible until you had already committed to a change, which defeats the purpose. With no trace the panel reports "mark a change and press Trace impact" rather than calling a file affected or untouched, since neither is knowable yet.
- **Radial layout was built and then removed at the learner's request.** The learner proposed a 3D "ball" with the changed file at the centre (three.js); a 2D ring layout was built instead, since a sphere hides its own far side and occlusion breaks the product's kernel — a node you cannot see is a claim you cannot verify — and a sphere cannot encode direction or depth in a dependency graph. The radial layout worked and its tests passed, but on review the learner decided the extra option was not worth carrying. Removed by deleting the module and its tests and reverting the consumers, rather than rewriting history: the commits remain on record. The two surviving layouts are Columns and Physics.
- The graph now uses `d3-force` with a fixed phyllotaxis seed instead of the layered column layout — learner feedback found the column view too simple; physics keeps connected code clustered, makes cycles visible as nearby pairs, and produces the same settled map on every reload.
- **A three-dimensional view came back, on the learner's request** (learner decision). The earlier removal of the radial layout left the objection standing — a node behind another is a claim you cannot check — so this is a third view rather than a replacement, and the flat views remain the default. It is built with three.js (`three`, `@react-three/fiber`, `@react-three/drei`) and draws the same graph, the same trace, the same two colour channels and the same import-chain panel; what changes is that the blast radius travels outward in every direction at once instead of across a plane. The layout is a force simulation in three dimensions (`src/lib/spatial.ts`), seeded rather than random so the same repository always produces the same volume, and the files fly out from the change on the same stagger as the flat expansion. What the earlier attempt got right and this one keeps: a view that shows a shape the flat graph cannot is worth having next to the flat graph, not instead of it.
- **The tool now opens on a page that explains it, rather than on an empty canvas** (learner request). `prd.md > States and Boundaries` described the first use as "an empty graph area and one clear prompt to choose a repository folder"; what shipped is a full landing page, because the tool's own graph turns out to be the best explanation of it. The page is not a picture of the product: the graph behind the words is the bundled sample repository running the tool's own tracer over the tool's own import list, and the four crops further down are the real components at their real size. Nothing about a visitor's code is involved in showing them.
- **The theme follows the system, and can be pinned either way.** One narrow exception was made to the "nothing is persisted" promise: the colour theme is remembered, because a theme is a preference and not a record of anyone's code. Nothing else is written down, and `localStorage` still holds nothing about a repository. The palette itself is one set of custom properties, written once with `light-dark()`, so a theme change is a single attribute on the root element rather than a second copy of the stylesheet.
- **Reading a colour out of the stylesheet needs the colour, not the token.** `getComputedStyle` hands back the token stream for a custom property that holds a function, so a palette read that way gave the volume `light-dark(#f4f6f8, #0d1117)` as a colour, and the volume painted white. The variables are now resolved through an element that uses them, which is the only way the browser will turn them into colours. The theme attribute is also applied before the state changes rather than in an effect, because the parts of the app that paint outside CSS read the palette during the redraw.

