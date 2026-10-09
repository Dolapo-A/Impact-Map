import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react'
import type { CSSProperties } from 'react'

/**
 * A straight edge that can draw itself in, after a delay.
 *
 * The built-in `straight` edge cannot do this. React Flow applies an edge's
 * `style` to the wrapping `<g>` element, where `stroke-dashoffset` has no effect,
 * and the built-in renderer discards `pathOptions.style` altogether — so a
 * class-based animation attached to the edge never has anything to animate. This
 * component puts the delay straight onto the `<path>`, where it works.
 */
export function DrawInEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  // `getStraightPath` takes only the four coordinates, despite its own doc example
  // passing handle positions as well.
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  const delayMs = typeof data?.delayMs === 'number' ? data.delayMs : 0

  return (
    <BaseEdge
      id={id}
      path={path}
      markerEnd={markerEnd}
      style={
        {
          ...style,
          '--edge-delay': `${delayMs}ms`,
        } as CSSProperties
      }
    />
  )
}
