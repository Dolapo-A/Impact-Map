/**
 * Resolving an import specifier to a path inside the repository.
 * Pure logic, no DOM.
 */

/** Extensions tried, in order, when a specifier has no extension of its own. */
const RESOLVE_ORDER = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']

/**
 * Resolve a relative specifier (`./cart`, `../utils/price`) against the file
 * that imported it. Returns a normalized repo-relative path, or null if the
 * specifier points outside the repository root.
 *
 * Non-relative specifiers (bare packages like `react`) return null — they are
 * external, handled by the graph builder.
 */
export function resolveRelative(specifier: string, fromPath: string): string | null {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return null

  const fromDir = fromPath.split('/').slice(0, -1)
  const segments = [...fromDir]

  for (const part of specifier.split('/')) {
    if (part === '.' || part === '') continue
    if (part === '..') {
      if (segments.length === 0) return null // climbed above the repo root
      segments.pop()
      continue
    }
    segments.push(part)
  }

  return segments.join('/')
}

/** Strip a `.js`/`.mjs` extension — TypeScript sources are often imported with a JS extension. */
function stripJsExtension(path: string): string {
  return path.replace(/\.(m|c)?js$/, '')
}

/**
 * Given the set of files in the repository, find which one a specifier names.
 * Tries the literal path, then each candidate extension, then `/index.*` for a
 * directory import. Returns null when nothing in the repository matches —
 * an external package, or a file outside the chosen folder.
 */
export function resolveToRepoFile(
  specifier: string,
  fromPath: string,
  repoFiles: Set<string>,
): string | null {
  const resolved = resolveRelative(specifier, fromPath)
  if (resolved === null) return null

  const withoutExtension = stripJsExtension(resolved)

  if (repoFiles.has(withoutExtension)) return withoutExtension

  for (const ext of RESOLVE_ORDER) {
    if (repoFiles.has(withoutExtension + ext)) return withoutExtension + ext
  }

  // A directory import: `import x from './utils'` → `utils/index.ts`
  for (const ext of RESOLVE_ORDER) {
    const indexPath = `${withoutExtension}/index${ext}`
    if (repoFiles.has(indexPath)) return indexPath
  }

  return null
}

/**
 * Given one changed file, which other files does the repository reach *through* it.
 * This is the importer/dependency direction: if `cart.ts` imports `price.ts`, then
 * changing `price.ts` affects `cart.ts`, so the edge points importer → imported.
 */
export function importersOf(targetPath: string, importers: Map<string, Set<string>>): Set<string> {
  return importers.get(targetPath) ?? new Set<string>()
}

/** Build the reverse index of the dependency graph: imported file → files that import it. */
export function buildImporterIndex(edges: Array<{ from: string; to: string }>): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>()

  for (const edge of edges) {
    const existing = index.get(edge.to)
    if (existing) {
      existing.add(edge.from)
    } else {
      index.set(edge.to, new Set([edge.from]))
    }
  }

  return index
}