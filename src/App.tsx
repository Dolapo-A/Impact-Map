import { useCallback, useState } from 'react'

import { FolderPicker } from './components/FolderPicker'
import { GraphCanvas } from './components/GraphCanvas'
import { LayoutToggle } from './components/LayoutToggle'
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
}

export default function App() {
  const [repository, setRepository] = useState<RepositoryState | null>(null)
  const [reading, setReading] = useState(false)
  const [changedPaths, setChangedPaths] = useState<Set<string>>(new Set())
  const [traceResult, setTraceResult] = useState<TraceResult | null>(null)
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('layered')
  const [error, setError] = useState<string | null>(null)

  const handleFilesSelected = useCallback(async (files: SourceFile[], folderName: string) => {
    setReading(true)
    setError(null)
    setChangedPaths(new Set())
    setTraceResult(null)

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

      setRepository({ folderName, graph, coverage: findCoverage(graph) })
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

  return (
    <div className="app">
      <header className="control-strip">
        <div className="brand">
          <span className="brand-mark" />
          Impact Map
        </div>

        <FolderPicker onFilesSelected={handleFilesSelected} disabled={reading} />

        {repository && !reading && (
          <button
            className="button button-primary"
            type="button"
            disabled={changedPaths.size === 0}
            onClick={handleTrace}
          >
            Trace impact
          </button>
        )}

        {repository && <LayoutToggle mode={layoutMode} onChange={setLayoutMode} />}

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

      {repository && changedPaths.size > 0 && !traceResult && (
        <p className="notice notice-info">
          {changedPaths.size} file{changedPaths.size === 1 ? '' : 's'} marked. Press Trace impact to
          map what depends on {changedPaths.size === 1 ? 'it' : 'them'}.
        </p>
      )}

      {traceResult && traceResult.affected.size === 0 && (
        <p className="notice notice-info">No impact found inside this repository.</p>
      )}

      <main className="canvas-area">
        {repository ? (
          <GraphCanvas
            graph={repository.graph}
            coverage={repository.coverage}
            changedPaths={changedPaths}
            traceResult={traceResult}
            layoutMode={layoutMode}
            onNodeClick={(_, node) => toggleChangedPath(node.id)}
          />
        ) : (
          <div className="empty-state">
            <p className="empty-title">Choose a repository folder to see its dependency graph.</p>
            <p className="empty-hint">
              Files become nodes, imports become edges. Pick the bundled{' '}
              <code>sample-repo/</code> folder to try it.
            </p>
          </div>
        )}
      </main>

    </div>
  )
}
