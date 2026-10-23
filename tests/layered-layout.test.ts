import { describe, it, expect } from 'vitest'

import { computeDepths, layoutGraphLayered } from '../src/lib/layered.ts'

const nodes = (ids: string[]) => ids.map((id) => ({ id }))

describe('computeDepths', () => {
  it('puts files with no internal imports at depth 0', () => {
    const depths = computeDepths(nodes(['a.ts']), [])
    expect(depths.get('a.ts')).toBe(0)
  })

  it('places an importer one level deeper than what it imports', () => {
    // a imports b, b imports c: c is deepest.
    const depths = computeDepths(nodes(['a.ts', 'b.ts', 'c.ts']), [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'c.ts', isExternal: false },
    ])
    expect(depths.get('c.ts')).toBe(0)
    expect(depths.get('b.ts')).toBe(1)
    expect(depths.get('a.ts')).toBe(2)
  })

  it('gives both files in a two-file cycle the same depth', () => {
    // Neither is deeper than the other — they are mutually dependent.
    const depths = computeDepths(nodes(['a.ts', 'b.ts']), [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'a.ts', isExternal: false },
    ])
    expect(depths.get('a.ts')).toBe(depths.get('b.ts'))
  })

  it('does not let a cycle inflate depths pass after pass', () => {
    // A self-feeding pair must not drift further apart on every relaxation.
    // This is the bug that spread the layout dozens of columns wide.
    const depths = computeDepths(nodes(['cart.ts', 'totals.ts']), [
      { from: 'cart.ts', to: 'totals.ts', isExternal: false },
      { from: 'totals.ts', to: 'cart.ts', isExternal: false },
    ])
    expect(Math.max(...depths.values())).toBeLessThan(4)
  })

  it('places a file that imports a cycle one level deeper than the cycle', () => {
    // checkout.ts imports cart.ts, which is in a cycle with totals.ts.
    const depths = computeDepths(nodes(['checkout.ts', 'cart.ts', 'totals.ts']), [
      { from: 'checkout.ts', to: 'cart.ts', isExternal: false },
      { from: 'cart.ts', to: 'totals.ts', isExternal: false },
      { from: 'totals.ts', to: 'cart.ts', isExternal: false },
    ])
    const cycleDepth = depths.get('cart.ts')
    expect(depths.get('totals.ts')).toBe(cycleDepth)
    expect(depths.get('checkout.ts')).toBe(cycleDepth! + 1)
  })

  it('terminates on a circular import instead of looping forever', () => {
    const depths = computeDepths(nodes(['a.ts', 'b.ts']), [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'a.ts', isExternal: false },
    ])
    expect(depths.get('a.ts')).toBeGreaterThanOrEqual(0)
    expect(depths.get('b.ts')).toBeGreaterThanOrEqual(0)
  })

  it('ignores external edges when computing depth', () => {
    const depths = computeDepths(nodes(['a.ts']), [
      { from: 'a.ts', to: 'react', isExternal: true },
    ])
    expect(depths.get('a.ts')).toBe(0)
  })

  it('ignores an edge pointing at a file that is not in the graph', () => {
    const depths = computeDepths(nodes(['a.ts']), [
      { from: 'a.ts', to: 'missing.ts', isExternal: false },
    ])
    expect(depths.get('a.ts')).toBe(0)
  })
})

describe('layoutGraph', () => {
  it('is deterministic — same input, same positions', () => {
    const input = nodes(['a.ts', 'b.ts', 'c.ts'])
    const edges = [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'c.ts', isExternal: false },
    ]
    expect(layoutGraphLayered(input, edges)).toEqual(layoutGraphLayered(input, edges))
  })

  it('places every node exactly once', () => {
    const laid = layoutGraphLayered(nodes(['a.ts', 'b.ts', 'c.ts']), [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
    ])
    expect(laid).toHaveLength(3)
    expect(new Set(laid.map((n) => n.id)).size).toBe(3)
  })

  it('gives nodes at the same depth the same x coordinate', () => {
    const laid = layoutGraphLayered(nodes(['a.ts', 'b.ts']), [])
    expect(laid[0].position.x).toBe(laid[1].position.x)
    expect(laid[0].position.y).not.toBe(laid[1].position.y)
  })

  it('lays out a cyclic graph without hanging', () => {
    const laid = layoutGraphLayered(nodes(['a.ts', 'b.ts', 'c.ts']), [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'c.ts', isExternal: false },
      { from: 'c.ts', to: 'a.ts', isExternal: false },
    ])
    expect(laid).toHaveLength(3)
  })

  /**
   * Files that are connected are placed next to each other.
   *
   * Sorting a column by name scatters connected files through it, and the
   * edges between them cross the whole column. The ordering pass exists to
   * stop that, and this is the case it exists for: naming the two importers
   * the other way round is exactly what a name sort would produce, and the
   * edges would cross.
   */
  it('keeps connected files next to each other in a column', () => {
    const laid = layoutGraphLayered(nodes(['a.ts', 'b.ts', 'x.ts', 'y.ts']), [
      { from: 'x.ts', to: 'b.ts', isExternal: false },
      { from: 'y.ts', to: 'a.ts', isExternal: false },
    ])

    const rowOf = new Map(laid.map((node) => [node.id, node.position.y]))
    const column = laid.filter((node) => node.position.x === laid.find((n) => n.id === 'x.ts')!.position.x)

    // y.ts imports a.ts, which sits above b.ts. So y.ts belongs above x.ts.
    const y = column.findIndex((node) => node.id === 'y.ts')
    const x = column.findIndex((node) => node.id === 'x.ts')
    expect(y).toBeLessThan(x)
    expect(rowOf.get('y.ts')).toBeLessThan(rowOf.get('x.ts')!)
  })
})