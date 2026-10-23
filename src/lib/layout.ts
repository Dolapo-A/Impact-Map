/**
 * Layout contract and dispatch.
 *
 * Two algorithms, both deterministic, both user-selectable:
 *
 * - **Layered** (`./layered`) — files in columns by dependency depth. Position
 *   encodes *how far a file sits from a leaf*, which makes the blast radius
 *   legible as geometry: the affected cluster reads as a contiguous band.
 * - **Physics** (`./physics`) — files pull together along import edges, so a
 *   circular import becomes a visibly adjacent pair rather than an edge stub
 *   between same-column neighbours. Honest about dependency structure, but
 *   position no longer encodes distance from a change.
 *
 * Neither is strictly better; they answer different questions. That is why both
 * ship, rather than one being chosen up front and defended.
 *
 * Determinism is a hard requirement (`spec.md > Data Model`): the same repository
 * must always produce the same picture. `d3-force` seeds randomly by default, so
 * `physics.ts` overrides its initial positions.
 */
import type { Edge } from '@xyflow/react'

import type { EdgeData } from './graph'
import { layoutGraphLayered } from './layered'

export { LAYOUT_GRID } from './layered'

/** Edge type name for the custom draw-in edge. Registered in `GraphCanvas`. */
export const DRAW_IN_EDGE = 'drawIn'

export type LayoutMode = 'layered' | 'physics'

export const LAYOUT_MODES: LayoutMode[] = ['layered', 'physics']

/** Shown in the toggle. Short, because this sits in a cramped control strip. */
export const LAYOUT_LABELS: Record<LayoutMode, string> = {
  layered: 'Columns',
  physics: 'Physics',
}

/**
 * How much an edge bows away from the straight line between two files.
 *
 * In the column layout the two ends are already in a tidy row, so a straight
 * line is the clean answer. In the physics layout the files land wherever the
 * forces put them, and a slight bow keeps a bundle of parallel edges from
 * collapsing into one thick line.
 */
export const EDGE_CURVE: Record<LayoutMode, number> = {
  layered: 0,
  physics: 0.07,
}

export interface LaidOutNode {
  id: string
  position: { x: number; y: number }
}

/** The graph shape every layout accepts. */
export interface LayoutInput {
  nodes: Array<{ id: string }>
  edges: Array<{ from: string; to: string; isExternal: boolean }>
}

/** Convert a domain edge into the shape React Flow draws. */
export function toFlowEdge(edge: EdgeData, key: string): Edge {
  return {
    id: key,
    source: edge.from,
    target: edge.isExternal ? `${edge.to}::external` : edge.to,
    type: DRAW_IN_EDGE,
    animated: false,
    className: edge.isExternal ? 'edge edge-external' : 'edge edge-internal',
  }
}

/**
 * An edge that draws itself in, delayed until the node it points at arrives.
 *
 * `data.delayMs` is read by `DrawInEdge` below. It cannot be done with a plain
 * `style`: React Flow applies an edge's `style` to the wrapping `<g>`, where
 * `stroke-dashoffset` has no effect, and its built-in `straight` renderer throws
 * `pathOptions.style` away entirely. A small custom edge is the reliable route.
 */
export function withDrawIn(edge: Edge, delayMs: number): Edge {
  return {
    ...edge,
    className: `${edge.className ?? ''} is-drawing`.trim(),
    data: { ...edge.data, delayMs },
  }
}

/**
 * Place every node according to the chosen algorithm.
 *
 * Physics is imported lazily so its simulation cost is only paid when the user
 * actually selects it. The layered default stays free.
 */
export async function layoutGraph(
  mode: LayoutMode,
  input: LayoutInput,
): Promise<LaidOutNode[]> {
  if (mode === 'physics') {
    const { layoutGraphPhysics } = await import('./physics')
    return layoutGraphPhysics(input.nodes, input.edges)
  }

  return layoutGraphLayered(input.nodes, input.edges)
}
