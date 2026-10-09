import { useRef, useState } from 'react'

import { shouldIncludeFile } from '../lib/files'
import { folderNameFrom, toRepoRelativePath } from '../lib/paths'
import type { SourceFile } from '../lib/graph'

interface FolderPickerProps {
  onFilesSelected: (files: SourceFile[], folderName: string) => void
  disabled: boolean
  /** Centres the button in the empty canvas instead of placing it in a bar. */
  centred?: boolean
}

const MAX_FILE_BYTES = 4 * 1024 * 1024

/**
 * Asks the user for a repository folder and reads its source files.
 *
 * The browser grants read access to exactly the folder the user picks. Nothing is
 * uploaded — the files are read in the page and never leave the machine.
 *
 * `webkitdirectory` preserves the tree structure, which is what makes folder
 * selection the right unit: an import pointing at a file the user didn't share
 * would be indistinguishable from an import of an external package.
 */
export function FolderPicker({ onFilesSelected, disabled, centred }: FolderPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? [])
    if (picked.length === 0) return

    setError(null)

    const folderName = folderNameFrom(picked[0].webkitRelativePath)
    // Stored relative to the chosen folder, so paths line up with the
    // repository-relative paths GitHub reports for a pull request.
    const sources = picked.filter((file) =>
      shouldIncludeFile(toRepoRelativePath(file.webkitRelativePath, folderName)),
    )

    if (sources.length === 0) {
      setError('No JavaScript or TypeScript source files found in this folder.')
      return
    }

    const files: SourceFile[] = []
    const skipped: string[] = []

    for (const file of sources) {
      const path = toRepoRelativePath(file.webkitRelativePath, folderName)
      // An oversized or unreadable file must not silently vanish from the graph.
      if (file.size > MAX_FILE_BYTES) {
        skipped.push(path)
        continue
      }
      try {
        const content = await file.text()
        files.push({ path, content })
      } catch {
        skipped.push(path)
      }
    }

    if (files.length === 0) {
      setError('No JavaScript or TypeScript source files could be read from this folder.')
      return
    }

    if (skipped.length > 0) {
      setError(
        `${skipped.length} file${skipped.length === 1 ? '' : 's'} could not be read and ${
          skipped.length === 1 ? 'is' : 'are'
        } not in the graph: ${skipped.slice(0, 3).join(', ')}${
          skipped.length > 3 ? `, and ${skipped.length - 3} more` : ''
        }`,
      )
    }

    onFilesSelected(files, folderName)
  }

  return (
    <div className={`folder-picker${centred ? ' is-centred' : ''}`}>
      <input
        ref={inputRef}
        type="file"
        multiple
        // @ts-expect-error -- non-standard but supported in every Chromium browser.
        webkitdirectory=""
        directory=""
        onChange={handleChange}
        style={{ display: 'none' }}
        data-testid="folder-input"
      />
      <button
        className="button button-primary"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        Choose repository folder
      </button>
      {!centred && (
        <span className="hint">Needs Chrome, Edge, Brave, or Arc. Your code stays on this machine.</span>
      )}
      {error && <p className="notice notice-error">{error}</p>}
    </div>
  )
}
