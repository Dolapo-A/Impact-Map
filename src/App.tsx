import { useCallback, useMemo, useState } from 'react'

import { DetailPanel } from './components/DetailPanel'
import { FolderPicker } from './components/FolderPicker'
import { GraphCanvas } from './components/GraphCanvas'
import { Hero } from './components/Hero'
import { LayoutToggle } from './components/LayoutToggle'
import { Legend } from './components/Legend'
import { MismatchNotice } from './components/MismatchNotice'
import { PullRequestInput } from './components/PullRequestInput'
import { ThemeSwitcher } from './components/ThemeSwitcher'
import { compareWithRepository, shouldAutoMark, type MismatchOutcome } from './lib/mismatch'
import type { LookupFailure, PullRequestFiles } from './services/github'
import { findCoverage, type CoverageByPath } from './lib/coverage'
import { buildGraph, type DependencyGraph, type SourceFile } from './lib/graph'
import { shouldIncludeFile } from './lib/files'
import type { ViewMode } from './lib/views'
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
  const [viewMode, setViewMode] = useState<ViewMode>('layered')
  const [error, setError] = useState<string | null>(null)
  const [prFailure, setPrFailure] = useState<LookupFailure | null>(null)
  const [prState, setPrState] = useState<PullRequestState | null>(null)
  /** Bumped when the detail panel opens or closes, because that resizes the canvas. */
  const [panelEpoch, setPanelEpoch] = useState(0)

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

  const toggleChangedPath = useCallback((path: string) => {    setChangedPaths((current) => {
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
   * Opening or closing the detail panel resizes the canvas, so the graph has to
   * settle onto its new shape rather than leave files off the edge.
   */
  const selectPath = useCallback((path: string | null) => {
    setSelectedPath(path)
    setPanelEpoch((epoch) => epoch + 1)
  }, [])

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
        // A PR that also touches a README or a lockfile has not mismatched the
        // folder — the tool simply does not graph those files.
        isTracked: shouldIncludeFile,
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

  /**
   * The one line of guidance, placed where the eye already is.
   * The graph is the product, so the screen has no room for a tutorial. What it
   * does have room for is a sentence that says what to do next, and changes when
   * the next thing changes.
   */
  const hint = useMemo(() => {
    if (changedPaths.size === 0) {
      return 'Open a file to read it, then mark it as changed. You can paste a pull request URL above instead.'
    }
    if (!traceResult) {
      return `${changedPaths.size} file${changedPaths.size === 1 ? '' : 's'} marked. Trace impact to see what ${
        changedPaths.size === 1 ? 'it reaches' : 'they reach'
      }.`
    }
    const reached = traceResult.affected.size
    if (reached === 0) {
      return 'Nothing in this repository imports the files you marked.'
    }
    return `${reached} file${reached === 1 ? '' : 's'} reach your change. Open one for the imports that connect it back.`
  }, [changedPaths.size, traceResult])

  if (!repository) {
    return <Hero onFilesSelected={handleFilesSelected} disabled={reading} />
  }

  return (
    <div className="app">
      <header className="control-strip">
        <div className="brand">
          <span className="brand-mark" />
          Impact Map
        </div>

        {/* Once a repository is loaded, the picker moves up here. Without it the
            user has no way to choose a different folder and must refresh the page —
            the button disappearing after its first use was a real dead end. */}
        <FolderPicker
          variant="bar"
          onFilesSelected={handleFilesSelected}
          disabled={reading}
          showHint={false}
        />

        {reading ? (
          <span className="status" role="status">
            Reading and parsing files…
          </span>
        ) : (
          <span className="status">
            {repository.folderName} · {repository.graph.nodes.length} files ·{' '}
            {repository.graph.edges.filter((edge) => !edge.isExternal).length} imports
          </span>
        )}

        <PullRequestInput
          disabled={false}
          onResolved={handlePullRequest}
          onFailed={handlePullRequestFailure}
        />

        <ThemeSwitcher />
      </header>

      {error && <p className="notice notice-error">{error}</p>}

      {repository.graph.parseFailures.length ? (
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

      <div className="workspace">
        <div className="workspace-canvas">
          <GraphCanvas
            graph={repository.graph}
            coverage={repository.coverage}
            changedPaths={changedPaths}
            traceResult={traceResult}
            viewMode={viewMode}
            fitSignal={panelEpoch}
            // A click inspects. Marking is deliberate, from the panel — otherwise
            // reading a file would silently rewrite the change being traced.
            onNodeClick={selectPath}
          />

          <Legend />

          <p className="workspace-hint">{hint}</p>

          {/* Bottom-centre dock: the two things the user acts on, kept clear of the
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
            <span className="action-divider" aria-hidden="true" />
            <LayoutToggle mode={viewMode} onChange={setViewMode} />
          </div>
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
            onClose={() => selectPath(null)}
          />
        )}
      </div>
    </div>
  )
}
