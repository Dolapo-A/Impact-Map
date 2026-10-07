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

export type LayoutMode = 'layered' | 'physics'

export const LAYOUT_MODES: LayoutMode[] = ['layered', 'physics']

/** Shown in the toggle. Short, because this sits in a cramped control strip. */
export const LAYOUT_LABELS: Record<LayoutMode, string> = {
  layered: 'Columns',
  physics: 'Physics',
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
    animated: false,
    className: edge.isExternal ? 'edge edge-external' : 'edge edge-internal',
  }
}

/**
 * Place every node according to the chosen algorithm.
 *
 * Physics is imported lazily so its simulation cost is only paid when the user
 * actually selects it. The layered path stays free for the default view.
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
