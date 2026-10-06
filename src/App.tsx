import { useCallback, useState } from 'react'

import { FolderPicker } from './components/FolderPicker'
import { GraphCanvas } from './components/GraphCanvas'
import { buildGraph, type DependencyGraph, type SourceFile } from './lib/graph'
import { parseFile, type ImportStatement } from './lib/parser'
import { resolveToRepoFile } from './lib/resolve'

interface RepositoryState {
  folderName: string
  graph: DependencyGraph
}

export default function App() {
  const [repository, setRepository] = useState<RepositoryState | null>(null)
  const [reading, setReading] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFilesSelected = useCallback(async (files: SourceFile[], folderName: string) => {
    setReading(true)
    setError(null)
    setSelectedPath(null)

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

      setRepository({ folderName, graph })
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(`Could not read this folder: ${message}`)
    } finally {
      setReading(false)
    }
  }, [])

  return (
    <div className="app">
      <header className="control-strip">
        <div className="brand">
          <span className="brand-mark" />
          Impact Map
        </div>

        <FolderPicker onFilesSelected={handleFilesSelected} disabled={reading} />

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

      <main className="canvas-area">
        {repository ? (
          <GraphCanvas
            graph={repository.graph}
            selectedPath={selectedPath}
            onNodeClick={(_, node) => setSelectedPath(node.id)}
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

      {selectedPath && (
        <aside className="detail-placeholder">
          <h2>{selectedPath.replace('::external', '')}</h2>
          <p>Details arrive in a later step.</p>
        </aside>
      )}
    </div>
  )
}