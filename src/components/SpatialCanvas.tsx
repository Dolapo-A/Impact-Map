import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

import { TRAVEL_MS } from '../lib/motion'
import { easeOutCubic } from '../lib/morph'
import { lerpPoint } from '../lib/spatial'
import { describeVolume, type VolumeNode } from '../lib/volume'
import { resolveCssColors } from '../lib/css'
import { useTheme } from '../hooks/useTheme'
import type { CoverageByPath } from '../lib/coverage'
import type { DependencyGraph } from '../lib/graph'
import type { TraceResult } from '../lib/trace'

interface SpatialCanvasProps {
  graph: DependencyGraph
  coverage: CoverageByPath
  changedPaths: Set<string>
  traceResult: TraceResult | null
  onNodeClick: (path: string) => void
}

/** The size of a file in the volume. */
const NODE_RADIUS = 13

/** The camera's field of view, in degrees. */
const FIELD_OF_VIEW = 50

/**
 * The colours, read from the stylesheet.
 *
 * One source of truth. The palette is decided in CSS, and the three-dimensional
 * view asks the stylesheet for it rather than keeping a second copy here,
 * which is how the two views drift apart.
 */
function readPalette(): {
  changed: string
  affected: string
  untouched: string
  external: string
  covered: string
  uncovered: string
  edge: string
  edgeLit: string
  background: string
} {
  return resolveCssColors({
    changed: { variable: '--node-changed', fallback: '#f0883e' },
    affected: { variable: '--node-affected', fallback: '#a371f7' },
    untouched: { variable: '--node-untouched', fallback: '#3a424d' },
    external: { variable: '--node-external', fallback: '#484f58' },
    covered: { variable: '--covered', fallback: '#58a6ff' },
    uncovered: { variable: '--uncovered', fallback: '#f85149' },
    edge: { variable: '--edge', fallback: '#454f5d' },
    edgeLit: { variable: '--text-muted', fallback: '#8b949e' },
    background: { variable: '--bg', fallback: '#0d1117' },
  })
}

/**
 * The graph, in a volume.
 *
 * The same graph, the same trace and the same states as the flat view, drawn in
 * three dimensions instead of two. What changes is the geometry: a change in
 * the middle of the cloud sends the blast radius outward in every direction at
 * once, which is the thing a flat picture cannot show.
 */
export function SpatialCanvas({
  graph,
  coverage,
  changedPaths,
  traceResult,
  onNodeClick,
}: SpatialCanvasProps) {
  // The palette is read from the stylesheet, so the volume follows the theme.
  const { resolved } = useTheme()
  const palette = useMemo(() => readPalette(), [resolved])

  const volume = useMemo(
    () => describeVolume({ graph, coverage, changedPaths, traceResult }),
    [coverage, changedPaths, graph, traceResult],
  )

  // Far enough back that the whole cloud fits, with room around it.
  const distance = Math.max(
    380,
    (volume.spread * 1.4) / (2 * Math.tan((FIELD_OF_VIEW * Math.PI) / 360)),
  )

  return (
    <div className="spatial-canvas">
      <Canvas
        camera={{ position: [0, 0, distance], fov: FIELD_OF_VIEW, near: 1, far: 8000 }}
        dpr={[1, 2]}
      >
        <color attach="background" args={[palette.background]} />
        <ambientLight intensity={1.1} />
        <directionalLight position={[240, 320, 420]} intensity={1.6} />
        <pointLight position={[-320, -220, 260]} intensity={0.7} color="#a371f7" />

        <SpatialGraph
          volume={volume}
          traceResult={traceResult}
          palette={palette}
          onNodeClick={onNodeClick}
        />

        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          autoRotate
          autoRotateSpeed={0.28}
          minDistance={160}
          maxDistance={2200}
        />
      </Canvas>
    </div>
  )
}

interface SpatialGraphProps {
  volume: ReturnType<typeof describeVolume>
  traceResult: TraceResult | null
  palette: ReturnType<typeof readPalette>
  onNodeClick: (path: string) => void
}

function SpatialGraph({
  volume,
  traceResult,
  palette,
  onNodeClick,
}: SpatialGraphProps) {
  const [hovered, setHovered] = useState<string | null>(null)

  const groups = useRef(new Map<string, THREE.Group>())
  const startedAt = useRef(0)

  /**
   * When the movement starts.
   *
   * A new trace starts a new movement. The clock is reset rather than the scene
   * rebuilt, so the volume is never torn down and put back together in front of
   * the reader.
   */
  const lastTrace = useRef<TraceResult | null>(null)
  useEffect(() => {
    if (traceResult !== null && traceResult !== lastTrace.current) {
      lastTrace.current = traceResult
      startedAt.current = performance.now()
    }
    if (traceResult === null) lastTrace.current = null
  }, [traceResult])

  const register = useCallback((id: string, group: THREE.Group | null) => {
    if (group) groups.current.set(id, group)
    else groups.current.delete(id)
  }, [])

  /**
   * The lines between the files.
   *
   * Every edge is one segment in a single buffer, rebuilt from where the files
   * actually are. That way a line follows its files as they fly out from the
   * change, instead of pointing at where they are going to land.
   */
  const geometry = useMemo(() => {
    const created = new THREE.BufferGeometry()
    created.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(volume.edges.length * 6), 3),
    )
    created.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(volume.edges.length * 6), 3),
    )
    return created
  }, [volume.edges])

  useEffect(() => () => geometry.dispose(), [geometry])

  const litColour = useMemo(() => new THREE.Color(palette.edgeLit), [palette.edgeLit])
  const dimColour = useMemo(() => new THREE.Color(palette.edge), [palette.edge])

  /**
   * The movement.
   *
   * Every file starts part of the way back towards the change and travels out
   * from it, nearest ring first, exactly as the flat expansion does — except
   * that "outward" now has a third direction to travel in.
   *
   * The files and the lines are moved together, on one clock, so a line never
   * points at where its file used to be.
   */
  useFrame(() => {
    const elapsed = performance.now() - startedAt.current

    for (const node of volume.nodes) {
      const group = groups.current.get(node.id)
      if (!group) continue

      const t = Math.min(1, Math.max(0, (elapsed - node.delayMs) / TRAVEL_MS))
      const point = lerpPoint(node.from, node.position, easeOutCubic(t))
      group.position.set(point.x, point.y, point.z)
    }

    const positions = geometry.getAttribute('position') as THREE.BufferAttribute
    const colours = geometry.getAttribute('color') as THREE.BufferAttribute

    volume.edges.forEach((edge, index) => {
      const source = groups.current.get(edge.source)
      const target = groups.current.get(edge.target)
      const offset = index * 6

      if (!source || !target) {
        positions.array[offset] = 0
        positions.array[offset + 1] = 0
        positions.array[offset + 2] = 0
        positions.array[offset + 3] = 0
        positions.array[offset + 4] = 0
        positions.array[offset + 5] = 0
        return
      }

      positions.array[offset] = source.position.x
      positions.array[offset + 1] = source.position.y
      positions.array[offset + 2] = source.position.z
      positions.array[offset + 3] = target.position.x
      positions.array[offset + 4] = target.position.y
      positions.array[offset + 5] = target.position.z

      const lit = hovered !== null && (edge.source === hovered || edge.target === hovered)
      const colour = lit ? litColour : dimColour
      for (let corner = 0; corner < 2; corner++) {
        colours.array[offset + corner * 3] = colour.r
        colours.array[offset + corner * 3 + 1] = colour.g
        colours.array[offset + corner * 3 + 2] = colour.b
      }
    })

    positions.needsUpdate = true
    colours.needsUpdate = true
  })

  /** The files directly connected to the one under the pointer. */
  const focusSet = useMemo(() => {
    if (hovered === null) return null
    const set = new Set<string>([hovered])
    for (const edge of volume.edges) {
      if (edge.source === hovered) set.add(edge.target)
      if (edge.target === hovered) set.add(edge.source)
    }
    return set
  }, [hovered, volume.edges])

  return (
    <group>
      <lineSegments geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial vertexColors transparent opacity={0.85} />
      </lineSegments>

      {volume.nodes.map((node) => (
        <SpatialFile
          key={node.id}
          node={node}
          palette={palette}
          dimmed={focusSet !== null && !focusSet.has(node.id)}
          register={register}
          onEnter={() => setHovered(node.id)}
          onLeave={() => setHovered(null)}
          onClick={() => onNodeClick(node.path)}
        />
      ))}
    </group>
  )
}

interface SpatialFileProps {
  node: VolumeNode
  palette: ReturnType<typeof readPalette>
  dimmed: boolean
  register: (id: string, group: THREE.Group | null) => void
  onEnter: () => void
  onLeave: () => void
  onClick: () => void
}

function SpatialFile({
  node,
  palette,
  dimmed,
  register,
  onEnter,
  onLeave,
  onClick,
}: SpatialFileProps) {
  return (
    <group ref={(group) => register(node.id, group)}>
      <mesh
        onPointerOver={(event) => {
          event.stopPropagation()
          onEnter()
        }}
        onPointerOut={onLeave}
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
      >
        <sphereGeometry args={[NODE_RADIUS, 24, 16]} />
        <meshStandardMaterial
          color={colourFor(palette, node.state)}
          emissive={colourFor(palette, node.state)}
          emissiveIntensity={node.state === 'untouched' || node.state === 'external' ? 0.12 : 0.42}
          opacity={dimmed ? 0.16 : 1}
          transparent={dimmed}
          roughness={0.45}
          metalness={0.1}
        />
      </mesh>

      {node.coverage === 'uncovered' && (
        <mesh position={[NODE_RADIUS + 9, 0, 0]}>
          <sphereGeometry args={[4.5, 12, 8]} />
          <meshStandardMaterial
            color={palette.uncovered}
            emissive={palette.uncovered}
            emissiveIntensity={0.6}
            opacity={dimmed ? 0.16 : 1}
            transparent={dimmed}
          />
        </mesh>
      )}

      {node.coverage === 'covered' && (
        <mesh position={[NODE_RADIUS + 9, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[4.5, 1.4, 8, 18]} />
          <meshStandardMaterial
            color={palette.covered}
            emissive={palette.covered}
            emissiveIntensity={0.5}
            opacity={dimmed ? 0.16 : 1}
            transparent={dimmed}
          />
        </mesh>
      )}

      <Html
        position={[0, NODE_RADIUS + 16, 0]}
        center
        zIndexRange={[3, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <span className={`spatial-label is-${node.state}${dimmed ? ' is-dimmed' : ''}`}>
          {node.label}
        </span>
      </Html>
    </group>
  )
}

/** The colour a file takes in the volume. */
function colourFor(
  palette: ReturnType<typeof readPalette>,
  state: string,
): string {
  switch (state) {
    case 'changed':
      return palette.changed
    case 'affected':
      return palette.affected
    case 'external':
      return palette.external
    default:
      return palette.untouched
  }
}
