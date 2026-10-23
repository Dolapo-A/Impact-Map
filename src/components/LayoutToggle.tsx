import { VIEW_HINTS, VIEW_LABELS, VIEW_MODES, type ViewMode } from '../lib/views'

interface LayoutToggleProps {
  mode: ViewMode
  onChange: (mode: ViewMode) => void
}

/**
 * Switches between the three views of the graph.
 *
 * Columns encode distance-from-a-leaf as geometry, so the affected cluster reads
 * as a contiguous band. Physics pulls linked files together, so a circular
 * import becomes a visible pair. The third view puts the same graph in a volume,
 * where a change reaches outward in every direction at once.
 */
export function LayoutToggle({ mode, onChange }: LayoutToggleProps) {
  return (
    <div className="layout-toggle" role="group" aria-label="Graph view">
      <span className="layout-toggle-label">View</span>
      {VIEW_MODES.map((option) => (
        <button
          key={option}
          type="button"
          className={`toggle-option${mode === option ? ' is-active' : ''}`}
          aria-pressed={mode === option}
          title={VIEW_HINTS[option]}
          onClick={() => onChange(option)}
        >
          {VIEW_LABELS[option]}
        </button>
      ))}
    </div>
  )
}
