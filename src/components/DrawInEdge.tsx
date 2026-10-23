import { BaseEdge, type EdgeProps } from '@xyflow/react'
import type { CSSProperties } from 'react'

/**
 * The line between two files.
 *
 * Two things it has to get right:
 *
 * **It draws itself in.** The built-in `straight` edge cannot do this.
 * React Flow applies an edge's `style` to the wrapping `<g>` element, where
 * `stroke-dashoffset` has no effect, and the built-in renderer discards
 * `pathOptions.style` altogether — so a class-based animation attached to the
 * edge never has anything to animate. This component puts the delay straight
 * onto the `<path>`, where it works.
 *
 * **`pathLength={1}`.** Without it the dash pattern is measured in real pixels,
 * so `stroke-dasharray: 1` means a one-pixel dot repeated along the line and
 * the edge ends up looking dashed rather than drawn. Normalising the path
 * length to 1 turns the same rule into a real draw-in, and leaves the edge
 * solid once it has arrived.
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
  const delayMs = typeof data?.delayMs === 'number' ? data.delayMs : 0
  const curve = typeof data?.curve === 'number' ? data.curve : 0

  return (
    <BaseEdge
      id={id}
      path={edgePath(sourceX, sourceY, targetX, targetY, curve)}
      markerEnd={markerEnd}
      pathLength={1}
      style={
        {
          ...style,
          '--edge-delay': `${delayMs}ms`,
        } as CSSProperties
      }
    />
  )
}

/**
 * The path between two files.
 *
 * Both ends are at the centre of a file card, and the cards are drawn over the
 * edges, so only the stretch between two cards is ever visible. A straight
 * line is the clean answer when the two files sit in a tidy row; in the physics
 * layout the files land wherever the forces put them, and a slight bow keeps
 * several near-parallel edges from collapsing into one thick line.
 */
function edgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  curve: number,
): string {
  if (curve <= 0) {
    return `M ${sourceX},${sourceY} L ${targetX},${targetY}`
  }

  const dx = targetX - sourceX
  const dy = targetY - sourceY
  const length = Math.hypot(dx, dy)
  if (length < 1) return `M ${sourceX},${sourceY} L ${targetX},${targetY}`

  // The bow sits perpendicular to the line, so it never shortens or lengthens
  // the connection — it only bends it out of the way of its neighbours.
  const bow = Math.min(46, length * curve)
  const controlX = (sourceX + targetX) / 2 + (-dy / length) * bow
  const controlY = (sourceY + targetY) / 2 + (dx / length) * bow

  return `M ${sourceX},${sourceY} Q ${controlX},${controlY} ${targetX},${targetY}`
}
