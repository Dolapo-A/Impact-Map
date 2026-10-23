import { describe, expect, it } from 'vitest'

import { NODE_GAP, NODE_HEIGHT, NODE_WIDTH, boxAt, boxesOverlap, overlap } from '../src/lib/geometry.ts'

describe('the card', () => {
  it('is the same size every time, which is what lets files be placed', () => {
    const a = boxAt({ x: 0, y: 0 })
    const b = boxAt({ x: 500, y: 500 })
    expect(a.width).toBe(NODE_WIDTH)
    expect(a.height).toBe(NODE_HEIGHT)
    expect(b.width).toBe(NODE_WIDTH)
    expect(b.height).toBe(NODE_HEIGHT)
  })

  it('keeps a gap between two cards', () => {
    expect(NODE_GAP).toBeGreaterThan(0)
  })
})

describe('boxesOverlap', () => {
  it('sees two cards that share space', () => {
    expect(boxesOverlap(boxAt({ x: 0, y: 0 }), boxAt({ x: 10, y: 10 }))).toBe(true)
  })

  it('does not see two cards that are apart', () => {
    expect(boxesOverlap(boxAt({ x: 0, y: 0 }), boxAt({ x: 500, y: 500 }))).toBe(false)
  })

  it('does not see two cards that only touch', () => {
    expect(boxesOverlap(boxAt({ x: 0, y: 0 }), boxAt({ x: NODE_WIDTH, y: 0 }))).toBe(false)
  })
})

describe('overlap', () => {
  it('measures how far two cards reach into each other', () => {
    const result = overlap(boxAt({ x: 0, y: 0 }), boxAt({ x: 100, y: 100 }))
    expect(result.x).toBe(NODE_WIDTH - 100)
    expect(result.y).toBe(NODE_HEIGHT - 100)
  })

  it('reports no overlap along an axis that is clear', () => {
    const result = overlap(boxAt({ x: 0, y: 0 }), boxAt({ x: 500, y: 10 }))
    expect(result.x).toBeLessThan(0)
    expect(result.y).toBeGreaterThan(0)
  })
})
