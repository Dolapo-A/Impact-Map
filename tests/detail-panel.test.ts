import { describe, expect, it } from 'vitest'

import { buildGraph, type SourceFile } from '../src/lib/graph.ts'
import type { ImportStatement } from '../src/lib/parser.ts'
import { traceImpact } from '../src/lib/trace.ts'

const files: SourceFile[] = [
  'src/cart.ts',
  'src/totals.ts',
  'src/unrelated.ts',
  'src/cart.test.ts',
].map((path) => ({ path, content: '' }))

const repoFiles = new Set(files.map((file) => file.path))
const statement = (specifier: string): ImportStatement => ({
  specifier,
  line: 1,
  kind: 'static',
})

const graph = buildGraph({
  files,
  importsByPath: new Map([
    ['src/cart.test.ts', [statement('./cart')]],
    ['src/cart.ts', [statement('./totals')]],
    ['src/totals.ts', []],
    ['src/unrelated.ts', []],
  ]),
  repoFiles,
  resolve: (specifier) => `src/${specifier.replace('./', '')}.ts`,
})

/**
 * The panel renders a claim the user is meant to trust, so the shortest-path
 * evidence it displays is verified here rather than only through the tracer's own
 * tests. A wrong chain is the single most damaging thing this tool could show:
 * it would send someone to check a dependency that does not exist.
 */
describe('the import chain shown in the detail panel', () => {
  it('gives a directly affected file a two-link chain', () => {
    // `cart.test.ts` imports `cart.ts`, so changing cart.ts affects the test.
    // The impact walk follows edges in reverse — toward importers — so a file that
    // is *imported by* your change is not itself affected.
    const result = traceImpact(graph, ['src/cart.ts'])
    expect(result.pathTo.get('src/cart.ts')).toEqual(['src/cart.ts'])
    expect(result.pathTo.get('src/cart.test.ts')).toEqual([
      'src/cart.ts',
      'src/cart.test.ts',
    ])
  })

  it('does not mark a file the change imports as affected', () => {
    // cart.ts imports totals.ts. Changing cart.ts does not reach totals.ts, because
    // totals.ts does not depend on cart.ts. Showing it as affected would send the
    // user chasing a dependency that does not exist.
    const result = traceImpact(graph, ['src/cart.ts'])
    expect(result.affected.has('src/totals.ts')).toBe(false)
    expect(result.pathTo.has('src/totals.ts')).toBe(false)
  })

  it('names the changed file first, so the direction of travel is readable', () => {
    const result = traceImpact(graph, ['src/cart.ts'])
    for (const chain of result.pathTo.values()) {
      expect(chain[0]).toBe('src/cart.ts')
    }
  })

  it('walks outward through importers, not through imports', () => {
    // index.ts imports cart.ts, so changing cart.ts reaches index.ts.
    const result = traceImpact(graph, ['src/totals.ts'])
    expect(result.affected.has('src/cart.ts')).toBe(true)
    expect(result.pathTo.get('src/cart.ts')).toEqual(['src/totals.ts', 'src/cart.ts'])
  })

  it('gives a changed file a single-link chain', () => {
    const result = traceImpact(graph, ['src/cart.ts'])
    // A file you changed has no chain leading to it; it is the origin.
    expect(result.pathTo.get('src/cart.ts')).toHaveLength(1)
  })

  it('records no chain for a file the change cannot reach', () => {
    const result = traceImpact(graph, ['src/cart.ts'])
    expect(result.pathTo.has('src/unrelated.ts')).toBe(false)
    expect(result.affected.has('src/unrelated.ts')).toBe(false)
  })

  it('picks the shortest chain when two routes reach the same file', () => {
    // index.ts reaches totals.ts both directly and via cart.ts. The shorter route
    // must win, or the panel shows a longer path than the truth requires.
    const branched: SourceFile[] = ['src/totals.ts', 'src/cart.ts', 'src/index.ts'].map(
      (path) => ({ path, content: '' }),
    )
    const repo = new Set(branched.map((file) => file.path))

    const branchedGraph = buildGraph({
      files: branched,
      importsByPath: new Map([
        ['src/index.ts', [statement('./cart'), statement('./totals')]],
        ['src/cart.ts', [statement('./totals')]],
        ['src/totals.ts', []],
      ]),
      repoFiles: repo,
      resolve: (specifier) => `src/${specifier.replace('./', '')}.ts`,
    })

    const result = traceImpact(branchedGraph, ['src/totals.ts'])
    // totals.ts → index.ts is one hop; via cart.ts it would be two.
    expect(result.pathTo.get('src/index.ts')).toEqual(['src/totals.ts', 'src/index.ts'])
    expect(result.distance.get('src/index.ts')).toBe(1)
  })

  it('starts the chain at a changed file even when several are marked', () => {
    const result = traceImpact(graph, ['src/cart.ts', 'src/unrelated.ts'])
    for (const [path, chain] of result.pathTo) {
      expect(chain[0]).toBe(path === 'src/unrelated.ts' ? 'src/unrelated.ts' : 'src/cart.ts')
    }
  })

  it('shows a chain through a circular import without looping', () => {
    const circular: SourceFile[] = ['src/a.ts', 'src/b.ts'].map((path) => ({
      path,
      content: '',
    }))
    const repo = new Set(circular.map((file) => file.path))

    const circularGraph = buildGraph({
      files: circular,
      importsByPath: new Map([
        ['src/a.ts', [statement('./b')]],
        ['src/b.ts', [statement('./a')]],
      ]),
      repoFiles: repo,
      resolve: (specifier) => `src/${specifier.replace('./', '')}.ts`,
    })

    const result = traceImpact(circularGraph, ['src/a.ts'])
    // b.ts imports a.ts, so it is affected — and the chain must terminate.
    expect(result.affected.has('src/b.ts')).toBe(true)
    expect(result.pathTo.get('src/b.ts')).toEqual(['src/a.ts', 'src/b.ts'])
  })
})
