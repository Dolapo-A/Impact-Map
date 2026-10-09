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
 * - **Radial** (`./radial`) — changed files at the centre, each ring out holding
 *   the files one hop further away. Distance from the centre *is* distance from
 *   the change, and it is the only layout where slice 5's outward expansion is
 *   literal rather than a metaphor.
 *
 * None is strictly better; they answer different questions. That is why all three
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

export type LayoutMode = 'layered' | 'physics' | 'radial'

export const LAYOUT_MODES: LayoutMode[] = ['layered', 'physics', 'radial']

/** Shown in the toggle. Short, because this sits in a cramped control strip. */
export const LAYOUT_LABELS: Record<LayoutMode, string> = {
  layered: 'Columns',
  physics: 'Physics',
  radial: 'Radial',
}

export interface LaidOutNode {
  id: string
  position: { x: number; y: number }
}

/** The graph shape every layout accepts. */
export interface LayoutInput {
  nodes: Array<{ id: string }>
  edges: Array<{ from: string; to: string; isExternal: boolean }>
  /** Files marked as changed. Only the radial layout needs these. */
  changedPaths?: Set<string>
  /** Hop distance from the nearest changed file. Only the radial layout needs this. */
  distanceByPath?: Map<string, number>
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
 * Physics and radial are imported lazily so their cost is only paid when the user
 * selects them. The layered default stays free.
 */
export async function layoutGraph(
  mode: LayoutMode,
  input: LayoutInput,
): Promise<LaidOutNode[]> {
  if (mode === 'physics') {
    const { layoutGraphPhysics } = await import('./physics')
    return layoutGraphPhysics(input.nodes, input.edges)
  }

  if (mode === 'radial') {
    const { layoutGraphRadial } = await import('./radial')
    return layoutGraphRadial({
      nodes: input.nodes,
      edges: input.edges,
      changedPaths: input.changedPaths ?? new Set<string>(),
      distanceByPath: input.distanceByPath ?? new Map<string, number>(),
    })
  }

  return layoutGraphLayered(input.nodes, input.edges)
}
