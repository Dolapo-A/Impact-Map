---
doc: scope
status: approved
---
<!-- `status` is the progress state every skill reads. Write `draft` when you first save this file,
     and change it to `approved` when the learner clearly approves the displayed plan ("looks good" counts).
     Do not request a second sign-off. Never skip the draft save —
     an unsaved draft dies with the conversation. -->

<!-- Scope is a rough sketch of the heart of the idea — NOT the detailed product
     definition. Resist the urge to fill this out exhaustively: features, screens,
     and behavior belong in the PRD, which comes next. Capture what makes this
     project distinctive and what belongs in a coherent proof of concept.
     Add a section if the conversation surfaced something important that
     doesn't fit below. Keep it short and readable. -->

# Impact Map

A tool that takes a pull request's changed files and shows you the blast radius — an animated, evidence-backed graph of everything those changes can reach.

## The Unique Kernel
**An impact map with evidence, not a review.** Every claim it makes traces back to a real dependency edge you can click and verify. No LLM, no opinions, no "an AI thinks this might be risky." If you deleted the graph and the explanations were gone, there'd be no tool left — because the graph *is* the product, not a view onto a model.

## Who It's For
Primarily the developer who just opened their own PR. They know what they changed but not what they forgot; the question is "what else did I break?" Today they answer it by rereading the diff and guessing, or by finding out in CI, or in production.

Secondarily the reviewer looking at someone else's PR, who needs to orient fast. Same map, read differently.

**Both users, deliberately.** The graph view is genuinely shared — the same expansion answers "what did I forget?" and "where do I start reading?" What differs is the *text* per node, not the view. v1 builds one graph with one explanation style, leaning author-side. Reviewer-optimized annotation is later.

## The Core Loop
Open the tool → point it at a PR (or a set of changed files) → the graph loads → it animates outward from the changed files, edges drawing themselves, the affected cluster lighting up while everything else stays dim → click any node to read why it matters and whether it's covered by tests.

You come back because it caught something you didn't think about.

## Inspiration & Identity
Clean, restrained, confident. One visual idea per screen; no chrome competing with the graph. Motion as explanation rather than ornament: the outward expansion *is* the argument about blast radius. `3-prd` fills in the specific look and feel.

**Two color channels, not one.** "How far from my change?" and "is it tested?" are different kinds of fact, and a single fill can't carry both — an affected, untested file has to be able to say so at a glance.

| Channel | Question it answers | Encoding |
| --- | --- | --- |
| Node fill | How far from my change? | orange = changed, purple = affected, grey = untouched |
| Node ring / badge | Is it covered by tests? | blue = has tests, red = no tests |

The payoff: **orange core with a red ring = you changed this and nothing tests it** — the most actionable thing the tool can say, and unmistakable at a glance.

Blue for coverage rather than green, deliberately. Green-on-purple is muddy and hard to read; blue is neutral and reads cleanly against both orange and purple, and it's the standard developer-tooling convention for "verified / has data." Red stays unambiguous as the only warm color on the coverage channel.

**Accessibility is a requirement, not a nicety.** Green/red is the most common colorblindness failure in developer tooling — roughly 8% of men have red-green color vision deficiency, which would make the "untested" warning invisible to a real slice of users. Blue-vs-red survives it.

Open question for `3-prd`: blue and purple are adjacent on the spectrum, so they must differ by more than hue — the ring/badge treatment does that separating. If that proves muddy, shifting "affected" toward magenta frees blue cleanly.

## Why This Matters to the Learner
The idea started as a response to a specific frustration: years of using version control without ever fully grasping it — "over this period of time, I've not fully grasped it." The tool is built to make the shape of a codebase and a change visible in a way git never was.

The learner also picked TypeScript deliberately as the language they most want to work in. That is a real stake in this build, not an implementation detail.

Stated aim beyond the demo: to be able to scope a project and write a PRD for one themselves. This project is the vehicle for that practice — scope it here, define it in `3-prd`, build against it in `5-build`, and find out whether the requirements actually held up.

## What "Working" Looks Like
You paste or point at a PR. The graph loads. Then it animates: nodes fly outward from the changed files, edges draw themselves in, and the affected cluster lights up while everything else stays dim. You click one node and it tells you why it matters and whether it's tested.

That expansion-and-light-up is the beat the whole demo video is built around — ~45 seconds, and it sells the entire idea.

Since no LLM is involved, "working" also means the graph is genuinely correct: every edge is a real import, verifiable by clicking through to the file.

## The POC Boundary
**In:**
- Input: one pull request, or a set of changed files
- Parse the JavaScript/TypeScript dependency graph — imports, exports, re-exports, cross-file references
- Walk outward from the changed files to find what they reach
- Detect and handle circular imports
- Render as an interactive 2D graph: nodes are files, edges are imports
- Animate the outward expansion and highlight affected nodes
- Click a node → why it matters, and whether it's covered by tests
- Test coverage shown as a visible second channel on the graph, not only in the detail panel
- One small sample repository shipped with the tool, with genuinely interesting structure
- Repo path is configurable, so it can be pointed at a real repository

**Explicitly not in — the AI.** Dependency tracing is deterministic; an LLM would be slower, non-reproducible, and capable of hallucinating the graph. Explanations in v1 are structured and templated, not generated: "this function is imported by 3 files, 2 of which have tests." Correct and dull — which is exactly the trade being made, and it *strengthens* the evidence-backed claim. Leave a clean seam where an LLM explanation could slot in later, so that version isn't a rewrite.

## Later
- LLM-generated explanations at the seam left above
- Repository-wide git activity and history mining — hot spots, churn, who changes what. Different product, different question
- Reviewer-optimized annotations
- Supporting more languages beyond JS/TS
- Real GitHub API integration instead of pasted input

## Explicitly Cut
- **3D visualization.** Cut deliberately. Hierarchy is the one thing 3D does well, but the core question here is spatial-relationship and graphs render fastest and clearest in 2D. Force-directed layout — the algorithm that makes these readable — was designed for 2D; in 3D nodes spread into a foggy ball with ambiguous depth and occlusion hiding half the graph. Explainability is the differentiator, and a view where you can't see what's behind what is anti-explainable. A well-animated 2D graph is also more impressive in a demo video than a mediocre 3D one, because motion communicates and orbiting does not.
- **LLM in v1** — reasons above. This is the main concession to PoC scope.
- **Repository-wide git activity** — "git activity" and "pull request analysis" were two different inputs in the original idea. PR analysis is bounded: a known set of changed files. History mining needs a full scan and a time dimension. PR only for now.
- **Monorepo and multi-package support.** Real enterprise repos bring workspaces, generated files (`dist/`, `*.d.ts`), lockfiles, and scale problems that would eat the budget. Filtering generated files is still in scope.
- **Making the tool's own tests a feature** — no.
- **Deployment.** Optional for the hackathon; the demo runs locally.
