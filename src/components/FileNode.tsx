import { Handle, Position } from '@xyflow/react'

import { displayPath } from '../lib/files'

export type NodeState = 'changed' | 'affected' | 'untouched' | 'external'

/**
 * The second colour channel. `not-applicable` covers test files and external
 * packages, which need no test of their own — showing them a badge would claim
 * something about them that we cannot know.
 */
export type CoverageState = 'covered' | 'uncovered' | 'not-applicable'

export interface FileNodeProps {
  data: {
    path: string
    state: NodeState
    isTest: boolean
    /** Distance in hops from the nearest changed file. Undefined for untouched. */
    distance?: number
    parseFailed?: boolean
    coverage?: CoverageState
  }
  selected?: boolean
}

/**
 * One file in the graph.
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
 */
export function FileNode({ data, selected }: FileNodeProps) {
  const label = displayPath(data.path)
  const coverage: CoverageState = data.coverage ?? 'not-applicable'

  return (
    <div
      className={`file-node state-${data.state} coverage-${coverage}${
        selected ? ' is-selected' : ''
      }${data.isTest ? ' is-test' : ''}`}
      title={data.path}
    >
      {/* Import edges point right → left: an importer sits deeper than what it
          imports, so an edge arrives from the left and leaves to the right. */}
      <Handle type="target" position={Position.Left} className="node-handle" />
      <Handle type="source" position={Position.Right} className="node-handle" />

      <span className="file-node-label">{label}</span>

      {data.isTest && <span className="file-node-tag">test</span>}

      {data.parseFailed && (
        <span className="file-node-flag" title="This file could not be parsed">
          parse failed
        </span>
      )}

      {coverage === 'uncovered' && (
        <span className="coverage-badge" title="No test imports this file" />
      )}

      {coverage === 'covered' && (
        <span className="coverage-ring" title="Exercised by a test" />
      )}

      {data.distance !== undefined && data.state !== 'changed' && (
        <span className="file-node-distance">{data.distance}</span>
      )}
    </div>
  )
}

