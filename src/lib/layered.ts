/**
 * Deterministic node placement.
 *
 * The spec flags physics layout as a risk with a deterministic layout as the
 * fallback. A layered layout is not a consolation prize here: import edges have a
 * real direction, so "what depends on what" reads directly as left-to-right depth.
 * Same repository in, same picture out — which the product's credibility depends on.
 */
import type { LaidOutNode } from './layout'

export interface LayoutNode {
  id: string
  depth: number
}

const COLUMN_WIDTH = 220
const ROW_HEIGHT = 52
const MARGIN = 40

/** Exported so the canvas can place external stubs just past the last source column. */
export const LAYOUT_GRID = { COLUMN_WIDTH, ROW_HEIGHT, MARGIN } as const

/**
 * Assign each file a depth: how far it sits from the files nothing depends on.
 * A file with no internal imports is depth 0; anything importing one is depth 1, and so on.
 *
 * Circular imports are expected, so this runs Tarjan's algorithm to collapse each
 * strongly-connected component into a single node, then takes the longest path
 * through the resulting acyclic graph. Members of a cycle share one depth, which
 * is the honest reading — they are mutually dependent and neither is "deeper".
 *
 * The earlier alternative — relaxing depths until they settled — silently
 * inflated every file in a cycle once per pass, spreading the layout dozens of
 * columns wide. Condensing first is what makes this deterministic and correct.
 */
export function computeDepths(
  nodes: Array<{ id: string }>,
  edges: Array<{ from: string; to: string; isExternal: boolean }>,
): Map<string, number> {
  const ids = nodes.map((node) => node.id)
  const idSet = new Set(ids)

  // Adjacency and reverse adjacency over internal edges only.
  const adjacency = new Map<string, string[]>()
  const reverse = new Map<string, string[]>()
  for (const id of ids) {
    adjacency.set(id, [])
    reverse.set(id, [])
  }

  for (const edge of edges) {
    if (edge.isExternal) continue
    if (!idSet.has(edge.from) || !idSet.has(edge.to)) continue
    adjacency.get(edge.from)!.push(edge.to)
    reverse.get(edge.to)!.push(edge.from)
  }

  // --- Tarjan's strongly-connected components (iterative; recursion would be a
  // --- stack-overflow risk on a large real repository).
  const index = new Map<string, number>()
  const lowLink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const componentOf = new Map<string, number>()
  let counter = 0
  let componentCount = 0

  for (const root of ids) {
    if (index.has(root)) continue

    const work: Array<{ node: string; edgeIndex: number }> = [{ node: root, edgeIndex: 0 }]
    index.set(root, counter)
    lowLink.set(root, counter)
    counter++
    stack.push(root)
    onStack.add(root)

    while (work.length > 0) {
      const frame = work[work.length - 1]
      const successors = adjacency.get(frame.node)!

      if (frame.edgeIndex < successors.length) {
        const next = successors[frame.edgeIndex++]
        if (!index.has(next)) {
          index.set(next, counter)
          lowLink.set(next, counter)
          counter++
          stack.push(next)
          onStack.add(next)
          work.push({ node: next, edgeIndex: 0 })
        } else if (onStack.has(next)) {
          lowLink.set(frame.node, Math.min(lowLink.get(frame.node)!, index.get(next)!))
        }
        continue
      }

      work.pop()
      if (work.length > 0) {
        const parent = work[work.length - 1].node
        lowLink.set(parent, Math.min(lowLink.get(parent)!, lowLink.get(frame.node)!))
      }

      if (lowLink.get(frame.node) === index.get(frame.node)) {
        // Pop one component off the stack.
        for (;;) {
          const member = stack.pop()!
          onStack.delete(member)
          componentOf.set(member, componentCount)
          if (member === frame.node) break
        }
        componentCount++
      }
    }
  }

  // --- Longest path over the condensed DAG. A component's depth is one more
  // than the deepest component it imports.
  const componentDepth = new Array<number>(componentCount).fill(0)
  // Iterate to a fixed point. The condensed graph is acyclic, so this settles in
  // at most `componentCount` passes and is bounded regardless of cycles in input.
  for (let pass = 0; pass < componentCount; pass++) {
    let changed = false
    for (const id of ids) {
      const component = componentOf.get(id)!
      // Start below zero so a file that imports nothing lands at depth 0, not 1.
      let deepest = -1
      for (const target of adjacency.get(id)!) {
        const targetComponent = componentOf.get(target)!
        // Skip edges inside the same component: that is the cycle we just collapsed.
        if (targetComponent === component) continue
        if (componentDepth[targetComponent] > deepest) {
          deepest = componentDepth[targetComponent]
        }
      }
      const candidate = deepest + 1
      if (candidate > componentDepth[component]) {
        componentDepth[component] = candidate
        changed = true
      }
    }
    if (!changed) break
  }

  const depths = new Map<string, number>()
  for (const id of ids) {
    depths.set(id, componentDepth[componentOf.get(id)!])
  }
  return depths
}

/**
 * Place each node in a column by depth, stacked vertically within that column.
 * Ties are broken by path so the layout is stable across runs.
 */
export function layoutGraphLayered(
  nodes: Array<{ id: string }>,
  edges: Array<{ from: string; to: string; isExternal: boolean }>,
): LaidOutNode[] {
  const depths = computeDepths(nodes, edges)

  const byDepth = new Map<number, string[]>()
  for (const node of nodes) {
    const depth = depths.get(node.id) ?? 0
    const column = byDepth.get(depth)
    if (column) column.push(node.id)
    else byDepth.set(depth, [node.id])
  }

  const placed: LaidOutNode[] = []

  for (const [depth, ids] of byDepth) {
    const sorted = [...ids].sort()
    sorted.forEach((id, index) => {
      placed.push({
        id,
        position: {
          x: MARGIN + depth * COLUMN_WIDTH,
          // Centre each column against the tallest one, so the picture reads as a
          // shape rather than a set of ragged stacks.
          y: MARGIN + index * ROW_HEIGHT,
        },
      })
    })
  }

  // Centre short columns vertically against the tallest column.
  const maxRows = Math.max(...[...byDepth.values()].map((ids) => ids.length), 1)
  const fullHeight = (maxRows - 1) * ROW_HEIGHT

  return placed.map((node) => {
    const depth = depths.get(node.id) ?? 0
    const columnLength = byDepth.get(depth)?.length ?? 1
    const columnHeight = (columnLength - 1) * ROW_HEIGHT
    return {
      ...node,
      position: { ...node.position, y: node.position.y + (fullHeight - columnHeight) / 2 },
    }
  })
}

