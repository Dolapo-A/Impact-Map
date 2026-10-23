/**
 * The rendered size of a file node.
 *
 * Every node is the same size on purpose. The layout algorithms place rectangles
 * rather than points, so a known size is what lets them keep files from
 * overlapping, and what lets an edge stop at a node's border instead of running
 * straight through the middle of it.
 *
 * Pure logic, no React — testable without a browser.
 */

export const NODE_WIDTH = 176
export const NODE_HEIGHT = 44

/** The gap kept between two neighbouring nodes, so a dense cluster still breathes. */
export const NODE_GAP = 16

export interface Point {
  x: number
  y: number
}

export interface Box extends Point {
  width: number
  height: number
}

/** The rectangle a node occupies, given its top-left position. */
export function boxAt(position: Point, width = NODE_WIDTH, height = NODE_HEIGHT): Box {
  return { x: position.x, y: position.y, width, height }
}

/** True when two node rectangles share any space. */
export function boxesOverlap(a: Box, b: Box): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  )
}

/**
 * The overlap between two rectangles, measured along each axis.
 *
 * A negative value means the rectangles are already apart on that axis. The
 * collision force uses the smaller of the two to decide which way to push a
 * pair of nodes apart.
 */
export function overlap(a: Box, b: Box): { x: number; y: number } {
  return {
    x: Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x),
    y: Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y),
  }
}
