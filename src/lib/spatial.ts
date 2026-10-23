/**
 * A force layout in three dimensions.
 *
 * The same job as `physics.ts`, with a third axis. `d3-force` lays things out
 * in a plane, so this is a small implementation of the same idea: files pull
 * towards the files they import, push each other apart, and drift back towards
 * the middle.
 *
 * Deterministic in the same way the other layouts are: the starting positions
 * are seeded rather than random, and the simulation runs for a fixed number of
 * steps, so the same repository always produces the same picture.
 *
 * Pure logic, no React — testable without a browser.
 */

export interface SpatialPoint {
  x: number
  y: number
  z: number
}

export interface SpatialLayoutNode {
  id: string
  position: SpatialPoint
}

/** How hard two files push each other away. */
const REPULSION = 16000

/** How close an importer wants to sit to what it imports. */
const LINK_DISTANCE = 230

/** How firmly an import holds its two files together. */
const LINK_STRENGTH = 0.04

/** How hard everything is pulled back towards the middle. */
const CENTERING = 0.004

/** Two files never sit closer together than this. */
const MIN_DISTANCE = 110

/** How quickly a file's movement is damped. */
const DAMPING = 0.86

/** How many steps the simulation runs for. */
const STEPS = 320

/** The radius of the sphere the files start on. */
const SEED_RADIUS = 280

/** The golden angle, in radians, for spreading the seeds evenly. */
const GOLDEN_ANGLE = 2.399963

/**
 * A point on a sphere, spread evenly.
 *
 * The same trick the flat layout uses, with a third axis: the files start
 * around a sphere rather than in a circle, so nothing starts inside anything
 * else and the simulation has a shape to keep.
 */
function seedOnSphere(index: number, count: number): SpatialPoint {
  const t = count <= 1 ? 0.5 : (index + 0.5) / count
  const phi = Math.acos(1 - 2 * t)
  const theta = GOLDEN_ANGLE * index

  return {
    x: Math.sin(phi) * Math.cos(theta) * SEED_RADIUS,
    y: Math.sin(phi) * Math.sin(theta) * SEED_RADIUS,
    z: Math.cos(phi) * SEED_RADIUS,
  }
}

/**
 * Place the files in three dimensions.
 *
 * External packages are kept out of the cloud and lined up beside it, so they
 * read as "leaving the graph" the same way they do in the flat layouts.
 */
export function layoutSpatial(
  nodes: Array<{ id: string }>,
  edges: Array<{ from: string; to: string; isExternal: boolean }>,
): SpatialLayoutNode[] {
  if (nodes.length === 0) return []

  const ids = [...nodes.map((node) => node.id)].sort()
  const index = new Map(ids.map((id, i) => [id, i]))

  // Sorted with a NUL separator, which cannot occur in a path, so the ordering
  // is unambiguous and the simulation runs in the same order every time.
  const links = edges
    .filter((edge) => !edge.isExternal && index.has(edge.from) && index.has(edge.to))
    .map((edge) => ({ source: index.get(edge.from)!, target: index.get(edge.to)! }))
    .sort(
      (left, right) =>
        `${left.source}\0${left.target}`.localeCompare(`${right.source}\0${right.target}`),
    )

  const positions = ids.map((_, i) => seedOnSphere(i, ids.length))
  const velocities = ids.map(() => ({ x: 0, y: 0, z: 0 }))

  for (let step = 0; step < STEPS; step++) {
    const forces = positions.map(() => ({ x: 0, y: 0, z: 0 }))

    // Every file pushes every other file away.
    for (let first = 0; first < positions.length; first++) {
      for (let second = first + 1; second < positions.length; second++) {
        const a = positions[first]
        const b = positions[second]

        let dx = a.x - b.x
        let dy = a.y - b.y
        let dz = a.z - b.z
        let distance = Math.hypot(dx, dy, dz)
        if (distance < 1) {
          dx = 1
          dy = 0
          dz = 0
          distance = 1
        }

        // The strength is capped, so two files that end up almost on top of one
        // another push apart hard but do not fire each other across the volume.
        const strength = Math.min(REPULSION / (distance * distance), 6)

        const fx = (dx / distance) * strength
        const fy = (dy / distance) * strength
        const fz = (dz / distance) * strength

        forces[first].x += fx
        forces[first].y += fy
        forces[first].z += fz
        forces[second].x -= fx
        forces[second].y -= fy
        forces[second].z -= fz
      }
    }

    // Every import pulls its two files together.
    for (const link of links) {
      const a = positions[link.source]
      const b = positions[link.target]

      const dx = b.x - a.x
      const dy = b.y - a.y
      const dz = b.z - a.z
      const distance = Math.hypot(dx, dy, dz) || 1

      const strength = (distance - LINK_DISTANCE) * LINK_STRENGTH
      const fx = (dx / distance) * strength
      const fy = (dy / distance) * strength
      const fz = (dz / distance) * strength

      forces[link.source].x += fx
      forces[link.source].y += fy
      forces[link.source].z += fz
      forces[link.target].x -= fx
      forces[link.target].y -= fy
      forces[link.target].z -= fz
    }

    // Everything drifts back towards the middle, and moves.
    for (let i = 0; i < positions.length; i++) {
      forces[i].x -= positions[i].x * CENTERING
      forces[i].y -= positions[i].y * CENTERING
      forces[i].z -= positions[i].z * CENTERING

      velocities[i].x = (velocities[i].x + forces[i].x) * DAMPING
      velocities[i].y = (velocities[i].y + forces[i].y) * DAMPING
      velocities[i].z = (velocities[i].z + forces[i].z) * DAMPING

      positions[i].x += velocities[i].x
      positions[i].y += velocities[i].y
      positions[i].z += velocities[i].z
    }

    separate(positions)
  }

  return ids.map((id, i) => ({ id, position: positions[i] }))
}

/**
 * Push two files apart when they get too close.
 *
 * The flat layout separates overlapping rectangles; in three dimensions the
 * same thing happens with a sphere around each file.
 */
function separate(positions: SpatialPoint[]): void {
  for (let first = 0; first < positions.length; first++) {
    for (let second = first + 1; second < positions.length; second++) {
      const a = positions[first]
      const b = positions[second]

      let dx = a.x - b.x
      let dy = a.y - b.y
      let dz = a.z - b.z
      let distance = Math.hypot(dx, dy, dz)

      if (distance >= MIN_DISTANCE) continue
      if (distance < 0.001) {
        dx = 0.001
        dy = 0
        dz = 0
        distance = 0.001
      }

      const push = (MIN_DISTANCE - distance) / 2
      const ux = dx / distance
      const uy = dy / distance
      const uz = dz / distance

      a.x += ux * push
      a.y += uy * push
      a.z += uz * push
      b.x -= ux * push
      b.y -= uy * push
      b.z -= uz * push
    }
  }
}

/**
 * Where a file starts when it flies out from a change.
 *
 * The same rule the flat expansion uses: a file starts part of the way back
 * towards the change, so it always travels outward from it.
 */
export function startPoint(
  origin: SpatialPoint,
  target: SpatialPoint,
  fraction = 0.45,
): SpatialPoint {
  return {
    x: target.x + (origin.x - target.x) * fraction,
    y: target.y + (origin.y - target.y) * fraction,
    z: target.z + (origin.z - target.z) * fraction,
  }
}

/** The point part of the way from one place to another. */
export function lerpPoint(
  from: SpatialPoint,
  to: SpatialPoint,
  t: number,
): SpatialPoint {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  }
}

/** The size of the space the files take up. */
export function spreadOf(points: SpatialPoint[]): number {
  if (points.length === 0) return 0

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    minZ = Math.min(minZ, point.z)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
    maxZ = Math.max(maxZ, point.z)
  }

  return Math.max(maxX - minX, maxY - minY, maxZ - minZ)
}
