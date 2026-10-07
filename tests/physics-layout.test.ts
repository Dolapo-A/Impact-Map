import { describe, expect, it } from 'vitest'

import { layoutGraphPhysics, MIN_NODE_DISTANCE } from '../src/lib/physics.ts'

const nodes = (ids: string[]) => ids.map((id) => ({ id }))

describe('layoutGraph', () => {
  it('is deterministic — same input, same positions', () => {
    const input = nodes(['a.ts', 'b.ts', 'c.ts'])
    const edges = [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'c.ts', isExternal: false },
    ]
    expect(layoutGraphPhysics(input, edges)).toEqual(layoutGraphPhysics(input, edges))
  })

  it('places every node exactly once', () => {
    const laid = layoutGraphPhysics(nodes(['a.ts', 'b.ts', 'c.ts']), [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
    ])
    expect(laid).toHaveLength(3)
    expect(new Set(laid.map((node) => node.id)).size).toBe(3)
  })

  it('spreads unconnected nodes instead of stacking them in a column', () => {
    const laid = layoutGraphPhysics(nodes(['a.ts', 'b.ts']), [])
    expect(laid[0].position).not.toEqual(laid[1].position)
  })

  it('keeps file-node centres apart by the collision floor', () => {
    const laid = layoutGraphPhysics(nodes(['a.ts', 'b.ts', 'c.ts', 'd.ts']), [])
    for (let first = 0; first < laid.length; first++) {
      for (let second = first + 1; second < laid.length; second++) {
        expect(
          Math.hypot(
            laid[first].position.x - laid[second].position.x,
            laid[first].position.y - laid[second].position.y,
          ),
        ).toBeGreaterThanOrEqual(MIN_NODE_DISTANCE - 2)
      }
    }
  })

  it('lays out a cyclic graph without hanging', () => {
    const laid = layoutGraphPhysics(nodes(['a.ts', 'b.ts', 'c.ts']), [
      { from: 'a.ts', to: 'b.ts', isExternal: false },
      { from: 'b.ts', to: 'c.ts', isExternal: false },
      { from: 'c.ts', to: 'a.ts', isExternal: false },
    ])
    expect(laid).toHaveLength(3)
  })
})
