/**
 * Comparing a pull request's changed files against the folder the user chose.
 *
 * This is the enforcement point for the product's central claim: that every claim
 * it makes traces back to real evidence. A PR URL and a folder that disagree would
 * otherwise produce a confident, entirely wrong graph — which would violate that
 * claim far more seriously than any missing feature would.
 *
 * Pure logic, no network and no UI, so the decision can be tested directly.
 */

export type MismatchOutcome =
  /** Every file the PR names exists in the folder. Safe to mark them. */
  | { kind: 'match'; files: string[] }
  /**
   * Some files are missing. Reported by name, because "it did not work" gives the
   * user nothing to act on and invites them to trust a wrong answer.
   */
  | { kind: 'partial'; found: string[]; missing: string[] }
  /** Not one of the PR's files is in the folder — almost certainly a different repository. */
  | { kind: 'none-match'; missing: string[] }

export interface MismatchInput {
  /** File paths the pull request says changed. */
  pullRequestFiles: string[]
  /** Paths actually present in the chosen folder. */
  repoFiles: Iterable<string>
  /**
   * Decides whether a file is one the tool would ever graph. Files it ignores —
   * `package.json`, a README, a lockfile — are not "missing", they are simply
   * out of scope, and counting them as missing would report a mismatch on nearly
   * every real pull request.
   */
  isTracked?: (path: string) => boolean
}

export function compareWithRepository({
  pullRequestFiles,
  repoFiles,
  isTracked = () => true,
}: MismatchInput): MismatchOutcome {
  const present = new Set(repoFiles)

  // Sorted so the notice and the graph are identical run to run.
  const found: string[] = []
  const missing: string[] = []

  for (const file of [...pullRequestFiles].sort()) {
    // Out of scope for this tool, so neither present nor absent. A PR that touches
    // only a README has not mismatched the folder.
    if (!isTracked(file)) continue

    if (present.has(file)) found.push(file)
    else missing.push(file)
  }

  // No tracked files at all: the pull request changed nothing this tool graphs.
  // That is not a mismatch, and saying so would be alarming and meaningless.
  if (found.length === 0 && missing.length === 0) return { kind: 'match', files: [] }

  if (missing.length === 0) return { kind: 'match', files: found }
  if (found.length === 0) return { kind: 'none-match', missing }
  return { kind: 'partial', found, missing }
}

/**
 * Whether the tool should mark the PR's files automatically.
 *
 * Only on a clean match. On a partial match the safe path is to say what is
 * missing and let the user decide, rather than silently dropping the files that
 * happen to be present — that would produce a graph of a change they did not make.
 */
export function shouldAutoMark(outcome: MismatchOutcome): boolean {
  return outcome.kind === 'match'
}
