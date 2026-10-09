/**
 * Reconciling a pull request's file paths with the paths this tool stores.
 *
 * The browser reports selected files as `<folder>/<path inside folder>` — for
 * example `impact-map/src/index.ts`. GitHub reports a changed file relative to the
 * repository root — `src/index.ts`. Compared directly they never match, so every
 * file would be reported missing and nothing would ever be marked automatically.
 *
 * The folder name is therefore stripped when reading, so stored paths are always
 * relative to the root of the chosen folder and line up with GitHub. The chosen
 * folder is the unit of trust, so its own name is never part of a file's identity.
 */

/** Strip the leading folder segment the browser prepends to every selected path. */
export function toRepoRelativePath(browserPath: string, folderName?: string): string {
  const normalized = browserPath.replace(/\\/g, '/')
  const segments = normalized.split('/')

  // The first segment is the picked folder's name. Drop it, if it is really a
  // folder segment and not a bare filename.
  if (segments.length > 1) {
    const [first, ...rest] = segments
    if (first === folderName || first.length > 0) {
      return rest.join('/')
    }
  }

  return normalized
}

/** The folder name the browser puts in front of every selected path. */
export function folderNameFrom(browserPath: string): string {
  return browserPath.split('/')[0] ?? 'repository'
}
