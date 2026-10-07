/**
 * The key to the two colour channels.
 *
 * Two independent encodings are unreadable without a key — a viewer who does not
 * already know the palette will read the colour as decoration. Both groups are
 * shown together so the separation between them is explicit: one answers "how far
 * from my change?", the other "is anything testing this?".
 *
 * The coverage swatches mirror the real node badges exactly — solid disc versus
 * hollow ring — because that shape difference is what carries the meaning when
 * blue and purple sit close on the spectrum.
 */
export function Legend() {
  return (
    <div className="legend">
      <div className="legend-group">
        <span className="legend-heading">Distance from change</span>
        <span className="legend-row">
          <span className="legend-swatch changed" />
          Changed
        </span>
        <span className="legend-row">
          <span className="legend-swatch affected" />
          Affected
        </span>
        <span className="legend-row">
          <span className="legend-swatch untouched" />
          Untouched
        </span>
      </div>

      <div className="legend-group">
        <span className="legend-heading">Test coverage</span>
        <span className="legend-row">
          <span className="legend-dot covered" />
          Has tests
        </span>
        <span className="legend-row">
          <span className="legend-dot uncovered" />
          No tests
        </span>
      </div>
    </div>
  )
}
