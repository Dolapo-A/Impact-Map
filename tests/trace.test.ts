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
