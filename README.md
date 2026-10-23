# Impact Map

A browser tool that reads a repository's JavaScript/TypeScript dependency graph and
shows the **blast radius** of a code change — every file those changes can reach,
as a graph you can verify.

Every claim it makes traces back to a real import edge. No LLM, no opinions.

## What it does

The tool opens on a page that explains what it does and shows the bundled sample
repository drawing itself. From there:

1. **Pick a repository folder.** Files become nodes, imports become edges.
2. **Say what changed** — paste a public GitHub pull request URL, or click files
   directly in the graph. Either route produces the same set of starting points.
3. **Trace.** Everything those files can reach is marked as affected, animated
   outward by distance from the change.
4. **Click any node** to read the actual chain of imports leading back to your
   change, and which tests cover it.

The payoff state is an orange file with a red marker: *you changed this and nothing
tests it.*

## Running it

Requires **Node.js 20.19+ or 22.12+** and a **Chromium-based browser**
(Chrome, Edge, Brave, or Arc) — folder selection with directory structure
preserved needs `webkitdirectory`, which Safari and Firefox do not support.
The 3D view needs WebGL, which every current browser has.

```bash
npm install
npm run dev
```

Then open the local URL the terminal prints (usually `http://localhost:5173`).

Choose **a repository folder**, and select a folder of JS/TS source. A sample
repository is bundled at `sample-repo/` — pick that to try the tool without
supplying your own code.

Nothing is uploaded. Files are read in the page and never leave your machine.
Nothing about the repository is persisted: closing the tab forgets everything.
The only thing the tool remembers is your colour theme, which is a preference and
not a record of your code. `localStorage` is not used for anything else.

The page follows your system's light or dark setting, and the switch beside the
brand lets you pin it either way.

To check a production build:

```bash
npm run build
npm run preview
```

## Reading the graph

Two independent colour channels, and the legend on screen names both:

| Channel | Question | Encoding |
| --- | --- | --- |
| Node fill | How far from your change? | orange = changed, purple = affected, grey = untouched |
| Node badge | Is it covered by tests? | hollow blue ring = has tests, solid red disc = nothing tests it |

The coverage channel differs by **shape**, not just colour, because blue sits close
to purple on the spectrum — and because blue-vs-red survives red-green colour vision
deficiency, which affects roughly 8% of men and would otherwise hide the "untested"
warning entirely.

**Three views, switchable at the bottom of the screen.** *Columns* places files by
dependency depth, so the affected cluster reads as a contiguous band. *Physics*
pulls linked files together, so a circular import becomes a visible pair.
*3D* puts the same graph in a volume you can move through, where a change reaches
outward in every direction at once. Switching between them moves the files
rather than replacing the picture, so the same graph is seen three times instead
of three graphs being seen. The flat views are the default, because in three
dimensions a node behind another is a claim you cannot check. Neither encodes
distance-from-change in the way the animation implies; all three are
deterministic, so the same repository always lays out identically.

**Pointing at a file brings its neighbours forward.** Hovering a file dims
everything else and lights up only the files directly connected to it, which is
what makes a dense graph readable one file at a time.

## How it works

Pure logic lives in `src/lib/` and `src/services/`, free of React *runtime*
imports so it can be tested without a browser. (`layout.ts` imports an `Edge` type
from `@xyflow/react`, which is erased at compile time.)

| Stage | File | What it does |
| --- | --- | --- |
| Filter | `lib/files.ts` | Keeps `.ts/.tsx/.js/.jsx`, drops `node_modules`, `dist`, `*.d.ts`, lockfiles, minified bundles |
| Parse | `lib/parser.ts` | Tree-sitter (WASM) extracts imports — including multi-line ones a regex would miss |
| Resolve | `lib/resolve.ts` | Maps `./x` and `../x` onto real files; a bare package becomes an external edge |
| Build | `lib/graph.ts` | Files → nodes, imports → edges; parse failures recorded by name, never dropped |
| **Trace** | `lib/trace.ts` | Walks outward from the change through **importers**, recording distance and the shortest import chain — the evidence the detail panel shows |
| Coverage | `lib/coverage.ts` | Finds which test files reach each source file, directly or transitively |
| Motion | `lib/motion.ts` | Where each node flies in from, and when — staggered by distance |
| Layout | `lib/layout.ts`, `lib/layered.ts`, `lib/physics.ts` | Columns by depth (cycles collapsed via Tarjan's SCC), or force-directed |
| Volume | `lib/spatial.ts`, `lib/volume.ts` | The same graph in three dimensions, and what the volume shows |
| Sample | `lib/sampleRepo.ts` | The bundled repository, described in memory, so the landing page shows the real thing |
| Theme | `lib/css.ts`, `hooks/useTheme.tsx` | The palette, and the switch that changes it |
| Shape | `lib/geometry.ts`, `lib/viewport.ts` | The size of a file card, and the camera that frames the graph |
| Move | `lib/morph.ts`, `lib/ticker.ts` | The movement between two layouts, and the clock that drives it |
| Views | `lib/views.ts` | The three ways the graph can be looked at |
| Paths | `lib/paths.ts` | Reconciles browser-selected paths with repository-relative ones |
| Mismatch | `lib/mismatch.ts` | Compares a pull request's files against the chosen folder |
| GitHub | `services/github.ts` | Parses a PR URL and fetches its changed file names |

### The trace is the product

Edges run importer → imported, so impact travels the other way: if `cart.ts` imports
`price.ts`, then *changing* `price.ts` affects `cart.ts`. The tracer walks importers
outward from the change, visiting each file at most once so circular imports
terminate rather than loop.

It records the **shortest** chain from a changed file to every file it reaches.
That chain is the evidence — the detail panel shows it verbatim rather than
summarising it, because a paraphrase is not checkable.

### Two things the tool refuses to do

**It will not trace a pull request that disagrees with your folder.** If the PR
names files the folder does not contain, it lists them by name and marks nothing.
Marking the files that happen to be present would draw the blast radius of a change
you did not make, and it would look entirely plausible. Files the tool does not
graph — a `README`, a lockfile — are treated as out of scope, not missing.

**It will not claim to know why a 404 happened.** A private repository, a deleted
one and a typo all return HTTP 404, and GitHub will not say which. So the tool
reports *"this pull request can't be read"* rather than guessing.

## Parsing

Uses `web-tree-sitter@0.27` with grammar binaries from `@vscode/tree-sitter-wasm`
(ABI 14, which the 0.27 runtime accepts — it requires 13–15). The grammars are
served as local assets from `node_modules`; there is no CDN and no network call at
parse time.

A separate TSX grammar is used for `.tsx` files, because the plain TypeScript
grammar misreads `<T>` generics in JSX as comparison operators.

## Tests

```bash
npm test
```

215 tests. They cover the import forms (static, re-export, `require`, dynamic
`import()`), multi-line imports, path resolution including `.js`→`.ts` and
directory-index resolution, the tracer's deepest cases (multi-file blast radii,
cycles, determinism), coverage detection, layout determinism for both algorithms,
that the column layout keeps connected files next to each other, that the force
layout never puts two cards on top of one another, that the three-dimensional
view shows the same graph with the same states and the same coverage, that the
sample repository traces the way the tool traces it and still matches the
repository on disk, the animation's timing, the camera that frames the graph, the
pull request lookup's failure modes, and an end-to-end pass over the bundled
`sample-repo/`.

The tracer and the pull request lookup are tested most heavily: between them they
are where a wrong answer would be most convincing.

The bundled sample repository is itself a runnable project:

```bash
cd sample-repo
npm install
npm test        # 12 tests
npm run typecheck
```

## Known limitations

- **Chromium-only folder selection.** Safari and Firefox fall back to a flat
  multi-file selection that doesn't preserve tree structure.
- **Large repositories are slow** in a browser; the sample repo is small by design.
- **The mismatch check compares paths, not contents.** A file that exists is
  reported as found even if your local copy is at an older commit than the pull
  request. Verifying contents would need file contents at the PR's head commit — a
  much larger feature.
- **Public repositories only**, unauthenticated GitHub API: 60 requests/hour.
- **Unresolvable relative imports are reported as external packages**, so a wrong
  relative path in the analysed repository shows up as a dashed edge to a package
  rather than an error. This is a deliberate trade: the tool analyses structure,
  not types, and does not typecheck the code it reads.
- **No component tests.** The UI is verified by driving it in a browser; the logic
  underneath is unit-tested.

## Status

Proof of concept. See `devpost/` for the scope, product requirements, technical
spec, and the build record.