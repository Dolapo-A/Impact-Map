import { useCallback, useState } from 'react'

import { FolderPicker } from './components/FolderPicker'
import { GraphCanvas } from './components/GraphCanvas'
import { DetailPanel } from './components/DetailPanel'
import { LayoutToggle } from './components/LayoutToggle'
import { Legend } from './components/Legend'
import { MismatchNotice } from './components/MismatchNotice'
import { PullRequestInput } from './components/PullRequestInput'
import { compareWithRepository, shouldAutoMark, type MismatchOutcome } from './lib/mismatch'
import type { LookupFailure, PullRequestFiles } from './services/github'
import { findCoverage, type CoverageByPath } from './lib/coverage'
import { buildGraph, type DependencyGraph, type SourceFile } from './lib/graph'
import type { LayoutMode } from './lib/layout'
import { parseFile, type ImportStatement } from './lib/parser'
import { resolveToRepoFile } from './lib/resolve'
import { traceImpact, type TraceResult } from './lib/trace'

interface RepositoryState {
  folderName: string
  graph: DependencyGraph
  coverage: CoverageByPath
  /** Every file present in the chosen folder, for the mismatch check. */
  repoFiles: Set<string>
}

interface PullRequestState {
  files: string[]
  outcome: MismatchOutcome
  /** The files that were present, kept so the notice can offer them explicitly. */
  found: string[]
}

export default function App() {
  const [repository, setRepository] = useState<RepositoryState | null>(null)
  const [reading, setReading] = useState(false)
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set())
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('layered')
  const [error, setError] = useState<string | null>(null)
  const [prFailure, setPrFailure] = useState<LookupFailure | null>(null)
  const [prState, setPrState] = useState<PullRequestState | null>(null)

  const handleFilesSelected = useCallback(async (files: SourceFile[], folderName: string) => {
    setReading(true)
    setError(null)
    setChangedPaths(new Set())
    setTraceResult(null)
    setSelectedPath(null)
    // A new folder invalidates any pull request read against the previous one.
    setPrFailure(null)
    setPrState(null)

    try {
      const repoFiles = new Set(files.map((file) => file.path))
      const importsByPath = new Map<string, ImportStatement[]>()

      for (const file of files) {
        const result = await parseFile(file.path, file.content)
        if (!result.parseFailed) importsByPath.set(file.path, result.imports)
      }

      const graph = buildGraph({
        files,
        importsByPath,
        repoFiles,
        resolve: (specifier, fromPath) => resolveToRepoFile(specifier, fromPath, repoFiles),
      })

      setRepository({ folderName, graph, coverage: findCoverage(graph), repoFiles })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(`Could not read this folder: ${message}`)
    } finally {
      setReading(false)
    }
  }, [])

  const toggleChangedPath = useCallback((path: string) => {
    setChangedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
    // The result is deliberately stale after selection changes. Trace is the
    // explicit moment the user asks to calculate a new blast radius.
    setTraceResult(null)
  }, [])

  const handleTrace = useCallback(() => {
    if (!repository || changedPaths.size === 0) return
    setTraceResult(traceImpact(repository.graph, changedPaths))
  }, [changedPaths, repository])

  /**
   * A pull request is only trusted when every file it names is in the chosen folder.
   * On a clean match the files are marked; otherwise the mismatch is reported and the
   * user decides. Marking a partial set would draw the blast radius of a change they
   * did not make, and it would look entirely plausible.
   */
  const handlePullRequest = useCallback(
    (pullRequest: PullRequestFiles) => {
      if (!repository) return

      setPrFailure(null)

      const outcome = compareWithRepository({
        pullRequestFiles: pullRequest.files,
        repoFiles: repository.repoFiles,
      })

      const found = outcome.kind === 'match' ? outcome.files : outcome.kind === 'partial' ? outcome.found : []

      if (shouldAutoMark(outcome) && outcome.kind === 'match') {
        setPrState(null)
        setChangedPaths(new Set(outcome.files))
        setTraceResult(null)
        return
      }

      setPrState({ files: pullRequest.files, outcome, found })
    },
    [repository],
  )

  const handlePullRequestFailure = useCallback((failure: LookupFailure) => {
    setPrState(null)
    setPrFailure(failure)
  }, [])

  const markPullRequestFiles = useCallback(
    (files: string[]) => {
      setChangedPaths(new Set(files))
      setTraceResult(null)
      setPrState(null)
      setPrFailure(null)
    },
    [],
  )

  return (
    <div className="app">
      <header className="control-strip">
        <div className="brand">
          <span className="brand-mark" />
          Impact Map
        </div>

        {/* Folder choice moves to the centre of the empty canvas — see EmptyState.
            Trace and layout move to a pill at the bottom. */}

        {reading && (
          <span className="status" role="status">
            Reading and parsing files…
          </span>
        )}

        {repository && !reading && (
          <span className="status">
            {repository.folderName} · {repository.graph.nodes.length} files ·{' '}
            {repository.graph.edges.filter((edge) => !edge.isExternal).length} imports
          </span>
        )}
      </header>

      {error && <p className="notice notice-error">{error}</p>}

      {repository?.graph.parseFailures.length ? (
        <p className="notice notice-warn">
          {repository.graph.parseFailures.length} file
          {repository.graph.parseFailures.length === 1 ? '' : 's'} could not be parsed:{' '}
          {repository.graph.parseFailures.slice(0, 4).join(', ')}
        </p>
      ) : null}

      {prFailure && (
        <MismatchNotice
          failure={prFailure}
          onDismiss={() => setPrFailure(null)}
        />
      )}

      {prState && (
        <MismatchNotice
          outcome={prState.outcome}
          found={prState.found}
          onMarkFound={() => markPullRequestFiles(prState.found)}
          onDismiss={() => setPrState(null)}
        />
      )}

      {traceResult && traceResult.affected.size === 0 && (
        <p className="notice notice-info">No impact found inside this repository.</p>
      )}

      <main className="canvas-area">
        {repository ? (
          <>
            <GraphCanvas
              graph={repository.graph}
              coverage={repository.coverage}
              changedPaths={changedPaths}
              traceResult={traceResult}
              layoutMode={layoutMode}
              // A click inspects. Marking is deliberate, from the panel — otherwise
              // reading a file would silently rewrite the change being traced.
              onNodeClick={(_, node) => setSelectedPath(node.id)}
            />
            <Legend />

            {/* Bottom-centre pill: the two things you act on, kept clear of the
                graph so nothing competes with it. */}
            <div className="action-dock">
              <button
                className="button button-primary"
                type="button"
                disabled={changedPaths.size === 0}
                onClick={handleTrace}
                title={
                  changedPaths.size === 0
                    ? 'Mark at least one file as changed first'
                    : `Trace from ${changedPaths.size} marked file${changedPaths.size === 1 ? '' : 's'}`
                }
              >
                Trace impact
                {changedPaths.size > 0 && (
                  <span className="action-count">{changedPaths.size}</span>
                )}
              </button>
              <LayoutToggle mode={layoutMode} onChange={setLayoutMode} />
              <span className="action-divider" aria-hidden="true" />
              <PullRequestInput
                disabled={false}
                onResolved={handlePullRequest}
                onFailed={handlePullRequestFailure}
              />
            </div>

            {selectedPath && (
              <DetailPanel
                path={selectedPath}
                graph={repository.graph}
                traceResult={traceResult}
                coverage={repository.coverage}
                isChanged={changedPaths.has(selectedPath.replace('::external', ''))}
                changedCount={changedPaths.size}
                onToggleChanged={toggleChangedPath}
                onClose={() => setSelectedPath(null)}
              />
            )}
          </>
        ) : (
          <div className="empty-state">
            {/* The one call to action, centred where the graph will appear. */}
            <FolderPicker
              onFilesSelected={handleFilesSelected}
              disabled={reading}
              centred
            />
            <p className="empty-hint">
              Files become nodes, imports become edges. Pick the bundled{' '}
              <code>sample-repo/</code> folder to try it. Nothing is uploaded — your code
              stays on this machine.
            </p>
          </div>
        )}
      </main>

    </div>
  )
}
