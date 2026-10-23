import { useEffect, useMemo, useRef, useState } from 'react'

import { sampleEdges, sampleTrace } from '../lib/sampleRepo'

interface PreviewFile {
  path: string
  name: string
  folder: string
  x: number
  y: number
  /** Whether any test in the sample repository imports this file. */
  covered: boolean
}

/**
 * Where the files sit.
 *
 * The shape is arranged by hand rather than laid out, because this is a picture
 * of the repository drawn for a page rather than the tool's own graph. The
 * imports on it, and the blast radius it shows, are the real ones.
 */
const FILES: PreviewFile[] = [
  { path: 'src/utils/totals.ts', name: 'totals.ts', folder: 'utils', x: 0, y: 40, covered: true },
  { path: 'src/utils/cart.ts', name: 'cart.ts', folder: 'utils', x: 0, y: 210, covered: true },
  { path: 'src/utils/format.ts', name: 'format.ts', folder: 'utils', x: 0, y: 380, covered: true },
  { path: 'src/api/orders.ts', name: 'orders.ts', folder: 'api', x: 200, y: 40, covered: true },
  {
    path: 'src/domain/reservations.ts',
    name: 'reservations.ts',
    folder: 'domain',
    x: 200,
    y: 210,
    covered: false,
  },
  {
    path: 'src/state/selectors.ts',
    name: 'selectors.ts',
    folder: 'state',
    x: 200,
    y: 380,
    covered: false,
  },
  {
    path: 'src/components/CartBadge.tsx',
    name: 'CartBadge.tsx',
    folder: 'components',
    x: 400,
    y: 120,
    covered: false,
  },
  { path: 'src/index.ts', name: 'index.ts', folder: 'src', x: 400, y: 300, covered: false },
]

/**
 * The changes the picture tells, one after another.
 *
 * Three of them, because a repository does not have one blast radius: a change
 * deep in the code reaches far, and a change nobody imports reaches one file.
 */
const CHANGES = [
  'src/utils/cart.ts',
  'src/state/selectors.ts',
  'src/domain/reservations.ts',
]

const CARD_WIDTH = 158
const CARD_HEIGHT = 40

/** Milliseconds between rings. Matches the tool's own expansion. */
const DELAY_PER_HOP_MS = 130

/** How long each story holds before the next one starts. */
const STORY_MS = 7000

/**
 * The graph, drawing itself.
 *
 * The same rules as the tool: a file starts part of the way back towards the
 * change and travels out from it, nearest ring first, and a line appears just
 * after the file it points at has landed. The blast radius is the tool's own
 * trace — this picture is not an illustration of the product, it is the product
 * drawing the same graph it draws in the workspace.
 *
 * Here the change also moves: three different files are changed in turn, so
 * the picture shows three blast radii rather than one.
 */
export function GraphPreview() {
  const [story, setStory] = useState(0)
  const [hovered, setHovered] = useState<string | null>(null)
  const [settled, setSettled] = useState(true)
  const timer = useRef(0)

  const change = CHANGES[story % CHANGES.length]

  const byPath = useMemo(() => new Map(FILES.map((file) => [file.path, file])), [])

  /** The edges between the files in the picture. */
  const edges = useMemo(
    () =>
      sampleEdges().filter(
        (edge) => byPath.has(edge.from) && byPath.has(edge.to),
      ),
    [byPath],
  )

  /** What the change reaches, and how many hops away each file is. */
  const reached = useMemo(() => sampleTrace([change]).distance, [change])

  /**
   * Move to the next story.
   *
   * The picture dims, the change moves, the picture brightens. The dimming is
   * what makes it one movement rather than two: without it the files would
   * jump from one place to another.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

    timer.current = window.setInterval(() => {
      setSettled(false)
      window.setTimeout(() => {
        setStory((current) => current + 1)
        setSettled(true)
      }, 420)
    }, STORY_MS)

    return () => window.clearInterval(timer.current)
  }, [])

  const changeFile = byPath.get(change)

  /** The files directly connected to the one under the pointer. */
  const focus = useMemo(() => {
    if (!hovered) return null
    const set = new Set<string>([hovered])
    for (const edge of edges) {
      if (edge.from === hovered) set.add(edge.to)
      if (edge.to === hovered) set.add(edge.from)
    }
    return set
  }, [edges, hovered])

  const stateOf = (path: string): 'changed' | 'affected' | 'untouched' => {
    if (path === change) return 'changed'
    return reached.has(path) ? 'affected' : 'untouched'
  }

  const dimmed = (path: string) => focus !== null && !focus.has(path)

  return (
    <svg
      className={`preview${settled ? '' : ' is-settling'}`}
      viewBox="0 20 558 420"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <g className="preview-edges">
        {edges.map((edge) => {
          const from = byPath.get(edge.from)!
          const to = byPath.get(edge.to)!
          const distance = reached.get(edge.to) ?? reached.get(edge.from) ?? 0
          const lit = hovered !== null && (edge.from === hovered || edge.to === hovered)

          return (
            <path
              key={`${edge.from}-${edge.to}`}
              className={`preview-edge${lit ? ' is-lit' : ''}${
                dimmed(edge.from) && dimmed(edge.to) ? ' is-dimmed' : ''
              }`}
              d={`M ${from.x + CARD_WIDTH / 2},${from.y + CARD_HEIGHT / 2} L ${
                to.x + CARD_WIDTH / 2
              },${to.y + CARD_HEIGHT / 2}`}
              pathLength={1}
              style={
                {
                  '--edge-delay': `${distance * DELAY_PER_HOP_MS}ms`,
                } as React.CSSProperties
              }
            />
          )
        })}
      </g>

      {/* The change's own flight starts from the change, so the key that changes
          with the story is what replays the whole expansion. */}
      <g key={change}>
        {FILES.map((file) => {
          const state = stateOf(file.path)
          const distance = reached.get(file.path) ?? 0
          const origin = changeFile ?? file
          const dx = (origin.x - file.x) * 0.45
          const dy = (origin.y - file.y) * 0.45

          return (
            <g
              key={file.path}
              className={`preview-node preview-node-${state}${dimmed(file.path) ? ' is-dimmed' : ''}`}
              style={
                {
                  '--fly-dx': `${dx}px`,
                  '--fly-dy': `${dy}px`,
                  '--fly-delay': `${distance * DELAY_PER_HOP_MS}ms`,
                } as React.CSSProperties
              }
              onMouseEnter={() => setHovered(file.path)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                className="preview-card"
                x={file.x}
                y={file.y}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                rx={8}
              />
              <text className="preview-name" x={file.x + 13} y={file.y + 17}>
                {file.name}
              </text>
              <text className="preview-folder" x={file.x + 13} y={file.y + 31}>
                {file.folder}
              </text>

              <circle
                className={`preview-badge ${
                  file.covered ? 'preview-badge-covered' : 'preview-badge-uncovered'
                }`}
                cx={file.x + CARD_WIDTH - 16}
                cy={file.y + 14}
                r={5}
              />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
