import { describe, expect, it } from 'vitest'

import { MORPH_MS, easeOutCubic, interpolatePositions, prefersReducedMotion } from '../src/lib/morph.ts'

const point = (x: number, y: number) => ({ x, y })

describe('easeOutCubic', () => {
  it('starts at the beginning and ends at the end', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })

  it('holds still outside the range rather than overshooting', () => {
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })

  it('leaves quickly and settles slowly', () => {
    // Halfway through the movement, more than half the distance is already
    // covered. A linear tween would be exactly halfway, which reads as
    // mechanical.
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5)
  })
})

describe('interpolatePositions', () => {
  const from = new Map([
    ['a.ts', point(0, 0)],
    ['b.ts', point(100, 50)],
  ])
  const to = new Map([
    ['a.ts', point(300, 200)],
    ['b.ts', point(500, 250)],
  ])

  it('starts where the files were', () => {
    const next = interpolatePositions(from, to, 0)
    expect(next.get('a.ts')).toEqual({ x: 0, y: 0 })
    expect(next.get('b.ts')).toEqual({ x: 100, y: 50 })
  })

  it('ends where the files are going', () => {
    const next = interpolatePositions(from, to, 1)
    expect(next.get('a.ts')).toEqual({ x: 300, y: 200 })
    expect(next.get('b.ts')).toEqual({ x: 500, y: 250 })
  })

  it('passes through the space in between', () => {
    const next = interpolatePositions(from, to, 0.5)
    const middle = next.get('a.ts')!
    expect(middle.x).toBeGreaterThan(0)
    expect(middle.x).toBeLessThan(300)
    expect(middle.y).toBeGreaterThan(0)
    expect(middle.y).toBeLessThan(200)
  })

  it('places a file that has never been seen where it belongs', () => {
    // A file that only exists in the new layout has no journey to make, so it
    // appears rather than flying in from somewhere meaningless.
    const next = interpolatePositions(from, to, 0)
    expect(next.get('a.ts')).toEqual({ x: 0, y: 0 })
    expect(interpolatePositions(new Map(), to, 0).get('a.ts')).toEqual({ x: 300, y: 200 })
  })

  it('keeps every file that the new layout has', () => {
    const next = interpolatePositions(from, to, 0.5)
    expect([...next.keys()].sort()).toEqual(['a.ts', 'b.ts'])
  })
})

describe('the movement', () => {
  it('is long enough to follow, and short enough to repeat', () => {
    expect(MORPH_MS).toBeGreaterThan(300)
    expect(MORPH_MS).toBeLessThan(1200)
  })

  it('does not move anything when the reader has asked for less motion', () => {
    // The function is safe to call with no browser around it.
    expect(typeof prefersReducedMotion()).toBe('boolean')
  })
})
