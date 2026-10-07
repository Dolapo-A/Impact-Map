import { describe, expect, it } from 'vitest'

import { findCoverage } from '../src/lib/coverage.ts'
import { buildGraph, type SourceFile } from '../src/lib/graph.ts'
import type { ImportStatement } from '../src/lib/parser.ts'

const files: SourceFile[] = [
  'src/cart.ts',
  'src/totals.ts',
  'src/reservations.ts',
  'src/cart.test.ts',
].map((path) => ({ path, content: '' }))
const repoFiles = new Set(files.map((file) => file.path))
const statement = (specifier: string): ImportStatement => ({ specifier, line: 1, kind: 'static' })

function graphWith(importsByPath: Map<string, ImportStatement[]>) {
  return buildGraph({
    files,
    importsByPath,
    repoFiles,
    resolve: (specifier) => `src/${specifier.replace('./', '')}.ts`,
  })
}

describe('findCoverage', () => {
  it('marks a source file covered when a test imports it directly', () => {
    const coverage = findCoverage(graphWith(new Map([
      ['src/cart.test.ts', [statement('./cart')]],
      ['src/cart.ts', []],
      ['src/totals.ts', []],
      ['src/reservations.ts', []],
    ])))

    expect(coverage.get('src/cart.ts')).toEqual(['src/cart.test.ts'])
  })

  it('leaves a source file uncovered when no test reaches it', () => {
    const coverage = findCoverage(graphWith(new Map([
      ['src/cart.test.ts', [statement('./cart')]],
      ['src/cart.ts', []],
      ['src/totals.ts', []],
      ['src/reservations.ts', []],
    ])))

    expect(coverage.get('src/reservations.ts')).toBeUndefined()
  })

  it('follows imports transitively from a test', () => {
    const coverage = findCoverage(graphWith(new Map([
      ['src/cart.test.ts', [statement('./cart')]],
      ['src/cart.ts', [statement('./totals')]],
      ['src/totals.ts', []],
      ['src/reservations.ts', []],
    ])))

    expect(coverage.get('src/totals.ts')).toEqual(['src/cart.test.ts'])
  })
})
