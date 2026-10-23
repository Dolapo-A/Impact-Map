import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'

import { FileNode } from './FileNode'
import { DrawInEdge } from './DrawInEdge'
import { SpatialCanvas } from './SpatialCanvas'
import type { NodeState } from './FileNode'
import {
  DRAW_IN_EDGE,
  EDGE_CURVE,
  LAYOUT_GRID,
  layoutGraph,
  toFlowEdge,
  withDrawIn,
} from '../lib/layout'
import { TRAVEL_MS, flightFor, originByPath, staggerFor } from '../lib/motion'
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/geometry'
import {
  MORPH_MS,
  easeOutCubic,
  interpolatePositions,
  prefersReducedMotion,
  type Point,
} from '../lib/morph'
import { boundsOf, fitBounds, interpolateViewport } from '../lib/viewport'
import { createTicker } from '../lib/ticker'
import { useCssColor } from '../hooks/useTheme'
import type { LayoutMode } from '../lib/layout'
import type { ViewMode } from '../lib/views'
import type { CoverageByPath } from '../lib/coverage'
import type { DependencyGraph } from '../lib/graph'
import type { TraceResult } from '../lib/trace'

interface GraphCanvasProps {
  graph: DependencyGraph
  coverage: CoverageByPath
  /** Called with the path of the file that was clicked. */
  onNodeClick: (path: string) => void
  changedPaths: Set<string>
  traceResult: TraceResult | null
  viewMode: ViewMode
  /**
   * Bumped when the space the graph has changes — the detail panel opening
   * takes a slice of the canvas, and the view should settle onto the new shape
   * rather than leave files off the edge.
   */
  fitSignal?: number
}

const FIT_OPTIONS = { padding: 0.12, minZoom: 0.3, maxZoom: 1 } as const

/**
 * Where a card's handles are.
 *
 * They sit at the centre of the card. An edge is a line between two files, and
 * the cards are drawn over the edges, so a line that starts and ends at a
 * centre is hidden under the cards and shows only in the gap between them.
 * Nothing ever runs through a file's own name.
 *
 * Declaring them here rather than letting the graph library measure the page
 * means the geometry is known up front: an edge is placed correctly on the
 * first frame, and the view can be framed without waiting for a layout pass.
 */
const CARD_HANDLES = [
  {
    id: 'source',
    type: 'source' as const,
    position: Position.Top,
    x: NODE_WIDTH / 2,
    y: NODE_HEIGHT / 2,
  },
  {
    id: 'target',
    type: 'target' as const,
    position: Position.Top,
    x: NODE_WIDTH / 2,
    y: NODE_HEIGHT / 2,
  },
]

/**
 * The graph.
 *
 * Two renderers, one graph. The flat views draw it in two dimensions, and the
 * volume draws it in three. Everything else — the files, the imports, the
 * trace, the states — is the same in all three.
 */
export function GraphCanvas(props: GraphCanvasProps) {
  if (props.viewMode === 'spatial') {
    return (
      <SpatialCanvas
        graph={props.graph}
        coverage={props.coverage}
        changedPaths={props.changedPaths}
        traceResult={props.traceResult}
        onNodeClick={(path) => props.onNodeClick(path)}
      />
    )
  }

  return (
    <ReactFlowProvider>
      <FlatCanvas {...props} viewMode={props.viewMode} />
    </ReactFlowProvider>
  )
}

interface FlatCanvasProps extends Omit<GraphCanvasProps, 'viewMode'> {
  viewMode: LayoutMode
}

function FlatCanvas({
  graph,
  coverage,
  onNodeClick,
  changedPaths,
  traceResult,
  viewMode,
  fitSignal,
}: FlatCanvasProps) {
  const { setViewport } = useReactFlow()
  const canvasRef = useRef<HTMLDivElement>(null)
  // The canvas's own dots, read from the stylesheet so they follow the theme.
  const canvasDot = useCssColor('--canvas-dot', '#232a34')

  // A CSS animation only replays when the element is newly inserted or its
  // animation name changes. Pressing Trace again on the same selection produces a
  // new trace object, so this counter forces a remount and the expansion replays.
  // It has to be state, not a ref: a ref mutation does not re-render, so the
  // canvas key would never actually change.
  const [animationRun, setAnimationRun] = useState(0)
  const lastTrace = useRef<TraceResult | null>(null)

  /**
   * Where each file has ended up, and where it is on its way to.
   *
   * `targets` is the settled layout. `positions` is what is on screen right now,
   * which is somewhere between the old layout and the new one while the graph
   * rearranges itself. Keeping both is what lets the switch between the two
   * layouts be a movement rather than a cut.
   */
  const [targets, setTargets] = useState<Map<string, Point> | null>(null)
  const [positions, setPositions] = useState<Map<string, Point>>(new Map())
  const positionsRef = useRef<Map<string, Point>>(new Map())

  /** The file the pointer is over, and the files one hop away from it. */
  const [hovered, setHovered] = useState<string | null>(null)

  /** Bumped when the camera should be pointed at the graph again. */
  const [frameRequest, setFrameRequest] = useState(0)
  const requestFrame = useCallback(() => setFrameRequest((request) => request + 1), [])

  /** The camera that frames the given positions inside the canvas. */
  const viewportFor = useCallback((map: Map<string, Point>) => {
    const element = canvasRef.current
    if (!element) return null
    return fitBounds(
      boundsOf(map),
      element.clientWidth,
      element.clientHeight,
      FIT_OPTIONS,
    )
  }, [])

  /**
   * Point the camera at the graph.
   *
   * The graph library sets its camera up as soon as it is mounted, so a request
   * made in that moment is refused. It is worth asking again a moment later
   * rather than leaving the graph in the corner of the canvas.
   */
  const frameGraph = useCallback(
    (attempt = 0) => {
      const viewport = viewportFor(positionsRef.current)
      if (!viewport) return
      void setViewport(viewport).then((applied) => {
        if (!applied && attempt < 8) {
          setTimeout(() => frameGraph(attempt + 1), 50)
        }
      })
    },
    [setViewport, viewportFor],
  )

  useEffect(() => {
    if (frameRequest === 0) return
    frameGraph()
  }, [frameRequest, frameGraph])

  useEffect(() => {
    if (traceResult !== null && traceResult !== lastTrace.current) {
      lastTrace.current = traceResult
      setAnimationRun((run) => run + 1)
      requestFrame()
    }
    if (traceResult === null) lastTrace.current = null
  }, [requestFrame, traceResult])

  // The detail panel took a slice of the canvas. Frame the graph again.
  useEffect(() => {
    if (!fitSignal) return
    requestFrame()
  }, [fitSignal, requestFrame])

  useEffect(() => {
    let cancelled = false
    void layoutGraph(viewMode, {
      nodes: graph.nodes.map((node) => ({ id: node.path })),
      edges: graph.edges,
    }).then((laid) => {
      if (cancelled) return

      const map = new Map(laid.map((node) => [node.id, node.position]))

      // External packages sit in their own column past the map, so they read as
      // "leaving the graph" rather than being mixed in with real files.
      const { MARGIN, COLUMN_WIDTH, ROW_HEIGHT } = LAYOUT_GRID
      const rightmost = Math.max(0, ...[...map.values()].map((point) => point.x))
      let row = 0
      for (const name of graph.externalModules) {
        map.set(`${name}::external`, {
          x: rightmost + COLUMN_WIDTH,
          y: MARGIN + row * ROW_HEIGHT,
        })
        row++
      }

      setTargets(map)
    })
    return () => {
      cancelled = true
    }
  }, [graph, viewMode])

  useEffect(() => {
    if (!targets) return

    const from = new Map(positionsRef.current)
    const fromViewport = viewportFor(from)
    const toViewport = viewportFor(targets)

    // The first layout has nowhere to come from, so it appears rather than
    // travels. A reader who has asked for less movement gets the same thing.
    if (from.size === 0 || prefersReducedMotion()) {
      positionsRef.current = new Map(targets)
      setPositions(new Map(targets))
      if (toViewport) void setViewport(toViewport)
      requestFrame()
      return
    }

    const start = performance.now()

    /**
     * The files and the camera move together.
     *
     * One movement, one clock. The camera travelling at its own pace beside
     * files travelling at another reads as two things happening rather than one
     * rearrangement.
     */
    const ticker = createTicker((now) => {
      const t = Math.min(1, (now - start) / MORPH_MS)
      const eased = easeOutCubic(t)

      const next = interpolatePositions(from, targets, t)
      positionsRef.current = next
      setPositions(next)

      if (fromViewport && toViewport) {
        void setViewport(interpolateViewport(fromViewport, toViewport, eased))
      }

      if (t < 1) return true

      requestFrame()
      return false
    })

    ticker.start()
    return () => ticker.stop()
  }, [requestFrame, setViewport, targets, viewportFor])

  /**
   * The file under the pointer, plus the files directly connected to it.
   *
   * A dependency graph of any size turns into a thicket where nothing is
   * readable. Pointing at one file and having everything else step back turns
   * the same picture into a sentence: this file, and the handful of files that
   * touch it.
   */
  const focusSet = useMemo(() => {
    if (hovered === null) return null
    const set = new Set<string>([hovered])
    for (const edge of graph.edges) {
      if (edge.from === hovered) set.add(edge.isExternal ? `${edge.to}::external` : edge.to)
      if (edge.to === hovered) set.add(edge.from)
    }
    return set
  }, [graph, hovered])

  const { nodes, edges } = useMemo(() => {
    const externalIds = new Set(graph.externalModules.map((name) => `${name}::external`))

    // Where each reached file's flight begins: the changed file it traces back to.
    const origins = traceResult
      ? originByPath(traceResult.pathTo, targets ?? new Map())
      : new Map()

    // The deepest ring decides how the available animation window is divided, so a
    // shallow graph spaces its few rings just as far apart as a deep one.
    const maxDistance = traceResult
      ? Math.max(0, ...[...traceResult.distance.values()])
      : 0

    const built: Node[] = graph.nodes.map((node) => {
      const isChanged = changedPaths.has(node.path)
      const isAffected = traceResult?.affected.has(node.path) ?? false
      const distance = traceResult?.distance.get(node.path)

      const target = targets?.get(node.path)
      const origin = origins.get(node.path)

      // Only affected files fly. The changed file and the untouched cluster hold
      // their positions, which is what makes the movement mean something.
      const flight =
        isAffected && distance !== undefined && target && origin
          ? flightFor({ distance, maxDistance, target, origin })
          : undefined

      const lit = focusSet?.has(node.path) ?? false

      return {
        id: node.path,
        type: 'fileNode',
        position: positions.get(node.path) ?? target ?? { x: 0, y: 0 },
        // Every card is the same size, and saying so up front keeps the graph from
        // having to measure the page before it can place an edge. It also means
        // the size never flickers while the graph moves.
        measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
        handles: CARD_HANDLES,
        className:
          focusSet === null
            ? undefined
            : hovered === node.path
              ? 'is-focused'
              : lit
                ? 'is-lit'
                : 'is-dimmed',
        data: {
          path: node.path,
          state: (isChanged ? 'changed' : isAffected ? 'affected' : 'untouched') as NodeState,
          isTest: node.isTest,
          parseFailed: node.parseFailed,
          distance,
          // A test file needs no test of its own, and external packages are not
          // ours to cover. Only real source files carry the coverage channel.
          coverage: node.isTest
            ? 'not-applicable'
            : coverage.has(node.path)
              ? 'covered'
              : 'uncovered',
          flight,
        },
      }
    })

    for (const id of externalIds) {
      built.push({
        id,
        type: 'fileNode',
        position: positions.get(id) ?? { x: 0, y: 0 },
        measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
        handles: CARD_HANDLES,
        className:
          focusSet === null
            ? undefined
            : hovered === id
              ? 'is-focused'
              : focusSet.has(id)
                ? 'is-lit'
                : 'is-dimmed',
        data: {
          path: id.replace('::external', ''),
          state: 'external' as NodeState,
          isTest: false,
          coverage: 'not-applicable' as const,
        },
      })
    }

    const builtEdges: Edge[] = graph.edges.map((edge, index) => {
      const flowEdge = toFlowEdge(edge, `${edge.from}->${edge.to}-${index}`)

      const touchesHovered = hovered !== null && (edge.from === hovered || edge.to === hovered)
      const focusClass =
        focusSet === null ? '' : touchesHovered ? ' is-lit' : ' is-dimmed'

      const withCurve: Edge = {
        ...flowEdge,
        className: `${flowEdge.className ?? ''}${focusClass}`.trim(),
        data: { ...flowEdge.data, curve: EDGE_CURVE[viewMode] },
      }

      // An edge draws itself in when the file it points at lands. Edges inside the
      // untouched cluster, and edges out to external packages, stay as they are.
      const targetDistance = traceResult?.distance.get(edge.to)
      if (edge.isExternal || targetDistance === undefined || targetDistance === 0) {
        return withCurve
      }

      return withDrawIn(
        withCurve,
        // The edge draws in once the node it points at is most of the way home, so
        // the line and its arrival read as one movement.
        staggerFor(targetDistance, maxDistance) + TRAVEL_MS * 0.6,
      )
    })

    return { nodes: built, edges: builtEdges }
  }, [changedPaths, coverage, graph, hovered, viewMode, positions, targets, traceResult])

  return (
    <div className="graph-canvas" ref={canvasRef}>
      {positions.size > 0 && (
        <ReactFlow
          // CSS animations only run when the element is newly inserted or its
          // animation name changes. Without a changing key, pressing Trace a second
          // time would re-run nothing and the expansion would play exactly once.
          //
          // The layout is deliberately not part of this key. Remounting the canvas
          // would throw away the positions the morph just worked out.
          key={animationRun}
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, node) => onNodeClick(node.id)}
          onNodeMouseEnter={(_, node) => setHovered(node.id)}
          onNodeMouseLeave={() => setHovered(null)}
          nodeTypes={{ fileNode: FileNode }}
          edgeTypes={{ [DRAW_IN_EDGE]: DrawInEdge }}
          defaultEdgeOptions={{ type: 'straight' }}
          nodesConnectable={false}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color={canvasDot} />
          {/* Bottom right, clear of the legend on the other side. */}
          <Controls position="bottom-right" showInteractive={false} />
        </ReactFlow>
      )}
    </div>
  )
}
