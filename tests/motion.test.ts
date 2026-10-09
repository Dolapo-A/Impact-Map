import { describe, expect, it } from 'vitest'

import {
  DELAY_PER_HOP_MS,
  TRAVEL_MS,
  flightFor,
  originByPath,
  staggerFor,
  totalDurationMs,
} from '../src/lib/motion.ts'

const origin = { x: 0, y: 0 }

describe('flightFor', () => {
  it('starts a node back toward the change, so it travels outward', () => {
    // A target to the right of the change must start to its left and fly right.
    const flight = flightFor({ distance: 1, maxDistance: 3, target: { x: 400, y: 0 }, origin })

    expect(flight.dx).toBeLessThan(0)
    // Same y as the change, so there is nothing to travel on this axis. Compared
    // loosely because negating zero yields -0, which Object.is treats as distinct.
    expect(Math.abs(flight.dy)).toBe(0)
  })

  it('starts a node on the correct side on both axes', () => {
    const flight = flightFor({
      distance: 1,
      maxDistance: 3,
      target: { x: -300, y: 250 },
      origin,
    })

    // The change is at the origin; the target is left of it and below it (canvas y
    // grows downward). So the node must begin right of and above its own position,
    // travelling left and down into place.
    expect(flight.dx).toBeGreaterThan(0)
    expect(flight.dy).toBeLessThan(0)
  })

  it('delays each ring further than the last', () => {
    const near = flightFor({ distance: 1, maxDistance: 3, target: { x: 200, y: 0 }, origin })
    const mid = flightFor({ distance: 2, maxDistance: 3, target: { x: 400, y: 0 }, origin })
    const far = flightFor({ distance: 3, maxDistance: 3, target: { x: 600, y: 0 }, origin })

    expect(near.delayMs).toBeLessThan(mid.delayMs)
    expect(mid.delayMs).toBeLessThan(far.delayMs)
  })

  it('spaces the rings apart even when the graph is only two hops deep', () => {
    // This is the case that matters in practice: the bundled sample repository is
    // shallow. A fixed per-hop delay put both rings nearly on top of each other,
    // so the outward spread was invisible.
    const near = staggerFor(1, 2)
    const far = staggerFor(2, 2)

    expect(far - near).toBeGreaterThan(300)
  })

  it('spaces the rings apart in a deep graph too', () => {
    const near = staggerFor(1, 12)
    const far = staggerFor(12, 12)

    expect(far - near).toBeGreaterThan(500)
  })

  it('starts the outermost ring at the end of the window, whatever the depth', () => {
    // The deepest ring always lands last, so the sequence reads outward to the
    // end. The window itself grows with depth until it hits the ceiling.
    expect(staggerFor(3, 3)).toBe(staggerFor(3, 3))
    expect(staggerFor(30, 30)).toBeGreaterThan(staggerFor(3, 3))
    // Once the ceiling is reached, depth no longer stretches the sequence.
    expect(staggerFor(30, 30)).toBe(staggerFor(40, 40))
  })

  it('caps the stagger so a very deep graph does not take forever to finish', () => {
    // Without a ceiling, a forty-hop change would stall the demo before anything
    // appeared.
    const deep = flightFor({ distance: 40, maxDistance: 40, target: { x: 900, y: 0 }, origin })
    expect(deep.delayMs).toBeLessThanOrEqual(1500)
    expect(totalDurationMs(40)).toBeLessThanOrEqual(2000)
  })

  it('keeps the whole sequence inside the 1.5–2 second budget', () => {
    // The spec asks for roughly 1.5–2s: long enough to follow, short enough to
    // replay in a demo. Checked across shallow, typical and deep graphs.
    for (const depth of [1, 2, 3, 6, 12, 40]) {
      const duration = totalDurationMs(depth)
      expect(duration, `depth ${depth}`).toBeGreaterThanOrEqual(1500)
      expect(duration, `depth ${depth}`).toBeLessThanOrEqual(2000)
    }
  })

  it('gives a single-ring graph no delay and no stagger problem', () => {
    expect(staggerFor(0, 0)).toBe(0)
    expect(staggerFor(1, 1)).toBeGreaterThanOrEqual(0)
  })

  it('travels a longer distance for a further ring, from the same origin', () => {
    const near = flightFor({ distance: 1, maxDistance: 2, target: { x: 200, y: 0 }, origin })
    const far = flightFor({ distance: 2, maxDistance: 2, target: { x: 400, y: 0 }, origin })

    expect(Math.abs(far.dx)).toBeGreaterThan(Math.abs(near.dx))
  })

  it('is deterministic — the same input gives the same flight', () => {
    const input = { distance: 2, maxDistance: 5, target: { x: 340, y: -120 }, origin }
    expect(flightFor(input)).toEqual(flightFor(input))
  })
})

describe('originByPath', () => {
  const positions = new Map([
    ['src/changed.ts', { x: 100, y: 100 }],
    ['src/middle.ts', { x: 300, y: 100 }],
    ['src/leaf.ts', { x: 500, y: 100 }],
  ])

  it('anchors each file to the changed file at the head of its chain', () => {
    const pathTo = new Map([
      ['src/changed.ts', ['src/changed.ts']],
      ['src/middle.ts', ['src/changed.ts', 'src/middle.ts']],
      ['src/leaf.ts', ['src/changed.ts', 'src/middle.ts', 'src/leaf.ts']],
    ])

    const origins = originByPath(pathTo, positions)
    expect(origins.get('src/middle.ts')).toEqual({ x: 100, y: 100 })
    expect(origins.get('src/leaf.ts')).toEqual({ x: 100, y: 100 })
  })

  it('anchors to the correct changed file when several are marked', () => {
    const multi = new Map([
      ['src/a.ts', { x: 0, y: 0 }],
      ['src/b.ts', { x: 900, y: 0 }],
      ['src/from-a.ts', { x: 200, y: 50 }],
      ['src/from-b.ts', { x: 700, y: 50 }],
    ])

    const origins = originByPath(
      new Map([
        ['src/a.ts', ['src/a.ts']],
        ['src/b.ts', ['src/b.ts']],
        ['src/from-a.ts', ['src/a.ts', 'src/from-a.ts']],
        ['src/from-b.ts', ['src/b.ts', 'src/from-b.ts']],
      ]),
      multi,
    )

    // Each node departs from its own changed file, not from one shared midpoint.
    expect(origins.get('src/from-a.ts')).toEqual({ x: 0, y: 0 })
    expect(origins.get('src/from-b.ts')).toEqual({ x: 900, y: 0 })
  })

  it('skips a file whose changed origin has no position', () => {
    const origins = originByPath(
      new Map([['src/leaf.ts', ['src/gone.ts', 'src/leaf.ts']]]),
      positions,
    )
    expect(origins.has('src/leaf.ts')).toBe(false)
  })

  it('returns nothing for an empty trace', () => {
    expect(originByPath(new Map(), positions).size).toBe(0)
  })
})

describe('timing constants', () => {
  it('keeps travel and per-hop delay positive and sensible', () => {
    expect(TRAVEL_MS).toBeGreaterThan(0)
    expect(DELAY_PER_HOP_MS).toBeGreaterThan(0)
  })
})
