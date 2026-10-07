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

  it('records every test that reaches a file, sorted', () => {
    const twoTests: SourceFile[] = [
      'src/cart.ts',
      'src/totals.test.ts',
      'src/cart.test.ts',
    ].map((path) => ({ path, content: '' }))
    const repo = new Set(twoTests.map((file) => file.path))

    const graph = buildGraph({
      files: twoTests,
      importsByPath: new Map([
        ['src/cart.test.ts', [statement('./cart')]],
        ['src/totals.test.ts', [statement('./cart')]],
        ['src/cart.ts', []],
      ]),
      repoFiles: repo,
      resolve: (specifier) => `src/${specifier.replace('./', '')}.ts`,
    })

    // Sorted so the graph and the detail panel agree run to run.
    expect(findCoverage(graph).get('src/cart.ts')).toEqual([
      'src/cart.test.ts',
      'src/totals.test.ts',
    ])
  })

  it('does not treat a test importing another test as covering it', () => {
    // `totals.test.ts` pulls in `cart.ts`, which is itself a test. Recording that
    // would paint test files blue and imply they are protected by themselves.
    const withTwoTests: SourceFile[] = [
      'src/cart.ts',
      'src/totals.ts',
      'src/reservations.ts',
      'src/cart.test.ts',
      'src/totals.test.ts',
    ].map((path) => ({ path, content: '' }))
    const repo = new Set(withTwoTests.map((file) => file.path))

    const graph = buildGraph({
      files: withTwoTests,
      importsByPath: new Map([
        ['src/totals.test.ts', [statement('./cart.test')]],
        ['src/cart.test.ts', [statement('./cart')]],
        ['src/cart.ts', []],
        ['src/totals.ts', []],
        ['src/reservations.ts', []],
      ]),
      repoFiles: repo,
      resolve: (specifier) => `src/${specifier.replace('./', '')}.ts`,
    })

    const coverage = findCoverage(graph)
    expect(coverage.get('src/cart.test.ts')).toBeUndefined()
    // `totals.test.ts` still reaches `cart.ts` transitively, because running it
    // runs `cart.test.ts`, which imports `cart.ts`. The traversal continues past
    // the test file; only the *recording* of it as covered is suppressed.
    expect(coverage.get('src/cart.ts')).toEqual([
      'src/cart.test.ts',
      'src/totals.test.ts',
    ])
  })

  it('terminates when a test is reachable from a circular import', () => {
    const circular: SourceFile[] = [
      'src/cart.ts',
      'src/totals.ts',
      'src/cart.test.ts',
    ].map((path) => ({ path, content: '' }))
    const repo = new Set(circular.map((file) => file.path))

    const graph = buildGraph({
      files: circular,
      importsByPath: new Map([
        ['src/cart.test.ts', [statement('./cart')]],
        ['src/cart.ts', [statement('./totals')]],
        ['src/totals.ts', [statement('./cart')]],
      ]),
      repoFiles: repo,
      resolve: (specifier) => `src/${specifier.replace('./', '')}.ts`,
    })

    const coverage = findCoverage(graph)
    expect(coverage.get('src/cart.ts')).toEqual(['src/cart.test.ts'])
    expect(coverage.get('src/totals.ts')).toEqual(['src/cart.test.ts'])
  })
})
