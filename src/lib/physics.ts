/**
 * Force-directed layout, using `d3-force`.
 *
 * Physics suits this graph better than fixed columns in one specific way: it pulls
 * mutually-importing files together, so a circular import reads as a visible pair
 * rather than an edge stub between neighbours that happen to share a column.
 *
 * The tradeoff, stated plainly: node position no longer encodes distance from the
 * change. That geometry is what makes blast radius legible at a glance, which is
 * why the layered layout in `layout.ts` is kept and offered as an alternative.
 *
 * **Determinism is load-bearing.** `d3-force` seeds initial positions randomly, so
 * the same repository would otherwise lay out differently on every load. That
 * breaks `spec.md > Data Model`: the same repository must always produce the same
 * graph. Seeding on a fixed phyllotaxis spiral restores it.
 */
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'

import { NODE_GAP, NODE_HEIGHT, NODE_WIDTH } from './geometry'
import type { LaidOutNode } from './layout'

/**
 * The half-extent of a node, plus the gap that has to stay between two of them.
 *
 * A node is a wide rectangle, not a dot. Treating it as a circle with a radius
 * of half its width keeps two side-by-side files from overlapping, at the cost
 * of pushing files that sit above one another further apart than they need to
 * be. The force below resolves that by separating overlapping boxes along
 * whichever axis needs the smaller correction.
 */
const HALF_WIDTH = NODE_WIDTH / 2 + NODE_GAP / 2
const HALF_HEIGHT = NODE_HEIGHT / 2 + NODE_GAP / 2

const LINK_DISTANCE = 250
const CHARGE_STRENGTH = -1400
const MARGIN = 48

/**
 * The minimum distance the collision force maintains between node centres.
 *
 * The separation works on the real rectangle, so the guarantee is per axis:
 * two files side by side are at least a node's width plus the gap apart, and
 * two files stacked above one another are at least a node's height plus the
 * gap apart. The smallest distance that allows is therefore the stacked one,
 * which is what this constant reports.
 */
export const MIN_NODE_DISTANCE = NODE_HEIGHT + NODE_GAP

/** Enough ticks for the simulation to settle; measured at well under 100ms. */
const TICKS = 260

interface SimNode extends SimulationNodeDatum {
  id: string
  /** Non-optional: the seeded positions above always set both. */
  x: number
  y: number
}

interface ForceLink extends SimulationLinkDatum<SimNode> {
  source: string
  target: string
}

/**
 * The golden angle, in radians. Successive seeds land on a sunflower pattern, so
 * even starting positions produce an even spread instead of clumping.
 */
const GOLDEN_ANGLE = 2.399963

/**
 * Seed the nodes on a wide ellipse rather than a circle.
 *
 * The files are wide rectangles, so a round cloud always leaves them cramped
 * side by side. A wide, flat start gives the simulation a shape to keep, and
 * the result reads as a map rather than a ball of yarn.
 */
function seededNodes(ids: string[]): SimNode[] {
  const radiusX = 340
  const radiusY = 150
  return ids.map((id, index) => {
    const angle = index * GOLDEN_ANGLE
    return {
      id,
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
    }
  })
}

/**
 * Push overlapping nodes apart.
 *
 * `d3-force`'s own collision force treats a node as a circle, which is the
 * wrong shape for a file card and is why a force layout of wide nodes ends up
 * with cards sitting on top of each other. This force works on the real
 * rectangle instead: when two cards overlap, they are separated along the
 * axis that needs the smaller correction, so they slide apart rather than
 * jumping over each other.
 */
function separateOverlapping(nodes: SimNode[]): void {
  for (let first = 0; first < nodes.length; first++) {
    for (let second = first + 1; second < nodes.length; second++) {
      const a = nodes[first]
      const b = nodes[second]

      const overlapX = Math.min(a.x + HALF_WIDTH, b.x + HALF_WIDTH) - Math.max(a.x - HALF_WIDTH, b.x - HALF_WIDTH)
      const overlapY = Math.min(a.y + HALF_HEIGHT, b.y + HALF_HEIGHT) - Math.max(a.y - HALF_HEIGHT, b.y - HALF_HEIGHT)
      if (overlapX <= 0 || overlapY <= 0) continue

      if (overlapX < overlapY) {
        const push = overlapX / 2
        if (a.x <= b.x) {
          a.x -= push
          b.x += push
        } else {
          a.x += push
          b.x -= push
        }
      } else {
        const push = overlapY / 2
        if (a.y <= b.y) {
          a.y -= push
          b.y += push
        } else {
          a.y += push
          b.y -= push
        }
      }
    }
  }
}

/**
 * Place nodes so that linked files sit near each other and nothing overlaps.
 * `isExternal` edges are excluded — pulling a node toward `react` says nothing
 * useful about this repository's shape.
 */
export function layoutGraphPhysics(
  nodes: Array<{ id: string }>,
  edges: Array<{ from: string; to: string; isExternal: boolean }>,
): LaidOutNode[] {
  if (nodes.length === 0) return []

  // Sort ids so seeding is independent of the order callers happen to supply.
  const ids = [...nodes.map((node) => node.id)].sort()
  const known = new Set(ids)

  // Sorted with a NUL separator, which cannot occur in a path, so the ordering
  // is unambiguous. Written as the `\0` escape rather than a literal NUL byte, which
  // would make this source a binary file to `file`, `grep` and `git diff`.
  const links = edges
    .filter((edge) => !edge.isExternal && known.has(edge.from) && known.has(edge.to))
    .map((edge) => ({ source: edge.from, target: edge.to }))
    .sort((left, right) =>
      `${left.source}\0${left.target}`.localeCompare(`${right.source}\0${right.target}`),
    )

  const simulated = seededNodes(ids)

  const simulation = forceSimulation<SimNode>(simulated)
    .force(
      'link',
      forceLink<SimNode, ForceLink>(links)
        .id((node) => node.id)
        .distance(LINK_DISTANCE)
        .strength(0.55),
    )
    .force('charge', forceManyBody().strength(CHARGE_STRENGTH).distanceMax(700))
    // Weak centering keeps the graph compact without flattening its shape. The
    // vertical pull is stronger than the horizontal one, which is what keeps the
    // result wide and flat — the shape a set of wide file cards wants.
    .force('x', forceX(0).strength(0.045))
    .force('y', forceY(0).strength(0.085))
    .force('center', forceCenter(0, 0))
    .alpha(1)
    .alphaDecay(0.026)
    .velocityDecay(0.5)
    .stop()

  // A custom force receives the current alpha, and reads the nodes from the
  // simulation it is attached to.
  simulation.force('separate', (_alpha: number) => {
    separateOverlapping(simulated)
  })

  // A fixed tick count rather than an alpha threshold keeps output repeatable and
  // the cost predictable. Measured at well under 100ms for a small repository.
  simulation.tick(TICKS)

  const minX = Math.min(...simulated.map((node) => node.x))
  const minY = Math.min(...simulated.map((node) => node.y))

  return simulated.map((node) => ({
    id: node.id,
    position: {
      x: Math.round(node.x - minX + MARGIN),
      y: Math.round(node.y - minY + MARGIN),
    },
  }))
}
