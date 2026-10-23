import { describe, expect, it } from 'vitest'

import {
  boundsOf,
  fitBounds,
  interpolateViewport,
  type Bounds,
} from '../src/lib/viewport.ts'
import { NODE_HEIGHT, NODE_WIDTH } from '../src/lib/geometry.ts'

const positions = new Map([
  ['a.ts', { x: 0, y: 0 }],
  ['b.ts', { x: 500, y: 300 }],
])

describe('boundsOf', () => {
  it('contains every card, not just its corner', () => {
    const bounds = boundsOf(positions)
    expect(bounds.x).toBe(0)
    expect(bounds.y).toBe(0)
    expect(bounds.width).toBe(500 + NODE_WIDTH)
    expect(bounds.height).toBe(300 + NODE_HEIGHT)
  })

  it('has nothing to frame when there are no files', () => {
    expect(boundsOf(new Map())).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('fitBounds', () => {
  const bounds: Bounds = { x: 0, y: 0, width: 1000, height: 500 }

  it('frames the whole graph inside the canvas', () => {
    const viewport = fitBounds(bounds, 800, 600, { padding: 0, minZoom: 0.1, maxZoom: 2 })
    // The graph is twice as wide as the canvas, so it has to shrink to fit.
    expect(viewport.zoom).toBeLessThan(1)
    const right = (bounds.x + bounds.width) * viewport.zoom + viewport.x
    expect(right).toBeLessThanOrEqual(800)
    expect(viewport.x).toBeGreaterThanOrEqual(-1)
  })

  it('puts the middle of the graph in the middle of the canvas', () => {
    const viewport = fitBounds(bounds, 800, 600, { padding: 0, minZoom: 0.1, maxZoom: 2 })
    const centre = (bounds.x + bounds.width / 2) * viewport.zoom + viewport.x
    expect(Math.abs(centre - 400)).toBeLessThan(0.01)
  })

  it('keeps the zoom between the floor and the ceiling', () => {
    // A two-file repository should not fill the screen, and a large one should
    // not shrink until the names stop being readable.
    const tiny = fitBounds({ x: 0, y: 0, width: 10, height: 10 }, 800, 600, {
      minZoom: 0.3,
      maxZoom: 1,
    })
    expect(tiny.zoom).toBe(1)

    const huge = fitBounds({ x: 0, y: 0, width: 100000, height: 100000 }, 800, 600, {
      minZoom: 0.3,
      maxZoom: 1,
    })
    expect(huge.zoom).toBe(0.3)
  })

  it('falls back to a plain view when there is nothing to frame', () => {
    expect(fitBounds({ x: 0, y: 0, width: 0, height: 0 }, 800, 600)).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    })
    expect(fitBounds(bounds, 0, 0)).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

describe('interpolateViewport', () => {
  it('starts at one frame and ends at the other', () => {
    const from = { x: 0, y: 0, zoom: 1 }
    const to = { x: 100, y: 50, zoom: 0.5 }
    expect(interpolateViewport(from, to, 0)).toEqual(from)
    expect(interpolateViewport(from, to, 1)).toEqual(to)
  })

  it('passes through the space in between', () => {
    const middle = interpolateViewport(
      { x: 0, y: 0, zoom: 1 },
      { x: 100, y: 50, zoom: 0.5 },
      0.5,
    )
    expect(middle.x).toBeCloseTo(50)
    expect(middle.zoom).toBeCloseTo(0.75)
  })
})
