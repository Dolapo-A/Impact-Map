---
doc: prd
status: approved
---
<!-- `status` is the progress state every skill reads. Write `draft` when you first save this file,
     and change it to `approved` when the learner clearly approves the displayed plan ("looks good" counts).
     Do not request a second sign-off. Never skip the draft save —
     an unsaved draft dies with the conversation. -->

<!-- This is the complete product definition: the scope sketch, filled in. Adapt it
     to the product. Drop any section that doesn't apply, and add sections this product
     needs. Completeness is the standard, not length — a short PRD for a small product
     is correct. Keep it inside the approved POC boundary.

     Keep heading names stable and descriptive: `4-spec` and `5-build` reference
     them by name. -->

# Impact Map — Product Requirements

A browser tool for developers that takes a repository, shows its dependency graph, and maps the potential impact of a code change as an animated, evidence-backed graph.
Source: `scope.md > The Unique Kernel`, `scope.md > The Core Loop`, `scope.md > The POC Boundary`.

## The Core Journey

1. **Someone opens the tool in a browser.** No install, no login, no server to start. They land on a single page and the first thing they see is a prompt to choose a repository folder.
2. **They choose a folder from their machine.** The tool reads the files inside it and builds the repository's dependency graph. Files and edges appear on screen.
3. **They mark what changed**, by either of two routes:
   - Paste a GitHub pull request URL, and the tool looks up that PR's changed files and selects them automatically; or
   - Click files directly in the graph to mark them as the change's starting points.
4. **They get a mismatch check.** If a pasted PR URL refers to files that aren't present in the chosen folder — a different repository, a different commit, or a private PR the tool can't read — the tool says so explicitly, naming the files it couldn't find, rather than silently drawing a confident wrong graph.
5. **The graph animates.** Nodes fly outward from the changed files, edges draw themselves in, and the affected cluster lights up while everything else stays dim. This is the moment the tool exists to produce.
6. **They click any node.** A panel opens to the right showing why that file is affected — the specific chain of imports leading back to a changed file — and whether tests cover it.
7. **They read the coverage channel.** Nodes carry a second visual signal for test coverage, so the state "you changed this and nothing tests it" is visible on the graph without clicking anything.
8. **They are done** when they have seen the blast radius of their change and know which parts of it have no test protection.

Success: they find a file they would not have thought to check.

## Screens and Layout

**One screen.** No navigation, no pages, no routes.

- **The graph** fills the available space and is the visual centre of the product. Nothing competes with it while it is animating.
- **A control strip** along the top holds the folder selection, the optional PR URL input, and the control that starts the analysis. It stays visually subordinate to the graph.
- **A detail panel opens to the right** when a node is clicked. It sits *beside* the graph, never over it — the graph keeps its space and stays visible, so the clicked file never loses its position relative to the change. The panel closes without navigating away.

## Look and Feel

Carried forward from `scope.md > Inspiration & Identity`.

**Clean, restrained, confident.** One visual idea per screen. No chrome competing with the graph. Dark background so the state colors read clearly.

**Color is reserved for state and never used for decoration.** Two independent channels:

| Channel | Question | Encoding |
| --- | --- | --- |
| Node fill | How far from my change? | orange = changed, purple = affected, grey = untouched |
| Node ring or badge | Is it covered by tests? | blue = has tests, red = no tests |

**The payoff state: an orange core with a red ring** — you changed this and nothing tests it. The most actionable thing the tool can say, readable without clicking.

**Blue, not green, for "has tests."** Green on a purple node is muddy; blue reads cleanly against both orange and purple, and it's the standard developer-tooling convention for "verified." Red stays unambiguous as the only warm color on the coverage channel.

**Accessibility is a requirement.** Blue-vs-red survives red-green color vision deficiency, which affects roughly 8% of men and would otherwise make the "untested" warning invisible. Because blue and purple are close in hue, the ring/badge treatment must distinguish them by more than color alone.

**Motion is explanation, not ornament.** The outward expansion *is* the argument about blast radius. Nodes fly out from the changed files, edges draw themselves in, affected nodes light up, untouched nodes stay dim.

## Features and Behavior

### Reading the repository

The tool reads the folder the user selects and builds a dependency graph of its JavaScript and TypeScript source.

- Files become nodes; imports become edges.
- Generated and build output are excluded — `node_modules`, `dist`, `*.d.ts`, lockfiles. They would add noise, not signal.
- Circular imports are expected and handled, not treated as errors. They are common in real code.

### Choosing what changed

The user marks the change's starting files by one of two routes, and can use either.

- **Paste a GitHub PR URL.** The tool fetches that PR's changed files from GitHub and selects them on the graph.
- **Click files in the graph.** No PR needed. This covers a change that hasn't been pushed yet — which is often exactly when "what did I forget?" is most urgent.

Either route produces the same result: a set of starting files to trace outward from.

### The mismatch check

When a PR URL and a chosen folder disagree, the tool refuses to proceed silently.

This is a hard requirement, not polish. The tool's claim is that every claim it makes is verifiable; a confidently-wrong graph would violate that claim more seriously than any missing feature.

- Files named by the PR that aren't present in the folder are listed by name.
- The tool explains that the folder and the PR appear to be different repositories or different commits.
- Private PRs the tool cannot read are reported as such, distinctly from "file not found" — different causes, different remedies.
- The user can then pick a different folder, or continue by marking files manually.

### Tracing impact

From the changed files, the tool walks the dependency graph outward and marks everything reachable.

- Nodes are classified by distance: changed, affected, untouched.
- Traversal is deterministic. The same repository and the same changed files always produce the same graph — a property the tool's credibility depends on.

### The detail panel

Clicking a node opens a panel to the right. It answers two questions:

- **Why is this file affected?** The specific chain of imports leading from a changed file to this one. A real path through the graph, not a summary — this is the evidence the whole product is built on.
- **Is it covered by tests?** Which test files exercise it, if any.

The panel sits beside the graph, so the clicked file never loses its position in the map. It closes without navigating anywhere.

### Test coverage

Coverage is deterministic and structural. It is **not** a judgment about which tests *should* be written.

- **Finding existing tests:** for an affected file, which test files exercise it.
- **The skeleton, not the recommendation:** for an untested affected file, what a test would need to touch — which functions, which inputs, what a test file would need to import. This is derived from the code's structure.

The tool does **not** claim to know which tests are important or ought to be written. It shows what exists and what the shape of a missing test would be, and stops there.

> **Agent decision, not the learner's.** `scope.md` promised "recommend relevant regression tests" and cut "which tests should I write" as a judgment call resting on weak evidence. The skeleton was kept as a middle option: closer to the original ambition, still deterministic. The learner said "go ahead and draft" without choosing between the two. One line to remove if the skeleton proves to be the expensive half.

## States and Boundaries

- **First use** — an empty graph area and one clear prompt to choose a repository folder. No empty-state illustration, no onboarding tour.
- **Reading the repository** — visible progress, because a large folder takes a moment. The user knows something is happening.
- **Loaded, nothing marked** — the full graph is visible but every node is in its neutral untouched state. Nothing is lit up yet, because there is no change to trace from.
- **Change marked, before the animation** — the starting files are highlighted and the user triggers the trace. The expansion is not automatic on selection; it runs when asked, so a mis-click doesn't commit them to a trace.
- **Tracing** — the expansion animation runs. This is the centerpiece; nothing else competes for attention while it plays.
- **No impact found** — the changed files import nothing else inside the repository. The graph shows the changed nodes and nothing lights up, and the tool says so plainly rather than presenting an empty graph as a result.
- **Empty folder, or no source files** — reported as such. "No JavaScript or TypeScript source files found in this folder."
- **Parse failures** — a file that can't be parsed is reported by name rather than silently dropped, because a silently missing node makes the graph quietly wrong.
- **Imports that resolve outside the repository** — drawn as edges leaving the graph boundary, not as errors. External packages are a normal outcome, not a failure.
- **PR files not present in the folder** — the mismatch check, above.
- **Private or unreadable PR** — reported distinctly from "file not found."
- **What persists:** nothing. No accounts, no storage of repositories or history between visits. Reloading starts fresh. This is deliberate: it means there is no database, and nothing about a user's code outlives the session.
- **Boundary:** the tool reads the folder the user explicitly selects. It does not reach outside that folder, and it does not access anything else on the machine.

## Product Decisions

- **Runs in a browser, with no install and no server** — the learner corrected an earlier decision to run locally. The initial plan was a local command-line tool.
- **The user selects the whole repository folder, not individual files** — the learner's suggestion, and it's the right one: an import pointing at a file that wasn't shared would otherwise be indistinguishable from an import pointing at an external package, quietly corrupting the graph.
- **Folder selection is required; a PR URL is an optional accelerator** — these answer different halves of the question. The URL supplies *what changed*; the folder supplies *the code to trace from*. A URL alone cannot produce a graph, because the imports in the changed files point at files the tool has never seen.
- **Both input routes stay available** — the learner's decision, to support both a pasted PR URL and selecting files directly.
- **Mismatches between a PR URL and the chosen folder are caught visibly** — the learner's decision, accepted over the alternative of not bothering for a PoC. A tool claiming verifiable evidence must not draw a confident wrong map.
- **The detail panel opens beside the graph, not over it** — the learner's decision. Replacing the graph would destroy the spatial relationship that is the tool's entire value.
- **Blue for "has tests," not green** — readability against purple nodes, developer-tooling convention, and it survives red-green color vision deficiency.
- **Coverage shown as a second visual channel on the graph**, not only inside the detail panel — so the "changed and untested" state is visible without clicking.
- **One screen, no navigation** — nothing to move between means nothing to lose context in.
- **Nothing persists between sessions** — deliberately keeps the tool free of accounts and storage.

## What We're Building

1. A single browser page that runs with no install and no backend.
2. Folder selection that reads a repository's JavaScript and TypeScript source.
3. Dependency graph construction: files as nodes, imports as edges, generated output excluded, circular imports handled.
4. Two ways to mark what changed: paste a GitHub PR URL, or click files in the graph.
5. A visible mismatch check when a PR URL and the chosen folder disagree, naming the files that weren't found and distinguishing an unreadable PR from a missing file.
6. Outward traversal from the changed files, classifying nodes as changed, affected, or untouched.
7. An animated expansion: nodes fly outward, edges draw themselves in, affected nodes light up, untouched nodes stay dim.
8. A detail panel beside the graph, showing the import chain from a changed file to the clicked one, and which tests exercise it.
9. A second visual channel on every node showing test coverage, so "changed and untested" is visible at a glance.
10. A small sample repository shipped with the tool.
11. Graceful, named reporting of every consequential failure: parse failures, empty folders, unresolvable imports, PR mismatches.

## Deferred From the POC

- **Recommending which tests to write** — a judgment call about importance, not a structural fact. Without an LLM it would rest on weak evidence while looking authoritative, and a wrong recommendation is worse than none. The structural skeleton is the honest substitute.
- **LLM-generated explanations of *why* an area matters** — the original pitch's "explain why each affected area deserves attention." v1 gives structured evidence ("imported by 3 files, 2 with tests"), which is correct and flat. The seam is left for a later version.
- **Private repository support** — needs GitHub credentials in the browser. Public PR URLs work unauthenticated and rate-limited, which is enough for a demo.
- **Real-time GitHub API integration** beyond a pasted URL — polling, live PR state, push notifications.
- **Folder-picker support outside Chromium-based browsers** — Safari and Firefox fall back to a flatter multi-file selection that doesn't preserve tree structure. Acceptable for a hackathon; documented rather than engineered around.
- **Large repositories** — a folder with thousands of files will be slow in a browser. The sample repository is small by design; this is a documented limitation, not a solved problem.
- **Any persistence** — accounts, saved analyses, history between visits.

## Possible Later Enhancements

- LLM-generated explanations at the seam left in the deterministic engine.
- Reviewer-facing annotations, since the same graph serves a reviewer reading it differently.
- Repository history mining — churn, hot spots, which files keep getting changed together.
- Language support beyond JavaScript and TypeScript.
- Multiple change sets compared side by side.

## Non-Goals

- **Being another AI code reviewer.** The kernel is evidence, not opinion. Nothing in this tool guesses what a change might do.
- **Writing tests or generating code.** The tool shows what a test would need to touch; it does not write one.
- **Executing the repository's code or tests.** Static structure only. This is what keeps every claim verifiable.
- **Monorepo and multi-package resolution.** Workspaces, package boundaries, and cross-package dependencies are out. Filtering generated files is in.
- **Repository-wide git history.** PR analysis is bounded; history mining is a different product with a time dimension.
- **3D visualization.** Force-directed layout was designed for 2D; in 3D nodes fog out with ambiguous depth and occlusion, which works against explainability.
- **Deployment.** The demo runs locally; a public URL isn't required to satisfy the submission.
- **Multi-user anything.** No accounts, no sharing, no collaboration.

## Open Questions

- **Does the test skeleton survive contact with the build?** **Resolved in `5-build`: cut before implementation, on the learner's decision.** It never reached the build, so it never had to be defended. The coverage *lookup* alone produces the "changed and untested" moment that makes the product work, and that is verified live against a real pull request. Recommending which tests to write stays deferred from the POC, as it always was.
- **Does blue read distinctly against purple once rendered?** The ring treatment is supposed to separate them by more than hue, but that's a visual judgment best made by looking. If it reads muddy, shifting "affected" toward magenta frees blue cleanly. Resolve during the build; not blocking for `4-spec`.
- **What is the sample repository?** It needs structure interesting enough to make the animation worth watching, and it must contain both circular imports and an untested file, or the tool's best states never appear in the demo. A design task for the build, not a product question.
