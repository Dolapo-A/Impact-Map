/**
 * What the three-dimensional view shows.
 *
 * The same graph the flat views show — the same files, the same imports, the
 * same trace and the same two colour channels — placed in a volume instead of
 * on a plane.
 *
 * Kept apart from the rendering on purpose: what a file is called, where it
 * sits, where it flies from and when it arrives are all decisions, and
 * decisions can be checked without a browser.
 */
import { displayPath } from './files'
import { staggerFor } from './motion'
import {
  layoutSpatial,
  spreadOf,
  startPoint,
  type SpatialPoint,
} from './spatial'
import type { CoverageByPath } from './coverage'
import type { DependencyGraph } from './graph'
import type { TraceResult } from './trace'

export type VolumeState = 'changed' | 'affected' | 'untouched' | 'external'
export type VolumeCoverage = 'covered' | 'uncovered' | 'none'

export interface VolumeNode {
  /** The node's own name in the scene. */
  id: string
  /** The path in the repository, which the detail panel reads. */
  path: string
  /** The name shown beside the file. */
  label: string
  state: VolumeState
  coverage: VolumeCoverage
  /** Where the file ends up. */
  position: SpatialPoint
  /** Where the file starts, on its way out from the change. */
  from: SpatialPoint
  /** How long before the file starts moving, in milliseconds. */
  delayMs: number
}

export interface VolumeEdge {
  source: string
  target: string
}

export interface Volume {
  nodes: VolumeNode[]
  edges: VolumeEdge[]
  /** The middle of the cloud, where the files come from when nothing is traced. */
  centre: SpatialPoint
  /** How far the cloud reaches. */
  spread: number
}

export interface DescribeVolumeInput {
  graph: DependencyGraph
  coverage: CoverageByPath
  changedPaths: Set<string>
  traceResult: TraceResult | null
}

/** How long one file takes to travel once it starts. */
export const VOLUME_TRAVEL_MS = 420

/**
 * Describe the volume.
 *
 * The external packages are kept out of the cloud and lined up beside it, so
 * they read as "leaving the graph" the same way they do in the flat views.
 */
export function describeVolume({
  graph,
  coverage,
  changedPaths,
  traceResult,
}: DescribeVolumeInput): Volume {
  const homes = new Map<string, SpatialPoint>()

  for (const node of layoutSpatial(
    graph.nodes.map((node) => ({ id: node.path })),
    graph.edges,
  )) {
    homes.set(node.id, node.position)
  }

  const points = [...homes.values()]
  const centre = centreOf(points)

  const externalIds = graph.externalModules.map((name) => `${name}::external`)
  if (externalIds.length > 0) {
    const radius = Math.max(
      ...points.map((point) => distance(point, centre)),
      1,
    )
    externalIds.forEach((id, index) => {
      homes.set(id, {
        x: centre.x + radius + 150,
        y: centre.y + (index - (externalIds.length - 1) / 2) * 110,
        z: centre.z,
      })
    })
  }

  const spread = spreadOf([...homes.values()])

  /**
   * Where each reached file's flight begins: the changed file it traces back
   * to. The same rule as the flat expansion.
   */
  const origins = new Map<string, SpatialPoint>()
  if (traceResult) {
    for (const chain of traceResult.pathTo.values()) {
      const origin = homes.get(chain[0])
      if (origin) origins.set(chain[chain.length - 1], origin)
    }
  }

  const maxDistance = traceResult ? Math.max(0, ...[...traceResult.distance.values()]) : 0
  const furthest = Math.max(
    ...points.map((point) => distance(point, centre)),
    1,
  )

  const nodes: VolumeNode[] = graph.nodes.map((node) => {
    const home = homes.get(node.path)!
    const isChanged = changedPaths.has(node.path)
    const isAffected = traceResult?.affected.has(node.path) ?? false

    const state: VolumeState = isChanged
      ? 'changed'
      : isAffected
        ? 'affected'
        : 'untouched'

    const coverageState: VolumeCoverage = node.isTest
      ? 'none'
      : coverage.has(node.path)
        ? 'covered'
        : 'uncovered'

    const hops = traceResult?.distance.get(node.path)
    const delayMs = traceResult
      ? hops === undefined
        ? 0
        : staggerFor(hops, maxDistance)
      : Math.round((distance(home, centre) / furthest) * 600)

    const origin = origins.get(node.path) ?? centre

    return {
      id: node.path,
      path: node.path,
      label: displayPath(node.path).split('/').pop() ?? node.path,
      state,
      coverage: coverageState,
      position: home,
      from: startPoint(origin, home),
      delayMs,
    }
  })

  for (const name of graph.externalModules) {
    const id = `${name}::external`
    const home = homes.get(id)!
    nodes.push({
      id,
      path: name,
      label: name,
      state: 'external',
      coverage: 'none',
      position: home,
      from: startPoint(centre, home),
      delayMs: Math.round((distance(home, centre) / furthest) * 600),
    })
  }

  const edges: VolumeEdge[] = graph.edges.map((edge) => ({
    source: edge.from,
    target: edge.isExternal ? `${edge.to}::external` : edge.to,
  }))

  return { nodes, edges, centre, spread }
}

/** The middle of a set of points. */
function centreOf(points: SpatialPoint[]): SpatialPoint {
  if (points.length === 0) return { x: 0, y: 0, z: 0 }
  return points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
      z: sum.z + point.z / points.length,
    }),
    { x: 0, y: 0, z: 0 },
  )
}

function distance(a: SpatialPoint, b: SpatialPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}
