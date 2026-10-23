/**
 * The bundled sample repository, described in memory.
 *
 * The landing page shows what the tool does. Rather than draw a picture of a
 * repository, it shows this one: the same files, the same imports, the same
 * test coverage and the same trace the tool would produce. The import lists are
 * the real ones, read from the files in `sample-repo/`.
 */
import { buildGraph, type DependencyGraph, type SourceFile } from './graph'
import { findCoverage, type CoverageByPath } from './coverage'
import { traceImpact, type TraceResult } from './trace'
import type { ImportStatement } from './parser'

interface SampleFile {
  path: string
  /** The files this one imports, as repository-relative paths. */
  imports: string[]
}

const SAMPLE: SampleFile[] = [
  {
    path: 'src/index.ts',
    imports: [
      'src/utils/cart.ts',
      'src/utils/totals.ts',
      'src/utils/format.ts',
      'src/api/orders.ts',
      'src/domain/reservations.ts',
      'src/state/selectors.ts',
      'src/components/CartBadge.tsx',
    ],
  },
  { path: 'src/utils/cart.ts', imports: ['src/utils/totals.ts'] },
  { path: 'src/utils/totals.ts', imports: ['src/utils/cart.ts'] },
  { path: 'src/utils/format.ts', imports: ['src/utils/cart.ts'] },
  {
    path: 'src/api/orders.ts',
    imports: ['src/utils/totals.ts', 'src/utils/format.ts', 'src/utils/cart.ts'],
  },
  { path: 'src/domain/reservations.ts', imports: ['src/utils/cart.ts'] },
  {
    path: 'src/state/selectors.ts',
    imports: [
      'src/utils/cart.ts',
      'src/utils/format.ts',
      'src/api/orders.ts',
      'src/domain/reservations.ts',
    ],
  },
  { path: 'src/components/CartBadge.tsx', imports: ['src/state/selectors.ts'] },
  { path: 'src/utils/cart.test.ts', imports: ['src/utils/cart.ts'] },
  { path: 'src/utils/totals.test.ts', imports: ['src/utils/totals.ts'] },
  { path: 'src/utils/format.test.ts', imports: ['src/utils/format.ts'] },
  { path: 'src/api/orders.test.ts', imports: ['src/api/orders.ts'] },
]

function build(): DependencyGraph {
  const files: SourceFile[] = SAMPLE.map((file) => ({ path: file.path, content: '' }))
  const repoFiles = new Set(files.map((file) => file.path))

  const importsByPath = new Map<string, ImportStatement[]>(
    SAMPLE.map((file) => [
      file.path,
      file.imports.map((specifier) => ({ specifier, line: 1, kind: 'static' as const })),
    ]),
  )

  return buildGraph({
    files,
    importsByPath,
    repoFiles,
    resolve: (specifier) => (repoFiles.has(specifier) ? specifier : null),
  })
}

let graph: DependencyGraph | null = null

/** The sample repository's dependency graph. */
export function sampleGraph(): DependencyGraph {
  if (graph === null) graph = build()
  return graph
}

/** Which tests reach which files, in the sample repository. */
export function sampleCoverage(): CoverageByPath {
  return findCoverage(sampleGraph())
}

/** The blast radius of a change in the sample repository. */
export function sampleTrace(changed: string[]): TraceResult {
  return traceImpact(sampleGraph(), changed)
}

/** The imports between files, as the graph draws them. */
export function sampleEdges(): Array<{ from: string; to: string }> {
  return sampleGraph()
    .edges.filter((edge) => !edge.isExternal)
    .map((edge) => ({ from: edge.from, to: edge.to }))
}
