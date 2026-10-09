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

- [ ] **5. The expansion animation**
  Becomes usable: Pressing Trace plays the expansion — affected nodes reveal at their settled positions by distance, edges draw themselves in as their targets arrive, the affected cluster lights up, untouched nodes stay dim and still. Roughly 1.5–2 seconds.
  Why now: This is the demo beat the whole video is built around, but it is presentation over a result that is already correct by now. The physics layout explains dependency structure; the staggered reveal explains the blast radius. Animating earlier would mean animating something that still changes.
  PRD ref: `prd.md > The Core Journey` (step 5), `prd.md > Features and Behavior` (Tracing impact), `prd.md > Look and Feel` (Motion is explanation, not ornament)
  Spec ref: `spec.md > Components` (Graph Canvas), `spec.md > Look and Feel` (Motion), `spec.md > Where It Runs and How Someone Tries It` (demo video)
  Build: Stagger node arrival at its settled force-layout position by graph distance — nearest to the change first and fastest, each successive ring following with a short delay. Draw edges in as their target node arrives. Hold untouched nodes dim and static throughout. Keep the total sequence inside 1.5–2 seconds.
  Verify (mechanical): `npm run dev` and replay the trace three times, confirming consistent ordering by distance, no overlap or flicker between arriving nodes, and untouched nodes that do not move. Then record ~10 seconds of screen capture with the devtools console visible and confirm it stays clean throughout.
  Learner check: Watch the expansion a few times. Does it read as "blast radius spreading outward," or does it just look like things moving? Is there anything it does that you would rather it did not do?
  Commit: `Animate blast radius expansion by distance`

- [ ] **6. Paste a PR URL → mismatch check**
  Becomes usable: You paste a public GitHub pull request URL and the tool fetches its changed files and marks them automatically. If the PR names files the chosen folder doesn't have, it says so explicitly, by name, and offers manual marking instead.
  Why now: It adds the second input route and hardens the tool's core honesty claim — a confidently wrong graph would violate the evidence thesis more seriously than any missing feature. It sits after the kernel because the manual route already delivers the full product; this makes it more convenient and more careful.
  PRD ref: `prd.md > The Core Journey` (steps 3-4), `prd.md > Features and Behavior` (Choosing what changed, The mismatch check), `prd.md > States and Boundaries` (Private or unreadable PR, PR files not present in the folder), `prd.md > Open Questions`
  Spec ref: `spec.md > Components` (GitHub PR Lookup, Mismatch Check), `spec.md > External Services and Dependencies` (the failure-mode table)
  Build: Add `src/services/github.ts` — parse owner/repo/number from a pasted URL, call `GET /repos/{owner}/{repo}/pulls/{number}/files`, use only the `filename` field. Handle the four failure modes distinctly per the spec's table: 404 reported honestly as "can't be read" rather than guessed as private or deleted, 403 as a rate limit, a rejected fetch as network unreachable. Add `MismatchNotice.tsx` listing missing files by name, explaining the folder and PR look like different repositories or commits, and always offering manual marking as a way forward.
  Verify (mechanical): `npm test` — URL parsing cases (valid, malformed, missing number). Then in the browser: paste a PR URL against a folder that doesn't contain its files and confirm the mismatch notice names them; paste an unreadable one and confirm the message differs from the missing-file case.
  Learner check: Paste a real public PR URL for a repo you have also picked a folder from. Did it mark the right files? If you deliberately paste one from a different repo, did the mismatch notice tell you clearly what went wrong?
  Commit: `Add GitHub PR lookup and mismatch check`

- [ ] **7. Test skeleton for untested affected files**
  Becomes usable: For an affected file with no coverage, the detail panel shows what a test for it would need to touch — its exported functions, their parameter shapes, and what a test file would need to import.
  Why now: **This was my call in `3-prd`, not yours**, and it is the first candidate for cutting. Isolated at the end so dropping it costs one slice rather than the build. If it proves expensive when we get here, cutting it is a valid outcome and the coverage lookup alone still produces the "changed and untested" moment the product rests on.
  PRD ref: `prd.md > Features and Behavior` (Test coverage — the skeleton, not the recommendation), `prd.md > Deferred From the POC` (recommending which tests to write), `prd.md > Open Questions` (does the test skeleton survive contact with the build?)
  Spec ref: `spec.md > Components` (Test Skeleton Builder, marked candidate), `spec.md > File Structure` (`src/lib/skeleton.ts`, marked candidate)
  Build: Add `src/lib/skeleton.ts`, deriving exported symbols and parameter shapes from the source structurally. Render it in the Detail Panel beneath the coverage finding for untested affected files only. State plainly that this is the shape of a missing test, not a recommendation about which tests matter.
  Verify (mechanical): `npm test` — skeleton extraction against a fixture with mixed exports and no exports. Then in the browser: click an affected untested file and confirm the panel shows the skeleton, and that a covered file does not show it.
  Learner check: Click an affected file with no tests. Does what it shows tell you anything real about what testing that file would involve — or does it read like filler?
  Commit: `Show test skeleton for untested affected files`

<!-- No target slice count. Each slice leaves the project working and committed, and the
     unique kernel appears early rather than last. -->

## Hands-on Checkpoints

<!-- Plan early feedback where it can shape the remaining build and a final review.
     Add an integrated core-journey checkpoint only if it offers distinct value.
     A single-slice build may cover early feedback and final review in one session;
     record that here rather than inventing separate passes or extra slices.
     At each planned checkpoint, the learner tries the app and gives feedback.
     Check a box only after the learner reports back and issues are resolved. -->

- [ ] Early usable behavior explored — after slice 3, where the two color channels first render together and the blue-against-purple question can be answered by looking
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
- **Clicking a node now inspects it; marking it as changed is a separate button inside the panel.** `prd.md` assigned two meanings to one gesture — step 3 says clicking a file marks it changed, step 6 says clicking a node opens the panel. Those cannot both be true of the same click, and `prd.md > States and Boundaries` requires that a mis-click not commit the user to a trace. Inspecting is read-only and marking is explicit, so a file can be examined without silently rewriting the change being traced. **Learner decision — flag if this contradicts what step 3 was meant to feel like.**
- **The detail panel opens before the trace runs, and says so.** Gating it on a trace existing made inspecting impossible until you had already committed to a change, which defeats the purpose. With no trace the panel reports "mark a change and press Trace impact" rather than calling a file affected or untouched, since neither is knowable yet.
- **Radial layout was built and then removed at the learner's request.** The learner proposed a 3D "ball" with the changed file at the centre (three.js); a 2D ring layout was built instead, since a sphere hides its own far side and occlusion breaks the product's kernel — a node you cannot see is a claim you cannot verify — and a sphere cannot encode direction or depth in a dependency graph. The radial layout worked and its tests passed, but on review the learner decided the extra option was not worth carrying. Removed by deleting the module and its tests and reverting the consumers, rather than rewriting history: the commits remain on record. The two surviving layouts are Columns and Physics.
- The graph now uses `d3-force` with a fixed phyllotaxis seed instead of the layered column layout — learner feedback found the column view too simple; physics keeps connected code clustered, makes cycles visible as nearby pairs, and produces the same settled map on every reload.
