import { describe, expect, it } from 'vitest'

import { buildGraph, type SourceFile } from '../src/lib/graph.ts'
import { findCoverage } from '../src/lib/coverage.ts'
import { traceImpact } from '../src/lib/trace.ts'
import { describeVolume } from '../src/lib/volume.ts'
import type { ImportStatement } from '../src/lib/parser.ts'

const statement = (specifier: string): ImportStatement => ({
  specifier,
  line: 1,
  kind: 'static',
})

/**
 * A small repository with the shape the tool is built around: one file that
 * everything imports, a cycle, and one file nothing tests.
 */
const files: SourceFile[] = [
  'src/cart.ts',
  'src/totals.ts',
  'src/selectors.ts',
  'src/untested.ts',
  'src/cart.test.ts',
].map((path) => ({ path, content: '' }))

const repoFiles = new Set(files.map((file) => file.path))
const graph = buildGraph({
  files,
  importsByPath: new Map([
    ['src/cart.ts', [statement('./totals')]],
    ['src/totals.ts', [statement('./cart')]],
    ['src/selectors.ts', [statement('./cart'), statement('./untested')]],
    ['src/untested.ts', []],
    ['src/cart.test.ts', [statement('./cart')]],
  ]),
  repoFiles,
  resolve: (specifier) => `src/${specifier.replace('./', '')}.ts`,
})

const coverage = findCoverage(graph)

describe('describeVolume', () => {
  it('shows every file in the repository, plus the packages outside it', () => {
    const volume = describeVolume({
      graph,
      coverage,
      changedPaths: new Set(),
      traceResult: null,
    })
    expect(volume.nodes.map((node) => node.path).sort()).toEqual([
      'src/cart.test.ts',
      'src/cart.ts',
      'src/selectors.ts',
      'src/totals.ts',
      'src/untested.ts',
    ])
  })

  it('draws a line for every import', () => {
    const volume = describeVolume({
      graph,
      coverage,
      changedPaths: new Set(),
      traceResult: null,
    })
    expect(volume.edges).toHaveLength(graph.edges.length)
  })

  it('marks the file the user changed, and the ones the change reaches', () => {
    const trace = traceImpact(graph, new Set(['src/cart.ts']))
    const volume = describeVolume({
      graph,
      coverage,
      changedPaths: new Set(['src/cart.ts']),
      traceResult: trace,
    })

    const stateOf = (path: string) =>
      volume.nodes.find((node) => node.path === path)?.state

    expect(stateOf('src/cart.ts')).toBe('changed')
    expect(stateOf('src/selectors.ts')).toBe('affected')
    expect(stateOf('src/untested.ts')).toBe('untouched')
  })

  it('sends the reached files out from the change, nearest ring first', () => {
    const trace = traceImpact(graph, new Set(['src/cart.ts']))
    const volume = describeVolume({
      graph,
      coverage,
      changedPaths: new Set(['src/cart.ts']),
      traceResult: trace,
    })

    const changed = volume.nodes.find((node) => node.path === 'src/cart.ts')!
    const reached = volume.nodes.find((node) => node.path === 'src/selectors.ts')!

    // A reached file starts part of the way back towards the change, so it
    // always travels outward from it.
    const towardsChange = Math.hypot(
      reached.from.x - changed.position.x,
      reached.from.y - changed.position.y,
      reached.from.z - changed.position.z,
    )
    const total = Math.hypot(
      reached.position.x - changed.position.x,
      reached.position.y - changed.position.y,
      reached.position.z - changed.position.z,
    )
    expect(towardsChange).toBeLessThan(total)

    // The nearest ring starts first: the change itself is ring zero, and the
    // files it reaches follow.
    expect(changed.delayMs).toBe(0)
    expect(reached.delayMs).toBeGreaterThan(changed.delayMs)
  })

  it('keeps the two coverage channels apart', () => {
    const volume = describeVolume({
      graph,
      coverage,
      changedPaths: new Set(),
      traceResult: null,
    })

    const coverageOf = (path: string) =>
      volume.nodes.find((node) => node.path === path)?.coverage

    // A test file needs no test of its own.
    expect(coverageOf('src/cart.test.ts')).toBe('none')
    // Nothing imports untested.ts, so nothing tests it.
    expect(coverageOf('src/untested.ts')).toBe('uncovered')
    // cart.test.ts imports cart.ts.
    expect(coverageOf('src/cart.ts')).toBe('covered')
  })

  it('puts the packages outside the repository beside the cloud, not in it', () => {
    const withExternal = buildGraph({
      files: ['src/cart.ts'].map((path) => ({ path, content: '' })),
      importsByPath: new Map([['src/cart.ts', [statement('react')]]]),
      repoFiles: new Set(['src/cart.ts']),
      resolve: () => null,
    })

    const volume = describeVolume({
      graph: withExternal,
      coverage: findCoverage(withExternal),
      changedPaths: new Set(),
      traceResult: null,
    })

    const external = volume.nodes.find((node) => node.state === 'external')!
    const internal = volume.nodes.find((node) => node.state === 'untouched')!

    expect(external).toBeDefined()

    // The package sits outside the cloud, on the far side of every real file.
    const fromCentre = (node: { position: { x: number; y: number; z: number } }) =>
      Math.hypot(
        node.position.x - volume.centre.x,
        node.position.y - volume.centre.y,
        node.position.z - volume.centre.z,
      )

    expect(fromCentre(external)).toBeGreaterThan(fromCentre(internal))
    expect(fromCentre(external)).toBeGreaterThan(100)
  })

  it('is deterministic — the same graph gives the same volume', () => {
    const input = { graph, coverage, changedPaths: new Set<string>(), traceResult: null }
    expect(describeVolume(input)).toEqual(describeVolume(input))
  })
})
