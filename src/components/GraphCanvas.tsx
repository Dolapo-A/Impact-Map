import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'

import { FileNode } from './FileNode'
import type { NodeState } from './FileNode'
import { layoutGraph, toFlowEdge, LAYOUT_GRID } from '../lib/layout'
import type { LayoutMode } from '../lib/layout'
import type { CoverageByPath } from '../lib/coverage'
import type { DependencyGraph } from '../lib/graph'
import type { TraceResult } from '../lib/trace'

interface GraphCanvasProps {
  graph: DependencyGraph
  coverage: CoverageByPath
  onNodeClick: NodeMouseHandler
  changedPaths: Set<string>
  traceResult: TraceResult | null
  layoutMode: LayoutMode
}

/**
 * `useNodesInitialized` and `useReactFlow` read from the React Flow store, so this
 * component has to sit inside a provider. The provider goes here, and the inner
 * component does the work.
 */
export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  )
}

function GraphCanvasInner({
  graph,
  coverage,
  onNodeClick,
  changedPaths,
  traceResult,
  layoutMode,
}: GraphCanvasProps) {
  const { fitView } = useReactFlow()

  // The physics layout is a settled simulation, not a synchronous calculation, so
  // the nodes arrive one render later. Rendering the previous positions until then
  // avoids a flash of an unlaid-out graph.
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(),
  )

  useEffect(() => {
    let cancelled = false
    void layoutGraph(layoutMode, {
      nodes: graph.nodes.map((node) => ({ id: node.path })),
      edges: graph.edges,
    }).then((laid) => {
      if (cancelled) return
      setPositions(new Map(laid.map((node) => [node.id, node.position])))
    })
    return () => {
      cancelled = true
    }
  }, [graph, layoutMode])

  const { nodes, edges } = useMemo(() => {
    // External packages are drawn as stubs at the boundary, not as repo files.
    const externalIds = new Set(graph.externalModules.map((name) => `${name}::external`))

    const built: Node[] = graph.nodes.map((node) => {
      const isChanged = changedPaths.has(node.path)
      const isAffected = traceResult?.affected.has(node.path) ?? false
      return {
        id: node.path,
        type: 'fileNode',
        position: positions.get(node.path) ?? { x: 0, y: 0 },
        data: {
          path: node.path,
          state: (isChanged ? 'changed' : isAffected ? 'affected' : 'untouched') as NodeState,
          isTest: node.isTest,
          parseFailed: node.parseFailed,
          distance: traceResult?.distance.get(node.path),
          // A test file needs no test of its own, and external packages are not
          // ours to cover. Only real source files carry the coverage channel.
          coverage: node.isTest
            ? 'not-applicable'
            : coverage.has(node.path)
              ? 'covered'
              : 'uncovered',
        },
      }
    })

    // External packages sit in their own column past the map, so they read as
    // "leaving the graph" rather than being mixed in with real files.
    const { MARGIN, COLUMN_WIDTH, ROW_HEIGHT } = LAYOUT_GRID
    const rightmost = Math.max(0, ...[...positions.values()].map((p) => p.x))
    const externalColumn = rightmost + COLUMN_WIDTH
    let externalRow = 0

    for (const name of externalIds) {
      built.push({
        id: name,
        type: 'fileNode',
        position: { x: externalColumn, y: MARGIN + externalRow * ROW_HEIGHT },
        data: {
          path: name.replace('::external', ''),
          state: 'external' as NodeState,
          isTest: false,
        },
      })
      externalRow++
    }

    const builtEdges: Edge[] = graph.edges.map((edge, index) =>
      toFlowEdge(edge, `${edge.from}->${edge.to}-${index}`),
    )

    return { nodes: built, edges: builtEdges }
  }, [changedPaths, coverage, graph, positions, traceResult])

  // `fitView` is a fresh function on every render, so depending on it directly
  // would re-run this effect each time and cancel its own animation frame before
  // it ever fired — which is why the view silently never fits.
  const latestFitView = useRef(fitView)
  latestFitView.current = fitView

  const nodeSignature = useMemo(
    () => nodes.map((node) => `${node.id}@${node.position.x},${node.position.y}`).join('|'),
    [nodes],
  )

  useEffect(() => {
    if (nodes.length === 0) return
    // Fit on every layout change, over two frames: one for React Flow to measure
    // the nodes, one more for the measured bounds to settle. `nodesInitialized`
    // flips before the final measured box is committed, so relying on it alone
    // fits a stale, too-small bounding box.
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        void latestFitView.current({ padding: 0.12, minZoom: 0.3, maxZoom: 1, duration: 0 })
      })
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [nodeSignature])

  return (
    <div className="graph-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        nodeTypes={{ fileNode: FileNode }}
        defaultEdgeOptions={{ type: 'straight' }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2b313b" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}
