import { describe, expect, it } from 'vitest'

import { layoutGraphPhysics, MIN_NODE_DISTANCE } from '../src/lib/physics.ts'
import { boxAt, boxesOverlap } from '../src/lib/geometry.ts'

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

  /**
   * The reason the cards are rectangles rather than points.
   *
   * Two files side by side are 176 pixels wide. Treating them as dots and
   * keeping them a hundred pixels apart puts one file's name on top of
   * another's, which is what a force layout of wide cards always does.
   */
  it('never puts two cards on top of each other', () => {
    const laid = layoutGraphPhysics(
      nodes(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts']),
      [
        { from: 'b.ts', to: 'a.ts', isExternal: false },
        { from: 'c.ts', to: 'b.ts', isExternal: false },
        { from: 'd.ts', to: 'c.ts', isExternal: false },
        { from: 'e.ts', to: 'd.ts', isExternal: false },
        { from: 'f.ts', to: 'e.ts', isExternal: false },
      ],
    )

    const boxes = laid.map((node) => boxAt(node.position))
    for (let first = 0; first < boxes.length; first++) {
      for (let second = first + 1; second < boxes.length; second++) {
        expect(
          boxesOverlap(boxes[first], boxes[second]),
          `${laid[first].id} overlaps ${laid[second].id}`,
        ).toBe(false)
      }
    }
  })
})
