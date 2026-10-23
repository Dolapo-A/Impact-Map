import { displayPath } from '../lib/files'
import type { DependencyGraph } from '../lib/graph'
import type { TraceResult } from '../lib/trace'
import type { CoverageByPath } from '../lib/coverage'

interface DetailPanelProps {
  path: string
  graph: DependencyGraph
  /** Null before the user presses Trace. The panel still opens — inspecting a file
   *  is useful on its own — but it cannot claim anything about impact yet. */
  traceResult: TraceResult | null
  coverage: CoverageByPath
  isChanged: boolean
  /** How many files are currently marked, so the copy can speak in numbers. */
  changedCount: number
  onToggleChanged: (path: string) => void
  onClose: () => void
}

type PanelSection =
  | { kind: 'not-traced'; testCount: number }
  | { kind: 'changed'; testCount: number }
  | { kind: 'affected'; distance: number; chain: string[]; testCount: number }
  | { kind: 'untouched'; importers: string[]; testCount: number }
  | { kind: 'external'; importedBy: string[] }

function describe(
  path: string,
  graph: DependencyGraph,
  traceResult: TraceResult | null,
  coverage: CoverageByPath,
): PanelSection {
  const testCount = coverage.get(path)?.length ?? 0
  const isExternal = path.endsWith('::external')

  const importedBy = graph.edges
    .filter((edge) => edge.isExternal && edge.from === path.replace('::external', ''))
    .map((edge) => edge.to)
  if (isExternal && importedBy.length > 0) {
    return { kind: 'external', importedBy: [...new Set(importedBy)].sort() }
  }

  // Without a trace, nothing can honestly be called affected or untouched. Saying
  // "not traced yet" is the truthful answer; guessing would violate the product's
  // claim that every statement traces back to a real edge.
  if (traceResult === null) {
    return { kind: 'not-traced', testCount }
  }

  if (traceResult.changed.has(path)) {
    return { kind: 'changed', testCount }
  }

  const chain = traceResult.pathTo.get(path)
  if (chain) {
    return {
      kind: 'affected',
      distance: traceResult.distance.get(path) ?? 0,
      chain,
      testCount,
    }
  }

  const importers = graph.edges
    .filter((edge) => !edge.isExternal && edge.to === path)
    .map((edge) => edge.from)

  return { kind: 'untouched', importers: [...new Set(importers)].sort(), testCount }
}

/**
 * Why this file is where it is, and what covers it.
 *
 * The import chain is shown verbatim — an actual path through the graph, not a
 * summary. That is the evidence the whole product rests on, so the panel never
 * paraphrases it. It sits beside the canvas rather than over it, so the clicked
 * file never loses its position relative to the change.
 */
export function DetailPanel({
  path,
  graph,
  traceResult,
  coverage,
  isChanged,
  changedCount,
  onToggleChanged,
  onClose,
}: DetailPanelProps) {
  const section = describe(path, graph, traceResult, coverage)
  const isExternal = path.endsWith('::external')
  const cleanPath = path.replace('::external', '')

  const status = (() => {
    switch (section.kind) {
      case 'changed':
        return 'Changed by you'
      case 'affected':
        return `Reached by your change`
      case 'untouched':
        return 'Out of reach'
      case 'external':
        return 'Outside this repository'
      default:
        return 'Not traced yet'
    }
  })()

  return (
    <aside className="detail-panel" aria-label={`Details for ${cleanPath}`}>
      <header className="detail-header">
        <div className="detail-heading-block">
          <span className="detail-status">{status}</span>
          <h2 className="detail-path" title={cleanPath}>
            {isExternal ? cleanPath : displayPath(cleanPath)}
          </h2>
        </div>
        <button type="button" className="detail-close" onClick={onClose} aria-label="Close details">
          <span aria-hidden="true" />
        </button>
      </header>

      {!isExternal && (
        // Clicking a node only *reads* it. Marking is a separate, explicit step,
        // and the label says which files that currently affects — otherwise the
        // button looks like it describes the file rather than your change set.
        <button
          type="button"
          className={`detail-mark${isChanged ? ' is-changed' : ''}`}
          onClick={() => onToggleChanged(cleanPath)}
        >
          {isChanged
            ? 'This is your change · click to remove'
            : 'Add to the files I changed'}
        </button>
      )}

      {section.kind === 'not-traced' && (
        <p className="detail-summary">
          {changedCount === 0
            ? 'Mark this file as changed to trace from it, or mark files elsewhere and press Trace impact.'
            : `You have marked ${changedCount} file${changedCount === 1 ? '' : 's'}. Press Trace impact to see what they reach.`}
        </p>
      )}

      {section.kind === 'changed' && (
        <p className="detail-summary">
          This file is one of the {changedCount} you marked as changed. Everything that
          depends on it is what the trace looks for.
        </p>
      )}

      {section.kind === 'affected' && (
        <>
          <p className="detail-summary">
            Reached through <strong>{section.chain.length - 1}</strong> import
            {section.chain.length - 1 === 1 ? '' : 's'} from your change.
          </p>

          <h3 className="detail-heading">Import chain</h3>
          {/* Shown verbatim, end to end, so every claim can be checked against the
              file it names. */}
          <ol className="chain">
            {section.chain.map((link, index) => (
              <li key={`${link}-${index}`} className={index === 0 ? 'chain-start' : undefined}>
                <code>{displayPath(link)}</code>
                {index === 0 && <span className="chain-tag">changed</span>}
              </li>
            ))}
          </ol>
        </>
      )}

      {section.kind === 'untouched' && (
        <>
          <p className="detail-summary">
            Nothing in this repository reaches this file from your change, so it is not
            affected.
          </p>
          {section.importers.length > 0 && (
            <>
              <h3 className="detail-heading">Imported by</h3>
              <ul className="detail-list">
                {section.importers.map((importer) => (
                  <li key={importer}>
                    <code>{displayPath(importer)}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {section.kind === 'external' && (
        <>
          <p className="detail-summary">
            Imported from outside this repository, so Impact Map does not analyse it.
          </p>
          <h3 className="detail-heading">Package</h3>
          <ul className="detail-list">
            {section.importedBy.map((name) => (
              <li key={name}>
                <code>{name}</code>
              </li>
            ))}
          </ul>
        </>
      )}

      {section.kind !== 'external' && (
        <>
          <h3 className="detail-heading">Test coverage</h3>
          {section.testCount > 0 ? (
            <ul className="detail-list">
              {coverage.get(cleanPath)!.map((testPath) => (
                <li key={testPath}>
                  <code>{displayPath(testPath)}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="detail-warning">
              No test in this repository imports this file, directly or through another
              module.
            </p>
          )}
        </>
      )}

      {graph.nodes.find((node) => node.path === cleanPath)?.parseFailed && (
        <p className="detail-warning">
          This file could not be parsed, so its imports are missing from the graph.
        </p>
      )}
    </aside>
  )
}
