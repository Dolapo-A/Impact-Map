/**
 * The outward expansion: where each node comes from, and when.
 *
 * Pure logic, no React, so the timing can be tested rather than eyeballed. The
 * spec's requirement is specific — nodes closest to the change move first and
 * fastest, each ring follows with a short delay, and the whole sequence runs
 * roughly 1.5–2 seconds.
 */
import type { Flight } from '../components/FileNode'

/** Delay added per hop from the change. This is what staggers the rings. */
export const DELAY_PER_HOP_MS = 130

/** How long one node takes to travel once it starts. */
export const TRAVEL_MS = 420

/**
 * Ceiling on the stagger, so a repository twenty hops deep does not produce a
 * thirty-second animation. Past this depth the rings arrive together rather than
 * spread out over an unreadable length of time. Must stay above `MIN_STAGGER_MS`,
 * or the ceiling silently clamps the floor back to nothing.
 */
const MAX_STAGGER_MS = 1500

/**
 * Floor on the stagger.
 *
 * A typical change is only two or three hops deep, and at a plain per-hop delay
 * that finished in well under a second — too quick to read, and it would not match
 * the 1.5–2s the spec asks for. Holding a minimum stagger keeps even a shallow
 * graph at a followable pace: the rings are further apart in time, not the travel
 * slower, so the sense of outward spread survives.
 */
const MIN_STAGGER_MS = 1250

/**
 * How far back along the path a node starts, as a fraction of its distance to
 * the change. Less than 1 leaves a gap between rings so the outward direction
 * stays readable; the node always travels *from* the change *outward*.
 */
const START_FRACTION = 0.45

export interface FlightInput {
  /** The file's hop distance from the nearest changed file. */
  distance: number
  /** The deepest ring in this graph, so the stagger can fill the available window. */
  maxDistance: number
  /** The file's settled position in the chosen layout. */
  target: { x: number; y: number }
  /** Position of the changed file this node traces back to. */
  origin: { x: number; y: number }
}

/**
 * The delay before a given ring starts.
 *
 * The total stagger window is fixed, and the per-hop delay is derived by dividing
 * it across however many rings the graph actually has. That is what keeps a
 * two-hop graph readable: with a fixed per-hop delay its two rings would land
 * almost together, and the outward spread — the whole point of the animation —
 * would be gone. A flat floor cannot fix this, because it delays every ring
 * equally; only scaling with depth keeps the rings ordered and spaced.
 */
export function staggerFor(distance: number, maxDistance: number): number {
  if (maxDistance <= 0) return 0

  const window = Math.min(
    Math.max(maxDistance * DELAY_PER_HOP_MS, MIN_STAGGER_MS),
    MAX_STAGGER_MS,
  )
  return Math.round((distance / maxDistance) * window)
}

/**
 * Work out a node's flight. Returns the offset it starts at, negated relative to
 * the target so the CSS translate pulls it back toward the change before it flies
 * outward into place.
 */
export function flightFor({ distance, maxDistance, target, origin }: FlightInput): Flight {
  const offsetX = (target.x - origin.x) * START_FRACTION
  const offsetY = (target.y - origin.y) * START_FRACTION

  return {
    // Negative, because the node starts on the change's side of its own position.
    dx: -offsetX,
    dy: -offsetY,
    delayMs: staggerFor(distance, maxDistance),
  }
}

/** Total time the whole sequence takes once the last ring has landed. */
export function totalDurationMs(maxDistance: number): number {
  return staggerFor(maxDistance, maxDistance) + TRAVEL_MS
}

/**
 * Nearest changed file to each reached file — the origin its flight starts from.
 *
 * The tracer already recorded the shortest chain, so the first entry of that chain
 * is the exact changed file this file traces back to. Using it rather than a
 * centroid means every node departs from a real file, not from an invented midpoint.
 */
export function originByPath(
  pathTo: Map<string, string[]>,
  positionsByPath: Map<string, { x: number; y: number }>,
): Map<string, { x: number; y: number }> {
  const origins = new Map<string, { x: number; y: number }>()

  for (const chain of pathTo.values()) {
    const changedPath = chain[0]
    const origin = positionsByPath.get(changedPath)
    if (origin !== undefined) origins.set(chain[chain.length - 1], origin)
  }

  return origins
}
