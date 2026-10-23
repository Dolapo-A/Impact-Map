import { displayPath } from '../lib/files'

export type NodeState = 'changed' | 'affected' | 'untouched' | 'external'

/**
 * The second colour channel. `not-applicable` covers test files and external
 * packages, which need no test of their own — showing them a badge would claim
 * something about them that we cannot know.
 */
export type CoverageState = 'covered' | 'uncovered' | 'not-applicable'

/**
 * How far this node travels in from, in pixels, and when it starts.
 * Undefined means the node does not animate — the changed files, the untouched
 * cluster, and anything outside a trace all stay exactly where they are.
 */
export interface Flight {
  dx: number
  dy: number
  delayMs: number
}

export interface FileCardData {
  path: string
  state: NodeState
  isTest: boolean
  /** Distance in hops from the nearest changed file. Undefined for untouched. */
  distance?: number
  parseFailed?: boolean
  coverage?: CoverageState
  /** Present only while a trace is expanding outward. */
  flight?: Flight
}

interface FileCardProps {
  data: FileCardData
  selected?: boolean
  /** The handles the graph needs, when it is drawn inside React Flow. */
  children?: React.ReactNode
}

/**
 * Split the display path into the file's own name and the folder it sits in.
 *
 * The name is what the eye looks for; the folder is context, and it reads
 * better as quiet second-line text than as a prefix sharing the same line.
 */
function splitPath(path: string): { name: string; folder: string } {
  const label = displayPath(path)
  const slash = label.lastIndexOf('/')
  if (slash < 0) return { name: label, folder: '' }
  return { name: label.slice(slash + 1), folder: label.slice(0, slash) }
}

/**
 * One file.
 *
 * Two independent channels, deliberately separated:
 *   fill    = distance from the change (orange / purple / grey)
 *   badge   = test coverage (blue ring = has tests, red disc = nothing tests it)
 *
 * Blue and purple sit close on the spectrum, so colour alone cannot carry the
 * coverage channel. It differs by **shape and weight** as well:
 *   covered   → a blue *outline* ring, open in the middle
 *   uncovered → a red *filled* disc, heavier and unmissable
 *
 * That difference also survives red-green colour vision deficiency, which
 * affects roughly 8% of men and would otherwise hide the "untested" warning.
 *
 * The card is drawn apart from the graph, so the landing page can show the
 * real thing rather than a picture of it.
 */
export function FileCard({ data, selected, children }: FileCardProps) {
  const { name, folder } = splitPath(data.path)
  const coverage: CoverageState = data.coverage ?? 'not-applicable'
  const flight = data.flight

  // The flight is driven by CSS custom properties rather than inline styles so the
  // keyframes stay in the stylesheet, where the timing curve is readable.
  const flightStyle = flight
    ? ({
        '--fly-dx': `${flight.dx}px`,
        '--fly-dy': `${flight.dy}px`,
        '--fly-delay': `${flight.delayMs}ms`,
      } as React.CSSProperties)
    : undefined

  return (
    <div
      className={`file-node state-${data.state} coverage-${coverage}${
        selected ? ' is-selected' : ''
      }${data.isTest ? ' is-test' : ''}${flight ? ' is-arriving' : ''}`}
      style={flightStyle}
      title={data.path}
    >
      {children}

      <span className="file-node-text">
        <span className="file-node-name">{name}</span>
        {folder && <span className="file-node-folder">{folder}</span>}
      </span>

      <span className="file-node-meta">
        {data.isTest && <span className="file-node-tag">test</span>}

        {data.parseFailed && (
          <span className="file-node-flag" title="This file could not be parsed">
            unparsed
          </span>
        )}

        {coverage === 'uncovered' && (
          <span className="coverage-badge" title="No test imports this file" />
        )}

        {coverage === 'covered' && (
          <span className="coverage-ring" title="Exercised by a test" />
        )}

        {data.distance !== undefined && data.state !== 'changed' && (
          <span className="file-node-distance" title={`${data.distance} imports from your change`}>
            {data.distance}
          </span>
        )}
      </span>
    </div>
  )
}
