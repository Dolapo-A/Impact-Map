/**
 * Which files belong in the graph, and which are generated output to ignore.
 * Pure logic, no DOM — testable without a browser.
 */

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']

/** Directories that contain generated or third-party code. Never signal. */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.git',
  '.next',
  '.turbo',
  '.cache',
  'vendor',
])

/** Lockfiles: no imports, no signal. */
const SKIPPED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
])

function hasSourceExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

/** `foo.d.ts` and its variants are build output, not source you wrote. */
export function isDeclarationFile(path: string): boolean {
  return /\.d\.[cm]?ts$/i.test(path)
}

/** `foo.test.ts` / `foo.spec.tsx` — drives the test-coverage channel. */
export function isTestFile(path: string): boolean {
  return /\.(test|spec)\.[cm]?[jt]sx?$/i.test(path)
}

/** Minified bundles: long lines, mangled names. Not worth graphing. */
export function isMinified(path: string): boolean {
  return /\.(min|bundle)\.[cm]?js$/i.test(path)
}

/**
 * Decide whether one relative path should become a node.
 * Generated output is dropped rather than reported — it is expected, not a failure.
 */
export function shouldIncludeFile(path: string): boolean {
  if (!hasSourceExtension(path)) return false
  if (isDeclarationFile(path)) return false
  if (isMinified(path)) return false

  const segments = path.split('/')
  const filename = segments[segments.length - 1] ?? ''

  if (SKIPPED_FILENAMES.has(filename)) return false
  if (segments.some((segment) => SKIPPED_DIRECTORIES.has(segment))) return false

  // dotfiles and their contents (.github, .vscode) hold no imports worth tracing
  if (segments.some((segment) => segment.startsWith('.') && segment !== '.' && segment !== '..')) {
    return false
  }

  return true
}

/** Keep the last two path segments for display: `utils/cart.ts` rather than the full path. */
export function displayPath(path: string): string {
  const segments = path.split('/')
  return segments.length <= 2 ? path : segments.slice(-2).join('/')
}