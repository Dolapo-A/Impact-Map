/**
 * A stable force-directed layout for the dependency map.
 *
 * `d3-force` normally seeds new nodes randomly. We give every sorted path a
 * fixed phyllotaxis position before ticking a bounded simulation, so the same
 * repository always produces the same settled picture.
 */
import type { Edge } from '@xyflow/react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from 'd3-force'

import type { EdgeData } from './graph'

export interface LaidOutNode {
  id: string
  position: { x: number; y: number }
}

interface ForceNode extends SimulationNodeDatum {
  id: string
}

interface ForceLink {
  source: string
  target: string
}

const MARGIN = 40
const EXTERNAL_GAP = 220
const EXTERNAL_ROW_GAP = 52

/** The diameter collision force maintains between file-node centres. */
export const MIN_NODE_DISTANCE = 124

/** Kept as canvas geometry for positioning package stubs beyond the map. */
export const LAYOUT_GRID = {
  MARGIN,
  COLUMN_WIDTH: EXTERNAL_GAP,
  ROW_HEIGHT: EXTERNAL_ROW_GAP,
} as const

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function seededNode(id: string, index: number): ForceNode {
  const radius = 34 * Math.sqrt(index + 1)
  const angle = index * GOLDEN_ANGLE
  return { id, x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

/**
 * Settle the graph without running a live simulation in the browser.
 *
 * The bounded ticks make this a fast, pure layout function. It clusters files
 * joined by imports, separates unrelated areas, and keeps the cycle members as
 * visibly neighbouring nodes instead of collapsing their edge into a column.
 */
export function layoutGraph(
  nodes: Array<{ id: string }>,
  edges: Array<{ from: string; to: string; isExternal: boolean }>,
): LaidOutNode[] {
  const ids = [...nodes.map((node) => node.id)].sort()
  if (ids.length === 0) return []

  const forceNodes = ids.map(seededNode)
  const nodeIds = new Set(ids)
  const links: ForceLink[] = edges
    .filter((edge) => !edge.isExternal && nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .map((edge) => ({ source: edge.from, target: edge.to }))
    .sort((left, right) =>
      `${left.source}\0${left.target}`.localeCompare(`${right.source}\0${right.target}`),
    )

  const simulation = forceSimulation(forceNodes)
    .force(
      'link',
      forceLink<ForceNode, ForceLink>(links)
        .id((node) => node.id)
        .distance(180)
        .strength(0.7),
    )
    .force('charge', forceManyBody().strength(-1050))
    .force('collide', forceCollide<ForceNode>(MIN_NODE_DISTANCE / 2).iterations(2))
    .force('center', forceCenter(0, 0))
    .alpha(1)
    .alphaDecay(0.028)
    .velocityDecay(0.52)
    .stop()

  // A fixed tick count, rather than waiting for an alpha threshold, keeps output
  // repeatable and the cost predictable for the proof of concept.
  simulation.tick(220)

  const minX = Math.min(...forceNodes.map((node) => node.x ?? 0))
  const minY = Math.min(...forceNodes.map((node) => node.y ?? 0))

  return forceNodes.map((node) => ({
    id: node.id,
    position: {
      x: Math.round((node.x ?? 0) - minX + MARGIN),
      y: Math.round((node.y ?? 0) - minY + MARGIN),
    },
  }))
}

/** Convert a domain edge into the shape React Flow draws. */
export function toFlowEdge(edge: EdgeData, key: string): Edge {
  return {
    id: key,
    source: edge.from,
    target: edge.isExternal ? `${edge.to}::external` : edge.to,
    animated: false,
    className: edge.isExternal ? 'edge edge-external' : 'edge edge-internal',
  }
}
