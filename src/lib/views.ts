import type { LayoutMode } from './layout'

/**
 * The ways the graph can be looked at.
 *
 * The first two are layouts of the same flat graph. The third is a different
 * picture of the same graph: the same files, the same imports, the same trace,
 * drawn in a volume instead of on a plane.
 */
export type ViewMode = LayoutMode | 'spatial'

export const VIEW_MODES: ViewMode[] = ['layered', 'physics', 'spatial']

export const VIEW_LABELS: Record<ViewMode, string> = {
  layered: 'Columns',
  physics: 'Physics',
  spatial: '3D',
}

export const VIEW_HINTS: Record<ViewMode, string> = {
  layered: 'Columns by dependency depth — makes the affected cluster read as a band',
  physics: 'Pulls linked files together — makes circular imports visible as pairs',
  spatial: 'A volume you can move through — the blast radius spreads in every direction',
}
