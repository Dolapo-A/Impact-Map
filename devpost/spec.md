---
doc: spec
status: approved
---
<!-- `status` is the progress state every skill reads. Write `draft` when you first save this file,
     and change it to `approved` when the learner clearly approves the displayed plan ("looks good" counts).
     Do not request a second sign-off. Never skip the draft save —
     an unsaved draft dies with the conversation. -->

<!-- Adaptive template. Drop any section that doesn't apply to this product, add any
     section it needs, and let the nesting depth follow the product's real complexity —
     a single-file tool needs two levels, a multi-surface app might need four. Empty
     headings added for symmetry make the spec worse. The one rule: anything
     `5-build` will point at needs its own heading.

     Write the plain-language sections so the learner can read them back to someone
     else. That is the test this document has to pass. -->

# Impact Map — Technical Spec

## How This Works, In Plain Language

Impact Map is one web page running in a browser. You open it from a URL on your own machine, pick a folder, and it reads the JavaScript and TypeScript files inside — the code never leaves your computer.

The page has five working parts:

1. **The folder reader** asks you to pick a directory and reads the files inside it.
2. **The parser** reads each source file and pulls out the `import` lines — which file depends on which. This is done by Tree-sitter, a real parser library, not a text search, so it handles JavaScript and TypeScript syntax correctly even when an import spans several lines.
3. **The graph builder** turns those imports into a picture: files become dots, imports become lines between them.
4. **The tracer** marks what changed, then follows the lines outward to find every file that could be affected. Because imports are connections, this is the same as asking "what does this dot eventually touch?"
5. **The display** draws the graph and animates it, and shows a panel with details when you click a dot.

There is no database, no server, and no account. The graph lives in the page's memory while it's open. Closing the tab forgets everything.

**Why this shape.** Your PRD said the graph is the visual centre and the animation is the centerpiece. That is the hard, valuable part, so it gets a well-made library rather than hand-built physics. Everything else is deliberately small: one page, no persistence, no backend.

## The Core Journey Through the System

PRD ref: `prd.md > The Core Journey`.

```
  1. OPEN THE PAGE
        │
  2. PICK A FOLDER  ──────────────────────────►  [file: folder picker]
        │  browser grants read access to
        │  exactly that folder
        ▼
  3. READ + PARSE  ◄──────────────────────────  [parser: tree-sitter]
        │  each .js/.ts file in,
        │  each import pulled out
        │  (no network, nothing uploaded)
        ▼
  4. BUILD THE GRAPH  ◄───────────────────────  [graph builder]
        │  files → nodes, imports → edges
        │  node_modules / dist / *.d.ts skipped
        ▼
  5a. MARK WHAT CHANGED ◄─────────────────────  [input bar + graph canvas]
  5b.  ├─ paste PR URL ──► [GitHub lookup] ──┐
        └─ click files on graph ─────────────┘
                          │
                          ▼
        ┌────────────  MISMATCH CHECK  ────────────┐
        │ prd.md > The mismatch check              │
        │ PR names a file the folder doesn't have? │
        │  → list it, say so, offer manual marking │
        └───────────────────────────────────────────┘
                          │  consistent
                          ▼
  6. TRACE  ◄──────────────────────────────────  [tracer]
        │  walk imports outward from changed files
        │  cycle-safe: never revisit a node
        │  changed / affected / untouched
        ▼
  7. ANIMATE  ◄────────────────────────────────  [graph canvas]
        │  nodes fly outward, edges draw in,
        │  affected lit, untouched dim
        ▼
  8. CLICK A NODE  ◄──────────────────────────  [detail panel]
           import chain back to a changed file,
           which tests cover it
```

**The three data transformations**, in plain terms:

- **Folder → file list:** the browser hands over the files you selected. Nothing is uploaded anywhere.
- **File text → import list:** the parser reads each file's text and reports the exact positions of its imports. One file in, a list of dependency paths out.
- **Import list → graph:** each import path is resolved to an actual file in the folder when one matches. Paths that don't match a file are kept as *external* edges — pointing outside the graph, like an imported npm package. They are not errors.

## Stack

**Learner-selected:**

- **TypeScript** — your explicit choice, and the language you most want to work in (`learner-profile.md > Notes and Open Questions`). You get compile-time type safety and good editor tooling; the trade is the compiler step and needing to understand type errors rather than just runtime ones.

**Recommended, with agreement recorded:**

- **Vite** — the dev tool that serves the page locally and handles the build.
  Docs: https://vite.dev
  Version: 8.x (requires Node 20.19+ or 22.12+).
  **Tradeoff accepted:** you run `npm run dev` and open a local URL. Not a double-clickable file. In exchange you get module loading, TypeScript support, and a working build — none of which you'd want to hand-roll.

- **Tree-sitter** (`web-tree-sitter` + `@vscode/tree-sitter-wasm` grammars) — the parser that finds import statements.
  Runtime docs: https://tree-sitter.github.io/tree-sitter/
  Browser bindings: https://github.com/tree-sitter/tree-sitter/tree/master/lib/binding_web
  **Why you agreed to it:** a regex would miss multi-line imports and silently produce a wrong graph, which is the worst failure mode for a tool whose whole claim is verifiable evidence. Tradeoff: the parser compiles to WebAssembly — a binary format browsers run — which adds setup risk. See **Decisions and Open Issues**.

- **React Flow** (`@xyflow/react`) — the library that draws the graph and handles pan, zoom, and node interaction.
  Docs: https://reactflow.dev
  Version: 12.x (requires React 17+).
  **Why:** getting a force-directed layout that doesn't turn into an unreadable hairball is the hard part of your product. This library does it well. **Correction to an earlier claim in this conversation:** React Flow does *not* provide force-directed layout by default — nodes are placed by the developer or by a simple algorithm. Adding organic physics layout is a separate chunk of work, tracked as a risk below with a deterministic-layout fallback.

- **Vitest** — the test runner, matching the Vite ecosystem.
  Docs: https://vitest.dev

**Verified during the build (slice 1):**

- **A browser/WASM TypeScript grammar is available, from npm — no CDN needed.** `web-tree-sitter@0.27` accepts grammar ABI 13–15. The `tree-sitter-wasms` package ships grammars at an older ABI and is **rejected on load**; `@vscode/tree-sitter-wasm@0.3.1` ships ABI-14 grammars and works. Grammars are served as local assets, so there is no network call at parse time. It also ships a separate TSX grammar, which `.tsx` files need — the plain TypeScript grammar misreads `<T>` generics as comparison operators. **The regex fallback was not needed.**
- **Adding physics layout to React Flow was not attempted.** The layered deterministic layout in `src/lib/layout.ts` reads well for import graphs, because imports have a real direction and depth maps to left-to-right columns. Circular imports are collapsed into one column via Tarjan's strongly-connected components. The feel would be the only thing lost by revisiting this.

**Original open risks, now resolved:**

- ~~Whether a browser/WASM build of the TypeScript grammar is available.~~ Resolved — see above.
- ~~Whether adding a physics layout to React Flow is cheap.~~ Deferred; the deterministic layout preserves every product behavior.

## Where It Runs and How Someone Tries It

**Runtime:** a browser. There is no server process and no database.

**Environment:**
- Node.js 20.19+ or 22.12+ (required by Vite)
- A Chromium-based browser (Chrome, Edge, Brave, or Arc) — needed for folder selection with directory structure preserved. Safari and Firefox fall back to a flatter selection that doesn't preserve the tree; acceptable, but document it.

**No API keys. No accounts. No configuration files.**

**To start it:**
```
npm install
npm run dev
```
Then open the local URL the terminal prints (something like `http://localhost:5173`).

**To record the demo video:** start the dev server, open the URL, pick the bundled sample repository folder, paste the sample PR URL or click the changed files, trigger the trace, and let the animation play. The animation is the demo.

**Submission requires both** a short demo video and a public GitHub repository. **Deployment is optional** and is not a substitute for either. Per `prd.md > Non-Goals`, deployment is not planned; the demo runs locally and gets recorded.

For `6-ship`: the README needs the two commands above, the Node version, the Chromium requirement, and an explicit note about the sample repository being bundled.

## Look and Feel

Carried forward from `prd.md > Look and Feel` and `scope.md > Inspiration & Identity`, translated into terms a build agent can act on. Not re-interviewed.

**Palette — dark, restrained, state-only:**

| Purpose | Colour | Notes |
| --- | --- | --- |
| Page background | near-black, slightly blue | `#0d1117`-ish |
| Surface / panel | one step lighter | `#161b22`-ish |
| Border, muted text | low-contrast grey | `#2b313b`, `#9198a1` |
| Node fill — changed | orange | the change you marked |
| Node fill — affected | purple | reachable from the change |
| Node fill — untouched | dark grey | not reachable |
| Coverage ring — has tests | blue | see below |
| Coverage ring — no tests | red | the warning |
| Accent (focus, links) | mid blue | chrome only, never a node |

**Typography:** a single monospace family for file paths and code — they are the content here, and monospace makes import paths legible. A clean sans-serif for interface labels and panel prose. No more than two families.

**The ring treatment, specified concretely:** node fill carries distance; a distinct ring or badge around the node carries coverage. Blue and purple are close in hue, so the ring must differ by **shape and weight**, not only colour — a visible outline in one case, a small filled dot badge in the other. If it reads muddy when rendered, shift "affected" toward magenta.

**Motion:** staggered by graph distance. Nodes closest to the change move first and fastest; each successive ring follows with a short delay. Edges draw in as their target node arrives. Untouched nodes stay dim and static throughout. The whole sequence is roughly 1.5–2 seconds — long enough to follow, short enough to replay in a demo.

**Tone of interface copy:** plain and factual. "No JavaScript or TypeScript source files found in this folder." Not "Oops!" or emoji.

## Components

### Folder Picker
Asks the user to select a repository directory and returns the file list with relative paths preserved.
Talks to: nothing else directly — feeds **Repository Reader**.
PRD ref: `prd.md > Reading the repository`.
Note: requires a Chromium browser for directory structure. See **Failure Modes**.

### Repository Reader
Walks the selected folder, keeps `.js`/`.jsx`/`.ts`/`.tsx`, and drops generated output: `node_modules`, `dist`, `build`, `*.d.ts`, lockfiles. Returns file paths and their text content.
Talks to: **Parser**, **Graph Builder**.
PRD ref: `prd.md > Reading the repository`.

### Parser
Wraps Tree-sitter. Given one file's text, returns the list of module paths it imports. Resolves relative paths (`./`, `../`) against the importing file's location.
Talks to: **Repository Reader**, **Graph Builder**.
PRD ref: `prd.md > Reading the repository`.
Pure and synchronous — a module with no UI, and the most testable part of the codebase.

### Graph Builder
Converts file paths and import lists into nodes and edges. An import that resolves to a file in the folder becomes an internal edge. An import that resolves to nothing in the folder becomes an **external edge** — a node stub at the graph boundary, not an error. A file that fails to parse is recorded by name in a parse-failure list rather than dropped silently.
Talks to: **Parser**, **Tracer**, **Graph Canvas**, **Detail Panel**.
PRD ref: `prd.md > Reading the repository`, `prd.md > Tracing impact`.
Data shape lives in **Data Model**.

### GitHub PR Lookup
Takes a pasted pull request URL, extracts owner/repo/number, and calls the GitHub REST API for that PR's changed files.
Talks to: **Change Selector**, **Mismatch Check**.
PRD ref: `prd.md > Choosing what changed`, `prd.md > The mismatch check`.
Unauthenticated, public repositories only, rate-limited. See **External Services**.

### Change Selector
Holds the set of files the user has marked as changed. Populated either by the GitHub lookup or by clicking nodes on the canvas.
Talks to: **GitHub PR Lookup**, **Mismatch Check**, **Tracer**, **Graph Canvas**.
PRD ref: `prd.md > Choosing what changed`.

### Mismatch Check
Compares the files a PR names against the files the folder actually contains.
- Missing files are listed by name.
- A PR that can't be read at all (private, deleted, or rate-limited) is reported **distinctly** from "file not found" — different cause, different remedy.
- The user can proceed manually regardless.
Talks to: **GitHub PR Lookup**, **Change Selector**, **Control Strip**.
PRD ref: `prd.md > The mismatch check`.
This is the enforcement point for the product's core claim. It must never fail silently.

### Tracer
Walks the graph outward from the changed files, following edges in the direction of "is imported by" — i.e. which files depend on the changed ones. Visits each node at most once, so circular imports terminate rather than looping. Classifies every node as changed, affected, or untouched.
Talks to: **Graph Builder**, **Change Selector**, **Graph Canvas**, **Detail Panel**.
PRD ref: `prd.md > Tracing impact`.
Records, for each reached node, **the shortest import path** from a changed file — this is the evidence shown in the detail panel.

### Test Coverage Detector
For a given file, finds which test files exercise it. Detection is structural: a test file counts as covering a source file if it imports it directly or transitively.
Talks to: **Graph Builder**, **Graph Canvas**, **Detail Panel**, **Test Skeleton Builder**.
PRD ref: `prd.md > Test coverage`.
Deterministic. Makes no judgment about which tests ought to exist.

### Test Skeleton Builder *(candidate — see Open Questions)*
For an affected file with no test coverage, reports what a test for it would need to touch: exported functions, their parameter shapes, and what a test file would need to import.
Talks to: **Test Coverage Detector**, **Detail Panel**.
PRD ref: `prd.md > Test coverage`.
This component was an **agent decision, not the learner's**. It is the most likely thing to run over budget and is the first candidate for cutting.

### Graph Canvas
Renders nodes and edges with React Flow. Handles pan, zoom, and node click. Runs the expansion animation, staggered by distance from the change. Reads its data from the Graph Builder and Tracer.
Talks to: **Graph Builder**, **Tracer**, **Change Selector**, **Detail Panel**.
PRD ref: `prd.md > Tracing impact`, `prd.md > Screens and Layout`, `prd.md > Look and Feel`.

### Control Strip
The thin bar along the top: folder selection, the optional PR URL field, and the button that starts the trace. Visually subordinate to the canvas.
Talks to: **Folder Picker**, **GitHub PR Lookup**, **Tracer**.
PRD ref: `prd.md > Screens and Layout`.
The trace runs **only when the button is pressed**, never automatically on selection — a mis-click shouldn't commit the user to a trace.

### Detail Panel
Slides in from the right. Shows, for the clicked node: the file path, the import chain back to a changed file, and which tests cover it. Sits **beside** the canvas, never over it.
Talks to: **Tracer**, **Test Coverage Detector**, **Test Skeleton Builder**, **Graph Canvas**.
PRD ref: `prd.md > The detail panel`.

### Sample Repository
A small JavaScript/TypeScript repository bundled with the project for the demo.
PRD ref: `prd.md > What We're Building`, item 10.
**Hard requirement:** it must contain at least one circular import and at least one affected file with no test coverage — otherwise the product's two best states never appear in the demo. See **Decisions and Open Issues**.

## Data Model

Everything lives in the page's memory while it's open. Nothing is written to disk or sent anywhere.

**The graph:**
```
FileNode
  path          string    // relative, e.g. "src/utils/cart.ts"
  content       string    // the source text, held for parsing and display
  isTest        boolean   // matches *.test.* / *.spec.* — drives the coverage channel
  parseFailed   boolean   // reported by name, never silently dropped

Edge
  from          string    // the importing file's path
  to            string    // the imported path, resolved
  isExternal    boolean   // true = points outside the repo (npm package), no matching node
```

**The trace result:**
```
TraceResult
  changed       Set<string>    // files the user marked
  affected      Set<string>    // reached by walking outward
  distance      Map<string, number>   // hops from the nearest changed file
  pathTo        Map<string, string[]>  // the import chain, per reached file
```
`pathTo` is the evidence. It is the shortest chain from a changed file to each affected file, and it's what the detail panel shows verbatim.

**Answering the three questions for each piece of data:**

| Data | Where it lives | How it changes | On reload |
| --- | --- | --- | --- |
| Selected folder's files | in memory, held as a list | set once at folder selection | gone — user re-picks |
| Dependency graph | in memory | built once, never mutated | gone |
| Changed files | in memory | set by URL or by clicking | gone |
| Trace result | in memory | recomputed each time the user presses the trace button | gone |
| Which node is selected | in memory | set on click, cleared on close | gone |

**Nothing persists.** This is deliberate (`prd.md > States and Boundaries`) and means no database, no local storage, no cookies. There is no user data to protect because there is no stored user data.

**The one exception to be careful about:** `localStorage` must not be used to cache repository contents. Caching source code would mean the user's code outliving the session, which the PRD explicitly rules out.

## File Structure

```
impact-map/
├── src/
│   ├── main.tsx                  # app entry — mounts the page
│   ├── App.tsx                   # layout: control strip + canvas + detail panel
│   │
│   ├── lib/                      # pure logic, no UI — the testable core
│   │   ├── files.ts              # which files to include, which to skip
│   │   ├── parser.ts             # tree-sitter wrapper: source text → import paths
│   │   ├── resolve.ts            # resolve ./ and ../ against the importing file
│   │   ├── graph.ts              # build nodes + edges from files and imports
│   │   ├── trace.ts              # outward walk, cycle-safe, records distance + path
│   │   ├── coverage.ts           # which test files exercise a given file
│   │   └── skeleton.ts           # test skeleton  [candidate — may be cut]
│   │
│   ├── components/
│   │   ├── FolderPicker.tsx      # directory selection
│   │   ├── ControlStrip.tsx      # top bar: folder, PR URL, trace button
│   │   ├── GraphCanvas.tsx       # react-flow rendering + expansion animation
│   │   ├── FileNode.tsx          # one node: fill colour + coverage ring
│   │   ├── DetailPanel.tsx       # right-hand panel
│   │   └── MismatchNotice.tsx    # the PR/folder disagreement warning
│   │
│   ├── services/
│   │   └── github.ts             # GitHub REST call, URL parsing, rate-limit handling
│   │
│   ├── state/
│   │   └── appState.ts           # where the graph, changed set, and trace live
│   │
│   └── styles/
│       └── theme.css             # the palette above, as CSS variables
│
├── sample-repo/                  # bundled demo repository (see Sample Repository)
│   ├── src/…                     # must include a circular import
│   └── src/….test.ts             # and an affected file with no test
│
├── devpost/                      # planning docs (learner-profile is gitignored)
├── index.html
├── package.json
├── vite.config.ts
└── README.md
```

`src/lib/` is deliberately free of React. That's what makes the parser, tracer, and coverage detector testable without a browser — and the tracer in particular is where you'd want a real unit test, since cycle handling is easy to get subtly wrong.

## External Services and Dependencies

**GitHub REST API — the only external service.**

- **Endpoint:** `GET https://api.github.com/repos/{owner}/{repo}/pulls/{number}/files`
- **Request:** no body. Path parameters parsed out of the pasted PR URL.
- **Response used:** the `filename` field from each entry in the returned array. Only the changed file list is needed — not the patches, not the diffs.
- **Auth:** none. Unauthenticated access, **public repositories only**.
- **Rate limit:** 60 requests per hour per IP address for unauthenticated requests.
- **Cost:** free.
- **Docs:** https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files

**Failure modes to distinguish, and how they differ:**

| Situation | Signal | What the user is told |
| --- | --- | --- |
| Private repo | HTTP 404 | "This pull request can't be read. Impact Map only works with public repositories." |
| Repo or PR deleted / typo | HTTP 404 | Same shape — indistinguishable from private, and honestly reported as "can't be read" |
| Rate limit hit | HTTP 403 with a rate-limit header | "GitHub's request limit was reached. Try again later, or mark files manually." |
| Network down | fetch rejects | "Couldn't reach GitHub. Mark files manually instead." |

Note the honesty requirement in row two: a deleted repo and a private repo produce the same status code, so the tool must not claim to know which it is. "Can't be read" is the truthful message.

**npm dependencies** — all recorded with docs in **Stack**: `vite`, `web-tree-sitter`, `@xyflow/react`, `vitest`, plus `react`, `react-dom`, and TypeScript.

**No database. No auth. No hosting. No paid service.**

## Important Failure Modes

The three places this realistically breaks in front of someone.

- **The TypeScript grammar has no browser/WASM build, or fails to load** → the parser can't run. This is the known biggest risk. Fall back to a regex parser that specifically handles multi-line imports, and note the reduced robustness. *Verify this in the first build step.*
- **The user picks a folder with no source files, or a huge one** → "No JavaScript or TypeScript source files found in this folder." for the empty case. For a huge folder, the read is slow; show progress, and if it's still going after a few seconds, say how many files are being processed.
- **The PR URL doesn't match the chosen folder** → the **Mismatch Check**. This is a designed feature, not an error: list the missing files by name, explain that the folder and PR look like different repositories or commits, offer manual marking as a way forward.

Also worth knowing, lower severity:
- **A file fails to parse** → named in a parse-failure notice. Never dropped silently — a missing node makes the graph quietly wrong.
- **The trace finds nothing** → say "Nothing in this repository imports these files" rather than showing an empty graph as though it were a result.
- **Adding physics layout to React Flow proves expensive** → fall back to a deterministic layout. Changes the feel, not the function.

## What Was Simplified and Why

- **A Vite dev server instead of a single double-clickable HTML file** — the product's value is a well-laid-out animated graph, and hand-writing force-directed physics would spend the build on something the PRD calls the centerpiece. The fuller alternative (no build step at all) would mean writing the graph rendering, layout, and animation by hand.
- **Unauthenticated GitHub API instead of authenticated access** — private repos would need a token field, a secrets story, and a failure mode. Public repos at 60 requests/hour is enough for a demo. The fuller version needs a token input and careful handling of credentials in a browser.
- **A regex parser as a documented fallback instead of guaranteeing Tree-sitter works** — the fallback exists only in case the WASM grammar can't be obtained. It is explicitly *not* the intended path.
- **Deterministic layouts as the fallback for physics** — if a physics layout turns out to be a large lift, a grid or tree layout preserves every product behavior. Only the motion quality drops.
- **No persistence at all** — even a "recently analysed" list would mean storing something about the user's code. Eliminating it removes a database, a privacy surface, and a class of bugs. The fuller version would need one of those back.

## Decisions and Open Issues

**Learner decisions, agreed in this phase:**

| Decision | Why | Tradeoff accepted |
| --- | --- | --- |
| Vite + local dev server | buys a good graph library instead of hand-built physics | you run `npm run dev` and open a URL; not a double-clickable file |
| Public repos only, unauthenticated | no token, no credential handling | private PRs won't work; 60 req/hour |
| Tree-sitter for parsing | correct on multi-line imports; a regex would silently produce wrong graphs | WASM setup risk — see below |
| TypeScript | the learner's explicit language choice | the compiler step and type-error debugging |

**The genuine uncertainty worth naming: WebAssembly grammar setup.**

You chose Tree-sitter over a regex parser knowing it compiles to WebAssembly. The honest reason this matters: I confirmed the browser runtime package (`web-tree-sitter` v0.27.0) exists and is actively maintained, but **I have not verified that a browser-compatible TypeScript grammar build is available.** If it isn't, the fallback needs a precompiled `.wasm` grammar from somewhere — possibly a CDN — which introduces a network dependency at parse time and a new failure mode.

**Agreed handling:** this gets checked in the *first* build step, before anything is built on top of it. If a browser grammar is available, proceed as planned. If not, fall back to a regex parser written specifically to handle multi-line imports, and record the reduced robustness honestly in the README rather than pretending the graph is fully reliable. This is a real risk with a real fallback, not a formality.

**Verification performed during this phase (live lookups, not from memory):**

- `web-tree-sitter` — v0.27.0 confirmed on npm, actively maintained. Browser runtime exists.
- `@xyflow/react` — v12.12.0 confirmed, MIT, requires React 17+.
- `vite` — v8.3.3 confirmed; requires Node `^20.19.0 || >=22.12.0`.
- `tree-sitter-typescript` — v0.23.2 confirmed, but **the npm package is Node bindings** (`bindings/node`, `node-gyp-build` install script), not a browser build. Confirmed in the build: it does not work in the browser. `@vscode/tree-sitter-wasm@0.3.1` is the package that does.
- GitHub PR files endpoint confirmed at the documented path; unauthenticated rate limit documented as 60/hour.

**Carried from `prd.md > Open Questions`:**

- **Does the test skeleton survive contact with the build?** — unresolved, and flagged for a decision during `5-build`. It was an agent decision, not the learner's. Cut it if it starts costing time; the coverage lookup alone still produces the "changed and untested" moment.
- **Does blue read distinctly against purple when rendered?** — a visual judgment best made by looking. Escape hatch: shift "affected" toward magenta. Not blocking.
- **What is the sample repository?** — now a build task with a hard requirement: it must contain a circular import and an affected file with no test coverage, or the product's two best states never appear in the demo.
- **Does the physics layout prove expensive?** — resolved in the build. `d3-force` settles the bundled sample graph quickly enough for an imperceptible load-time layout. It starts from a fixed phyllotaxis spiral rather than d3's random seed, so the same repository produces the same picture on every reload. There is no layout toggle in the POC.

**Unresolved from this spec's self-review:**

- Whether a file-count cap is needed on very large folders. Leaning toward showing progress without a hard cap, since `prd.md` already documents large repos as a known limitation. Confirm during the build.
