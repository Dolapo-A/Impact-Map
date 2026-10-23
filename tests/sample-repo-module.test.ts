import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

import { shouldIncludeFile } from '../src/lib/files.ts'
import { sampleCoverage, sampleEdges, sampleGraph, sampleTrace } from '../src/lib/sampleRepo.ts'

const SAMPLE_REPO = join(import.meta.dirname, '..', 'sample-repo')

/**
 * The in-memory description of the sample repository, checked against the
 * repository on disk.
 *
 * The landing page shows the sample repository as the tool would draw it, so
 * the description it draws from has to be the real one. This reads the actual
 * files and compares the import list, so the page cannot quietly drift away
 * from the repository it claims to be showing.
 */
function readRealImports(): Map<string, string[]> {
  const imports = new Map<string, string[]>()

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }

      const path = relative(SAMPLE_REPO, full)
      if (!shouldIncludeFile(path)) continue

      const source = readFileSync(full, 'utf8')
      const specifiers: string[] = []

      // The parser is the real one, so the comparison is against the same
      // reading of the file the tool makes.
      for (const match of source.matchAll(/from\s+['"](\.[^'"]*)['"]/g)) {
        specifiers.push(match[1])
      }

      imports.set(path, specifiers)
    }
  }

  walk(SAMPLE_REPO)
  return imports
}

describe('the sample repository, described in memory', () => {
  it('has the files the bundled repository has', () => {
    const paths = sampleGraph().nodes.map((node) => node.path).sort()
    expect(paths).toEqual([
      'src/api/orders.test.ts',
      'src/api/orders.ts',
      'src/components/CartBadge.tsx',
      'src/domain/reservations.ts',
      'src/index.ts',
      'src/state/selectors.ts',
      'src/utils/cart.test.ts',
      'src/utils/cart.ts',
      'src/utils/format.test.ts',
      'src/utils/format.ts',
      'src/utils/totals.test.ts',
      'src/utils/totals.ts',
    ])
  })

  it('has the same files as the repository on disk', () => {
    const onDisk = [...readRealImports().keys()].sort()
    const described = sampleGraph()
      .nodes.map((node) => node.path)
      .sort()

    expect(described).toEqual(onDisk)
  })

  it('keeps the circular import between cart and totals', () => {
    const edges = sampleEdges()
    const forward = edges.find(
      (edge) => edge.from === 'src/utils/cart.ts' && edge.to === 'src/utils/totals.ts',
    )
    const back = edges.find(
      (edge) => edge.from === 'src/utils/totals.ts' && edge.to === 'src/utils/cart.ts',
    )
    expect(forward).toBeDefined()
    expect(back).toBeDefined()
  })

  it('reaches the whole repository from a change to cart.ts', () => {
    const trace = sampleTrace(['src/utils/cart.ts'])
    expect(trace.affected.has('src/index.ts')).toBe(true)
    expect(trace.affected.has('src/components/CartBadge.tsx')).toBe(true)
    expect(trace.changed.has('src/utils/cart.ts')).toBe(true)
  })

  it('reaches only two files from a change to selectors.ts', () => {
    const trace = sampleTrace(['src/state/selectors.ts'])
    expect([...trace.affected].sort()).toEqual([
      'src/components/CartBadge.tsx',
      'src/index.ts',
    ])
  })

  it('records the shortest chain back to the change', () => {
    const trace = sampleTrace(['src/utils/cart.ts'])
    expect(trace.pathTo.get('src/components/CartBadge.tsx')).toEqual([
      'src/utils/cart.ts',
      'src/state/selectors.ts',
      'src/components/CartBadge.tsx',
    ])
  })

  it('knows which files nothing tests', () => {
    const coverage = sampleCoverage()
    // A test imports cart.ts, so something reaches it.
    expect(coverage.get('src/utils/cart.ts')?.length).toBeGreaterThan(0)
    // Nothing imports selectors.ts from a test, so nothing reaches it.
    expect(coverage.get('src/state/selectors.ts')).toBeUndefined()
  })
})
