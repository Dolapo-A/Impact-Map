/**
 * Moving the graph from one layout to another.
 *
 * Switching between Columns and Physics used to snap every node to its new
 * place at once. The two layouts show the same graph in genuinely different
 * shapes, and watching the files travel between those shapes is what makes the
 * switch legible: you see the same structure reorganise itself, rather than
 * being handed a second picture.
 *
 * Pure logic, no React, so the timing can be tested rather than eyeballed.
 */

export interface Point {
  x: number
  y: number
}

/** How long the whole rearrangement takes. */
export const MORPH_MS = 720

/**
 * Whether the reader has asked for less movement.
 *
 * The morph is the only motion here that cannot be expressed in CSS alone, so
 * it is the one that has to ask. With the preference set, the graph moves
 * straight to its new arrangement.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Exponential ease-out.
 *
 * The nodes leave quickly and settle slowly, which is how a physical
 * rearrangement actually reads. A linear tween makes the middle of the
 * movement feel mechanical.
 */
export function easeOutCubic(t: number): number {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t
  return 1 - Math.pow(1 - clamped, 3)
}

/**
 * The positions at a point along the morph.
 *
 * A node that has no previous position — one that only exists in the new
 * layout — starts where it is going, so it appears rather than flies in from
 * somewhere meaningless.
 */
export function interpolatePositions(
  from: Map<string, Point>,
  to: Map<string, Point>,
  t: number,
): Map<string, Point> {
  const eased = easeOutCubic(t)
  const next = new Map<string, Point>()

  for (const [id, target] of to) {
    const origin = from.get(id)
    next.set(
      id,
      origin
        ? {
            x: origin.x + (target.x - origin.x) * eased,
            y: origin.y + (target.y - origin.y) * eased,
          }
        : { x: target.x, y: target.y },
    )
  }

  return next
}
