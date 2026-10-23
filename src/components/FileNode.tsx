import { Handle, Position } from '@xyflow/react'

import { FileCard, type FileCardData } from './FileCard'

export type { CoverageState, Flight, NodeState } from './FileCard'

export interface FileNodeProps {
  data: FileCardData
  selected?: boolean
}

/**
 * One file in the graph.
 *
 * The card itself is drawn by `FileCard`, which knows nothing about React
 * Flow, so the landing page can show a real file card rather than a picture of
 * one. This component adds the two handles the graph needs to attach edges to.
 */
export function FileNode({ data, selected }: FileNodeProps) {
  return (
    <FileCard data={data} selected={selected}>
      {/*
        The handles sit at the centre of the card rather than on its edges. An
        edge is a line between two files, and the cards are drawn on top of the
        edges, so a line that starts and ends at a centre is hidden under the
        cards and shows only in the gap between them. Nothing ever runs through
        a file's own name.
      */}
      <Handle type="source" position={Position.Top} className="node-handle" isConnectable={false} />
      <Handle type="target" position={Position.Top} className="node-handle" isConnectable={false} />
    </FileCard>
  )
}
