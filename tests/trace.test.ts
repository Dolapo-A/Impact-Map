import { describe, expect, it } from 'vitest'

import { buildGraph, type SourceFile } from '../src/lib/graph.ts'
import type { ImportStatement } from '../src/lib/parser.ts'
import { traceImpact } from '../src/lib/trace.ts'

const files: SourceFile[] = ['a.ts', 'b.ts', 'c.ts', 'd.ts'].map((path) => ({ path, content: '' }))
const repoFiles = new Set(files.map((file) => file.path))
const statement = (specifier: string): ImportStatement => ({ specifier, line: 1, kind: 'static' })

function graphWith(importsByPath: Map<string, ImportStatement[]>) {
  return buildGraph({
    files,
    importsByPath,
    repoFiles,
    resolve: (specifier) => specifier.replace('./', '').endsWith('.ts')
      ? specifier.replace('./', '')
      : `${specifier.replace('./', '')}.ts`,
  })
}

describe('traceImpact', () => {
  it('walks outward through importers and records distance and the shortest chain', () => {
    const graph = graphWith(new Map([
      ['a.ts', [statement('./b')]],
      ['b.ts', [statement('./c')]],
      ['d.ts', [statement('./b')]],
      ['c.ts', []],
    ]))

    const result = traceImpact(graph, ['c.ts'])

    expect(result.affected).toEqual(new Set(['b.ts', 'a.ts', 'd.ts']))
    expect(result.distance.get('c.ts')).toBe(0)
    expect(result.distance.get('b.ts')).toBe(1)
    expect(result.distance.get('a.ts')).toBe(2)
    expect(result.pathTo.get('a.ts')).toEqual(['c.ts', 'b.ts', 'a.ts'])
  })

  it('terminates on a circular import and visits each file once', () => {
    const graph = graphWith(new Map([
      ['a.ts', [statement('./b')]],
      ['b.ts', [statement('./a')]],
      ['c.ts', [statement('./b')]],
      ['d.ts', []],
    ]))

    const result = traceImpact(graph, ['a.ts'])

    expect(result.affected).toEqual(new Set(['b.ts', 'c.ts']))
    expect(result.distance.get('b.ts')).toBe(1)
    expect(result.distance.get('c.ts')).toBe(2)
    expect(result.pathTo.get('c.ts')).toEqual(['a.ts', 'b.ts', 'c.ts'])
    expect(result.distance).toHaveLength(3)
  })
})

/**
 * The tracer is the kernel: every claim the product makes rests on it, so it is
 * tested more thoroughly than any other module. The cases below are the ones a
 * regression would break silently — a wrong blast radius still *looks* plausible.
 */
describe('traceImpact — chains deeper than two hops', () => {
  /**
   * An import of d reaches c, b and a.
   * Edges run importer → imported, so a is affected by b only if a *imports* b.
   */
  function deepChain() {
    return graphWith(new Map([
      ['a.ts', [statement('./b')]],
      ['b.ts', [statement('./c')]],
      ['c.ts', [statement('./d')]],
      ['d.ts', []],
    ]))
  }

  it('records a rising distance for every hop', () => {
    const result = traceImpact(deepChain(), ['d.ts'])

    expect(result.distance.get('d.ts')).toBe(0)
    expect(result.distance.get('c.ts')).toBe(1)
    expect(result.distance.get('b.ts')).toBe(2)
    expect(result.distance.get('a.ts')).toBe(3)
  })

  it('records the full chain from the change to the furthest file', () => {
    const result = traceImpact(deepChain(), ['d.ts'])
    expect(result.pathTo.get('a.ts')).toEqual(['d.ts', 'c.ts', 'b.ts', 'a.ts'])
  })

  it('marks every reached file affected, and nothing else', () => {
    const result = traceImpact(deepChain(), ['d.ts'])
    expect(result.affected).toEqual(new Set(['c.ts', 'b.ts', 'a.ts']))
  })
})

describe('traceImpact — several changed files at once', () => {
  /** Both c and d are imported by b, and b is imported by a. */
  function twoRoots() {
    return graphWith(new Map([
      ['a.ts', [statement('./b')]],
      ['b.ts', [statement('./c'), statement('./d')]],
      ['c.ts', []],
      ['d.ts', []],
    ]))
  }

  it('unions the blast radius of each changed file', () => {
    // A real pull request changes several files, and the product must report
    // everything any of them can reach.
    const result = traceImpact(twoRoots(), ['c.ts', 'd.ts'])

    expect(result.changed).toEqual(new Set(['c.ts', 'd.ts']))
    expect(result.affected).toEqual(new Set(['b.ts', 'a.ts']))
  })

  it('measures each file from its nearest changed file', () => {
    // b is one hop from c and one from d; a is two from either. Nothing is
    // measured from the "first" change encountered.
    const result = traceImpact(twoRoots(), ['c.ts', 'd.ts'])

    expect(result.distance.get('b.ts')).toBe(1)
    expect(result.distance.get('a.ts')).toBe(2)
  })

  it('starts every chain at the changed file that actually reaches it', () => {
    const result = traceImpact(twoRoots(), ['c.ts', 'd.ts'])

    expect(result.pathTo.get('b.ts')).toEqual(['c.ts', 'b.ts'])
    expect(result.pathTo.get('a.ts')).toEqual(['c.ts', 'b.ts', 'a.ts'])
    for (const chain of result.pathTo.values()) {
      expect(result.changed.has(chain[0])).toBe(true)
    }
  })

  it('never marks a changed file as affected, even when one imports another', () => {
    // b imports a; if both are changed, `a` is part of the change rather than a
    // casualty of it, and colouring it "affected" would misreport the author's work.
    const graph = graphWith(new Map([
      ['a.ts', []],
      ['b.ts', [statement('./a')]],
      ['c.ts', []],
      ['d.ts', []],
    ]))

    const result = traceImpact(graph, ['a.ts', 'b.ts'])

    expect(result.changed).toEqual(new Set(['a.ts', 'b.ts']))
    expect(result.affected).toEqual(new Set())
  })

  it('gives a changed file a chain of only itself, whatever else is marked', () => {
    const graph = graphWith(new Map([
      ['a.ts', []],
      ['b.ts', [statement('./a')]],
      ['c.ts', []],
      ['d.ts', []],
    ]))

    const result = traceImpact(graph, ['a.ts', 'b.ts'])

    expect(result.pathTo.get('a.ts')).toEqual(['a.ts'])
    expect(result.pathTo.get('b.ts')).toEqual(['b.ts'])
  })
})

describe('traceImpact — degenerate input', () => {
  it('reports nothing affected when no file is marked', () => {
    const graph = graphWith(new Map([
      ['a.ts', []],
      ['b.ts', [statement('./a')]],
      ['c.ts', []],
      ['d.ts', []],
    ]))

    const result = traceImpact(graph, [])

    expect(result.changed.size).toBe(0)
    expect(result.affected.size).toBe(0)
    expect(result.distance.size).toBe(0)
  })

  it('says plainly that nothing was found rather than failing', () => {
    // This is the PRD's "No impact found" state, and it must be reachable.
    const graph = graphWith(new Map([
      ['a.ts', []],
      ['b.ts', [statement('./a')]],
      ['c.ts', []],
      ['d.ts', []],
    ]))

    const result = traceImpact(graph, ['a.ts'])

    expect(result.affected).toEqual(new Set(['b.ts']))
  })

  it('ignores a marked file that is not in the repository', () => {
    // A pasted pull request could name a file the folder does not hold. Tracing it
    // would invent an origin and produce a confidently wrong map.
    const graph = graphWith(new Map([
      ['a.ts', []],
      ['b.ts', [statement('./a')]],
      ['c.ts', []],
      ['d.ts', []],
    ]))

    const result = traceImpact(graph, ['does-not-exist.ts'])

    expect(result.changed.size).toBe(0)
    expect(result.affected.size).toBe(0)
    expect(result.pathTo.has('does-not-exist.ts')).toBe(false)
  })

  it('traces the real change when only one of two marked files is real', () => {
    const graph = graphWith(new Map([
      ['a.ts', []],
      ['b.ts', [statement('./a')]],
      ['c.ts', []],
      ['d.ts', []],
    ]))

    const result = traceImpact(graph, ['a.ts', 'does-not-exist.ts'])

    expect(result.changed).toEqual(new Set(['a.ts']))
    expect(result.affected).toEqual(new Set(['b.ts']))
  })

  it('handles a change nothing imports', () => {
    const graph = graphWith(new Map([
      ['a.ts', []],
      ['b.ts', []],
      ['c.ts', []],
      ['d.ts', []],
    ]))

    const result = traceImpact(graph, ['a.ts'])

    expect(result.changed).toEqual(new Set(['a.ts']))
    expect(result.affected).toEqual(new Set())
    expect(result.distance.get('a.ts')).toBe(0)
  })
})

describe('traceImpact — determinism', () => {
  /** A graph with branching and a shared importer, so ordering actually matters. */
  const build = () =>
    graphWith(new Map([
      ['a.ts', [statement('./b')]],
      ['b.ts', [statement('./c'), statement('./d')]],
      ['c.ts', []],
      ['d.ts', []],
    ]))

  it('produces identical results for repeated runs', () => {
    // The product's credibility rests on the same repository always yielding the
    // same graph, so a set that varied between runs would be a real defect.
    const first = traceImpact(build(), ['c.ts', 'd.ts'])
    const second = traceImpact(build(), ['c.ts', 'd.ts'])

    expect([...second.affected]).toEqual([...first.affected])
    expect([...second.distance]).toEqual([...first.distance])
    expect([...second.pathTo]).toEqual([...first.pathTo])
  })

  it('does not depend on the order files are marked in', () => {
    const forwards = traceImpact(build(), ['c.ts', 'd.ts'])
    const backwards = traceImpact(build(), ['d.ts', 'c.ts'])

    expect(backwards.changed).toEqual(forwards.changed)
    expect([...backwards.distance]).toEqual([...forwards.distance])
  })
})
