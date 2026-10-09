/**
 * Radial layout: changed files at the centre, each ring out holding the files one
 * hop further away.
 *
 * **Why this earns its place.** Physics treats a changed file as a node like any
 * other — nothing about its position says "this is where the change starts." Radial
 * makes the blast radius the shape itself: distance from the centre *is* distance
 * from your change, so the affected cluster reads as a concentric bloom rather than
 * an amorphous cloud.
 *
 * It is also the only layout where slice 5's outward expansion is literal. The spec
 * promises nodes "fly outward from the changed files"; with columns or physics that
 * is a metaphor, because neither encodes distance from a change. Here the flight
 * path is the real thing it claims to be.
 *
 * **Not three.js, deliberately.** A ball of nodes viewed in 3D hides its own far
 * side, and this product's kernel is that every claim traces back to an edge you can
 * click and verify — a node behind another node is a claim you cannot check. A
 * sphere also cannot express direction or depth in a dependency graph, so the
 * geometry would look meaningful while encoding nothing. 2D keeps the whole shape
 * visible at once.
 *
 * **Before a change is marked there is no centre.** With nothing selected there is
 * no blast radius to show, so this falls back to placing files by dependency depth
 * in rings instead. That keeps the view readable rather than collapsing every file
 * onto the middle.
 */
import { computeDepths } from './layered'
import type { LaidOutNode } from './layout'

/** Gap between concentric rings. Wide enough that labels do not crowd. */
const RING_GAP = 190

/**
 * Angular space per node, in radians.
 *
 * Sized so a node occupies roughly its own width along the circumference at this
 * ring gap: at radius `r`, `r * ANGLE_PER_NODE` should be about a node's width. A
 * smaller value packs rings into overlapping arcs and the shape stops reading as a
 * circle; a larger one pushes the bloom so wide that fitView zooms out too far.
 */
const ANGLE_PER_NODE = 0.62

/**
 * A ring never sweeps less than this. Three files should still read as a ring
 * rather than a cluster, so small rings get a minimum arc.
 */
const MIN_SWEEP = Math.PI * 1.1

/** Nor more than this, or a busy ring opens into a half-circle and loses the shape. */
const MAX_SWEEP = Math.PI * 1.92

interface RadialInput {
  nodes: Array<{ id: string }>
  edges: Array<{ from: string; to: string; isExternal: boolean }>
  /** The files marked as changed. Empty before the user marks anything. */
  changedPaths: Set<string>
  /**
   * Hop distance from the nearest changed file, from the tracer. Used only when
   * something is actually marked — recomputing it here would duplicate the tracer.
   */
  distanceByPath: Map<string, number>
}

export function layoutGraphRadial(input: RadialInput): LaidOutNode[] {
  const { nodes, edges, changedPaths, distanceByPath } = input
  if (nodes.length === 0) return []

  const hasChange = changedPaths.size > 0
  // Marking files and pressing Trace are separate steps. If a change is marked but
  // the tracer has not run, there are no distances yet — falling back to dependency
  // depth keeps every file visible instead of hiding everything unreached.
  const hasDistances = distanceByPath.size > 0
  const canBloom = hasChange && hasDistances

  const fallbackLevels = new Map(
    [...computeDepths(nodes, edges)].map(([path, depth]) => [path, depth] as const),
  )

  const placed: Array<{ id: string; level: number }> = []

  for (const node of nodes) {
    const id = node.id

    if (canBloom) {
      if (changedPaths.has(id)) {
        placed.push({ id, level: 0 })
      } else if (distanceByPath.has(id)) {
        // The tracer never reaches a file that cannot be affected, and those must
        // stay out of the bloom rather than being drawn at distance 0.
        placed.push({ id, level: distanceByPath.get(id)! })
      }
      continue
    }

    // No bloom available: centre on the marked files if there are any, and ring
    // everything else by dependency depth.
    placed.push({ id, level: hasChange && changedPaths.has(id) ? 0 : (fallbackLevels.get(id) ?? 0) + 1 })
  }

  // Group by ring, then order within each ring. Sorting by id keeps a given
  // repository on a given ring in the same places every run.
  const byLevel = new Map<number, string[]>()
  for (const entry of placed) {
    const ring = byLevel.get(entry.level)
    if (ring) ring.push(entry.id)
    else byLevel.set(entry.level, [entry.id])
  }

  const positions = new Map<string, { x: number; y: number }>()

  for (const [level, ids] of byLevel) {
    const sorted = [...ids].sort()

    // The centre holds exactly the changed files, so they sit on top of each other
    // only if the user marked more than one. Fan them slightly so both stay clickable.
    if (level === 0) {
      sorted.forEach((id, index) => {
        const offset = sorted.length === 1 ? 0 : (index - (sorted.length - 1) / 2) * 60
        positions.set(id, { x: offset, y: 0 })
      })
      continue
    }

    const radius = level * RING_GAP
    const count = sorted.length

    // A busy ring needs more arc so its files do not overlap; a small ring still
    // gets a readable minimum. Capped so a large ring stays recognisably circular.
    const sweep = Math.min(MAX_SWEEP, Math.max(MIN_SWEEP, count * ANGLE_PER_NODE))
    // Rotate each ring by half a step, so the nodes of successive rings do not line
    // up into spokes that read as a second, unrelated structure.
    const startAngle = -sweep / 2 + (level % 2 === 0 ? 0 : sweep / count / 2)

    sorted.forEach((id, index) => {
      // `+ 1` puts the final node on the far side of the arc rather than short of
      // it, so a ring spans the full sweep it was allotted.
      const angle = startAngle + (index / (count - 1 || 1)) * sweep
      positions.set(id, {
        x: Math.round(Math.cos(angle) * radius),
        y: Math.round(Math.sin(angle) * radius),
      })
    })
  }

  // Normalise into positive canvas space so React Flow can pan around it freely.
  let minX = Infinity
  let minY = Infinity
  for (const point of positions.values()) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
  }
  const MARGIN = 60

  // Sort by id so the returned array order does not depend on the order nodes were
  // supplied in. Two callers passing the same graph in different orders must get
  // byte-identical output, or React Flow re-mounts the canvas for no reason.
  return [...positions.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, point]) => ({
      id,
      position: {
        x: Math.round(point.x - minX + MARGIN),
        y: Math.round(point.y - minY + MARGIN),
      },
    }))
}
