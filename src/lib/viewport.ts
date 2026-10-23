/**
 * Framing the graph.
 *
 * The canvas is fitted by working out where the files are and what size they
 * are, rather than by asking the graph library to measure the page. Every card
 * is the same size and every position is known, so the frame can be calculated
 * exactly — and the graph still looks right on a machine that is slow to paint.
 *
 * Pure logic, no React, so it can be tested without a browser.
 */
import { NODE_HEIGHT, NODE_WIDTH, type Point } from './geometry'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface FitOptions {
  /** The room left around the graph, as a share of its size. */
  padding?: number
  minZoom?: number
  maxZoom?: number
}

/** The box that contains every file card. */
export function boundsOf(positions: Map<string, Point>): Bounds {
  if (positions.size === 0) return { x: 0, y: 0, width: 0, height: 0 }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of positions.values()) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x + NODE_WIDTH)
    maxY = Math.max(maxY, point.y + NODE_HEIGHT)
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * The camera that frames a set of bounds inside a given size.
 *
 * The graph is fitted by its smaller axis, so the whole thing is always on
 * screen, and the zoom is held between a floor and a ceiling: too small and
 * the file names stop being readable, too large and a two-file repository
 * fills the screen with empty space.
 */
export function fitBounds(
  bounds: Bounds,
  viewportWidth: number,
  viewportHeight: number,
  options: FitOptions = {},
): Viewport {
  const { padding = 0.12, minZoom = 0.3, maxZoom = 1 } = options

  if (
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return { x: 0, y: 0, zoom: 1 }
  }

  const zoom = Math.min(
    maxZoom,
    Math.max(
      minZoom,
      Math.min(
        viewportWidth / (bounds.width * (1 + padding)),
        viewportHeight / (bounds.height * (1 + padding)),
      ),
    ),
  )

  return {
    x: viewportWidth / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: viewportHeight / 2 - (bounds.y + bounds.height / 2) * zoom,
    zoom,
  }
}

/** A camera part of the way from one frame to another. */
export function interpolateViewport(from: Viewport, to: Viewport, t: number): Viewport {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  }
}
