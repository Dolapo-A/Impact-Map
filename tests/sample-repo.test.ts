import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { shouldIncludeFile } from '../src/lib/files.ts'
import { parseFile, type ImportStatement } from '../src/lib/parser.ts'
import { resolveToRepoFile } from '../src/lib/resolve.ts'
import { buildGraph, type SourceFile } from '../src/lib/graph.ts'
import { layoutGraph } from '../src/lib/layout.ts'

/**
 * End-to-end over the real bundled sample repository: read files from disk, parse
 * them with Tree-sitter, resolve imports, build the graph, lay it out.
 *
 * This is the whole slice-1 pipeline with no browser, so the structures the UI
 * depends on are verified against real source rather than hand-written fixtures.
 */
const SAMPLE_REPO = join(import.meta.dirname, '..', 'sample-repo')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

async function buildSampleGraph() {
  const files: SourceFile[] = walk(SAMPLE_REPO)
    .map((full) => relative(SAMPLE_REPO, full))
    .filter(shouldIncludeFile)
    .map((path) => ({ path, content: readFileSync(join(SAMPLE_REPO, path), 'utf8') }))

  const repoFiles = new Set(files.map((f) => f.path))
  const importsByPath = new Map<string, ImportStatement[]>()

  for (const file of files) {
    const result = await parseFile(file.path, file.content)
    if (!result.parseFailed) importsByPath.set(file.path, result.imports)
  }

  const graph = buildGraph({
    files,
    importsByPath,
    repoFiles,
    resolve: (specifier, fromPath) => resolveToRepoFile(specifier, fromPath, repoFiles),
  })

  return { files, graph }
}

describe('the bundled sample repository', () => {
  it('contains a circular import, as the spec requires', async () => {
    const { graph } = await buildSampleGraph()
    const internal = graph.edges.filter((e) => !e.isExternal)
    const pairs = new Set(internal.map((e) => `${e.from}->${e.to}`))

    // cart.ts calls totalsFor from totals.ts, and totals.ts imports cart.ts.
    expect(pairs.has('src/utils/cart.ts->src/utils/totals.ts')).toBe(true)
    expect(pairs.has('src/utils/totals.ts->src/utils/cart.ts')).toBe(true)
  })

  it('contains an affected file with no test coverage', async () => {
    const { graph } = await buildSampleGraph()
    // reservations.ts has no test file importing it — the demo's best state.
    const coveredByATest = graph.edges
      .filter((e) => !e.isExternal && e.from.endsWith('.test.ts'))
      .map((e) => e.to)
    expect(coveredByATest).not.toContain('src/domain/reservations.ts')
  })

  it('parses every file without a parse failure', async () => {
    const { graph } = await buildSampleGraph()
    expect(graph.parseFailures).toEqual([])
  })

  it('resolves imports across directories and through a barrel file', async () => {
    const { graph } = await buildSampleGraph()
    const edges = new Set(
      graph.edges.filter((e) => !e.isExternal).map((e) => `${e.from}->${e.to}`),
    )

    // Cross-directory relative import.
    expect(edges.has('src/api/orders.ts->src/utils/totals.ts')).toBe(true)
    expect(edges.has('src/api/orders.ts->src/utils/format.ts')).toBe(true)
    // Re-exported through index.ts.
    expect(edges.has('src/index.ts->src/utils/cart.ts')).toBe(true)
    expect(edges.has('src/index.ts->src/domain/reservations.ts')).toBe(true)
    // Test file importing the module it exercises.
    expect(edges.has('src/utils/totals.test.ts->src/utils/cart.ts')).toBe(true)
  })

  it('marks the external vitest import as an external edge, not a missing file', async () => {
    const { graph } = await buildSampleGraph()
    expect(graph.externalModules).toContain('vitest')
  })

  it('produces a layout covering every file exactly once', async () => {
    const { files, graph } = await buildSampleGraph()
    const laid = layoutGraph(
      graph.nodes.map((n) => ({ id: n.path })),
      graph.edges,
    )
    expect(laid).toHaveLength(files.length)
    expect(new Set(laid.map((n) => n.id)).size).toBe(files.length)
  })
})