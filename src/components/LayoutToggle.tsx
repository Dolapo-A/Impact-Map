import { LAYOUT_LABELS, LAYOUT_MODES, type LayoutMode } from '../lib/layout'

interface LayoutToggleProps {
  mode: LayoutMode
  onChange: (mode: LayoutMode) => void
}

/**
 * Switches between the three layouts.
 *
 * Columns encode distance-from-a-leaf as geometry, so the affected cluster reads
 * as a contiguous band. Physics pulls linked files together, so a circular import
 * becomes a visible pair. Radial puts the change at the centre so the blast radius
 * is the shape itself. None is the "right" one — which is why all three are here
 * rather than one being picked for the user.
 */
export function LayoutToggle({ mode, onChange }: LayoutToggleProps) {
  return (
    <div className="layout-toggle" role="group" aria-label="Graph layout">
      <span className="layout-toggle-label">Layout</span>
      {LAYOUT_MODES.map((option) => (
        <button
          key={option}
          type="button"
          className={`toggle-option${mode === option ? ' is-active' : ''}`}
          aria-pressed={mode === option}
          title={
            option === 'layered'
              ? 'Files in columns by dependency depth — makes the affected cluster read as a band'
              : option === 'physics'
                ? 'Files pull together along imports — makes circular imports visible as pairs'
                : 'Changed files at the centre, each ring further out — makes the blast radius the shape'
          }
          onClick={() => onChange(option)}
        >
          {LAYOUT_LABELS[option]}
        </button>
      ))}
    </div>
  )
}
