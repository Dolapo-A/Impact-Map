import { describe, expect, it } from 'vitest'

import { layoutSpatial, spreadOf } from '../src/lib/spatial.ts'

const nodes = (ids: string[]) => ids.map((id) => ({ id }))

describe('layoutSpatial', () => {
  it('is deterministic — same input, same positions', () => {
    const input = nodes(['a.ts', 'b.ts', 'c.ts'])
    const edges = [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'c.ts', isExternal: false },
    ]
    expect(layoutSpatial(input, edges)).toEqual(layoutSpatial(input, edges))
  })

  it('places every node exactly once', () => {
    const laid = layoutSpatial(nodes(['a.ts', 'b.ts', 'c.ts']), [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
    ])
    expect(laid).toHaveLength(3)
    expect(new Set(laid.map((node) => node.id)).size).toBe(3)
  })

  it('ignores the order nodes are supplied in', () => {
    const edges = [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'c.ts', isExternal: false },
    ]
    const forwards = layoutSpatial(nodes(['a.ts', 'b.ts', 'c.ts']), edges)
    const backwards = layoutSpatial(nodes(['c.ts', 'b.ts', 'a.ts']), edges)
    expect(backwards).toEqual(forwards)
  })

  it('keeps the files in three dimensions rather than in a plane', () => {
    const laid = layoutSpatial(
      nodes(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts']),
      [
        { from: 'b.ts', to: 'a.ts', isExternal: false },
        { from: 'c.ts', to: 'b.ts', isExternal: false },
        { from: 'd.ts', to: 'c.ts', isExternal: false },
        { from: 'e.ts', to: 'd.ts', isExternal: false },
        { from: 'f.ts', to: 'e.ts', isExternal: false },
      ],
    )

    const depths = new Set(laid.map((node) => Math.round(node.position.z)))
    expect(depths.size).toBeGreaterThan(2)
  })

  it('keeps every file a readable distance from every other', () => {
    const laid = layoutSpatial(
      nodes(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts', 'g.ts']),
      [
        { from: 'b.ts', to: 'a.ts', isExternal: false },
        { from: 'c.ts', to: 'b.ts', isExternal: false },
        { from: 'd.ts', to: 'c.ts', isExternal: false },
        { from: 'e.ts', to: 'd.ts', isExternal: false },
        { from: 'f.ts', to: 'e.ts', isExternal: false },
        { from: 'g.ts', to: 'f.ts', isExternal: false },
      ],
    )

    for (let first = 0; first < laid.length; first++) {
      for (let second = first + 1; second < laid.length; second++) {
        const a = laid[first].position
        const b = laid[second].position
        const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
        expect(distance, `${laid[first].id} and ${laid[second].id}`).toBeGreaterThan(60)
      }
    }
  })

  it('lays out a cyclic graph without hanging', () => {
    const laid = layoutSpatial(nodes(['a.ts', 'b.ts', 'c.ts']), [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'c.ts', isExternal: false },
      { from: 'c.ts', to: 'a.ts', isExternal: false },
    ])
    expect(laid).toHaveLength(3)
  })

  it('returns nothing for an empty graph', () => {
    expect(layoutSpatial([], [])).toEqual([])
  })
})
