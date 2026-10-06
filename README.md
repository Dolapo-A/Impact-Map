# Impact Map

A browser tool that reads a repository's JavaScript/TypeScript dependency graph and
shows the **blast radius** of a code change — every file those changes can reach,
as a graph you can verify.

Every claim it makes traces back to a real import edge. No LLM, no opinions.

## Running it

Requires **Node.js 20.19+ or 22.12+** and a **Chromium-based browser**
(Chrome, Edge, Brave, or Arc) — folder selection with directory structure
preserved needs `webkitdirectory`, which Safari and Firefox do not support.

```bash
npm install
npm run dev
```

Then open the local URL the terminal prints (usually `http://localhost:5173`).

Click **Choose repository folder** and select a folder of JS/TS source. A sample
repository is bundled at `sample-repo/` — pick that to try the tool without
supplying your own code.

Nothing is uploaded. Files are read in the page and never leave your machine.
Nothing is persisted: closing the tab forgets everything, and `localStorage` is
deliberately not used.

## How it works

| Stage | File | What it does |
| --- | --- | --- |
| Filter | `src/lib/files.ts` | Keeps `.ts/.tsx/.js/.jsx`, drops `node_modules`, `dist`, `*.d.ts`, lockfiles, minified bundles |
| Parse | `src/lib/parser.ts` | Tree-sitter (WASM) extracts imports — including multi-line ones a regex would miss |
| Resolve | `src/lib/resolve.ts` | Maps `./x` and `../x` onto real files; a bare package becomes an external edge |
| Build | `src/lib/graph.ts` | Files → nodes, imports → edges; parse failures recorded by name, never dropped |
| Lay out | `src/lib/layout.ts` | Deterministic columns by dependency depth, with cycles collapsed via Tarjan's SCC |

`src/lib/` is deliberately free of React, so the parser, graph builder, and
layout are unit-testable without a browser.

## Parsing

Uses `web-tree-sitter@0.27` with grammar binaries from `@vscode/tree-sitter-wasm`
(ABI 14, which the 0.27 runtime accepts — it requires 13–15). The grammars are
served as local assets from `node_modules`; there is no CDN or network call at
parse time.

A separate TSX grammar is used for `.tsx` files, because the plain TypeScript
grammar misreads `<T>` generics in JSX as comparison operators.

## Tests

```bash
npm test
```

Covers the import forms (static, re-export, `require`, dynamic `import()`),
multi-line imports, path resolution including `.js`→`.ts` and directory-index
resolution, circular-import handling, and an end-to-end pass over the bundled
`sample-repo/`.

## Known limitations

- Chromium-only folder selection.
- Large repositories are slow in a browser; the sample repo is small by design.
- Unauthenticated GitHub API, public repositories only (60 requests/hour).

## Status

Proof of concept. See `devpost/` for the scope, PRD, spec, and build checklist.