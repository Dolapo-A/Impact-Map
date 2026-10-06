import { Handle, Position } from '@xyflow/react'

import { displayPath } from '../lib/files'

export type NodeState = 'changed' | 'affected' | 'untouched' | 'external'

export interface FileNodeProps {
  data: {
    path: string
    state: NodeState
    isTest: boolean
    /** Distance in hops from the nearest changed file. Undefined for untouched. */
    distance?: number
    parseFailed?: boolean
    coverage?: 'covered' | 'uncovered' | 'unknown'
  }
  selected?: boolean
}

/**
 * One file in the graph.
 *
 * Two independent channels, deliberately separated:
 *   fill  = distance from the change (orange / purple / grey)
 *   badge = test coverage (blue dot = has tests, red ring = nothing tests it)
 *
 * Coverage is a badge rather than a second fill because blue and purple are close
 * in hue. Shape and weight do the separating that hue cannot.
 */
export function FileNode({ data, selected }: FileNodeProps) {
  const label = displayPath(data.path)

  const coverageClass =
    data.coverage === 'covered'
      ? 'covered'
      : data.coverage === 'uncovered'
        ? 'uncovered'
        : 'unknown'

  return (
    <div
      className={`file-node state-${data.state} coverage-${coverageClass}${
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

      {data.coverage === 'uncovered' && (
        <span className="coverage-badge" title="No test imports this file" />
      )}

      {data.coverage === 'covered' && (
        <span className="coverage-ring" title="Exercised by a test" />
      )}

      {data.distance !== undefined && data.state !== 'changed' && (
        <span className="file-node-distance">{data.distance}</span>
      )}
    </div>
  )
}

