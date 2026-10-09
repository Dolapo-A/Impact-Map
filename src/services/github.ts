/**
 * Reading a public pull request's changed files from GitHub.
 *
 * This is the product's only external service, and it is also the place where a
 * confident wrong answer is most tempting. Every failure therefore resolves to a
 * *named reason* rather than a message, so the caller can say what actually
 * happened instead of guessing.
 *
 * The distinction that matters most: a private repository, a deleted repository and
 * a typo all return HTTP 404, and GitHub deliberately does not say which. The
 * honest report is therefore "this pull request can't be read" — never "this
 * repository is private", which we cannot know.
 */

export interface PullRequestRef {
  owner: string
  repo: string
  number: number
}

export interface PullRequestFiles {
  ref: PullRequestRef
  /** Relative file paths, as GitHub reports them, sorted for a stable result. */
  files: string[]
}

/**
 * Why a lookup failed. Each cause needs different words and a different way
 * forward, so they are separate variants rather than one error string.
 */
export type LookupFailure =
  /** 404 — private, deleted, or wrong. Indistinguishable, and reported honestly as such. */
  | { kind: 'unreadable' }
  /** 403 — the unauthenticated hourly limit was reached. */
  | { kind: 'rate-limited' }
  /** The request never completed: offline, DNS failure, CORS, the tab closed. */
  | { kind: 'network' }
  /** The pasted text is not a pull request URL at all. */
  | { kind: 'not-a-pr-url'; input: string }
  /** GitHub answered, but not with the shape we asked for. */
  | { kind: 'unexpected-response' }

export type LookupResult =
  | { ok: true; value: PullRequestFiles }
  | { ok: false; failure: LookupFailure }

/**
 * Pull owner, repo and number out of a pasted pull request URL.
 *
 * Accepts the shapes a person actually pastes: the full URL, a URL with a trailing
 * path or query string, and a bare `owner/repo#123` form. Returns null for anything
 * else, which the caller reports rather than silently ignoring.
 */
export function parsePullRequestUrl(input: string): PullRequestRef | null {
  const trimmed = input.trim()
  if (trimmed.length === 0) return null

  // Full URL form. The path is /owner/repo/pull/123, optionally followed by more
  // segments (a file view, a commit) which we ignore.
  const urlMatch = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)(?:[/?#].*)?$/i,
  )
  if (urlMatch) {
    const [, owner, repo, number] = urlMatch
    if (owner === undefined || repo === undefined || number === undefined) return null
    // A pull request, not an issue: `/issues/12` is a different thing entirely.
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null
    return { owner, repo, number: Number(number) }
  }

  // Shorthand: owner/repo#123
  const shortMatch = trimmed.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/)
  if (shortMatch) {
    const [, owner, repo, number] = shortMatch
    if (owner === undefined || repo === undefined || number === undefined) return null
    return { owner, repo, number: Number(number) }
  }

  return null
}

const API_ROOT = 'https://api.github.com'

/** How many files to request. GitHub caps this per page, so it stays modest. */
const PAGE_SIZE = 100

/**
 * Fetch a pull request's changed file names.
 *
 * Only `filename` is used — not the patch, not the diff. The tool reasons about
 * which files a change touches, not what is in it, and pulling diffs would be
 * both slower and more data than the product needs.
 */
export async function fetchPullRequestFiles(
  ref: PullRequestRef,
  fetchImpl: typeof fetch = fetch,
): Promise<LookupResult> {
  const url = `${API_ROOT}/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(
    ref.repo,
  )}/pulls/${ref.number}/files?per_page=${PAGE_SIZE}`

  let response: Response
  try {
    response = await fetchImpl(url, {
      headers: {
        // GitHub rejects requests with no identifying User-Agent.
        Accept: 'application/vnd.github+json',
      },
    })
  } catch {
    return { ok: false, failure: { kind: 'network' } }
  }

  if (response.status === 403 || response.status === 429) {
    // Could be a rate limit or a permission block; the only honest shared answer is
    // that the limit was hit, since that is the common cause for an anonymous call.
    const remaining = response.headers.get('x-ratelimit-remaining')
    if (remaining === '0' || response.status === 429) {
      return { ok: false, failure: { kind: 'rate-limited' } }
    }
    return { ok: false, failure: { kind: 'unreadable' } }
  }

  if (response.status === 404) {
    // Private, deleted, or simply wrong — GitHub returns one code for all three
    // and will not say which. Do not claim to know.
    return { ok: false, failure: { kind: 'unreadable' } }
  }

  if (!response.ok) {
    return { ok: false, failure: { kind: 'unexpected-response' } }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return { ok: false, failure: { kind: 'unexpected-response' } }
  }

  if (!Array.isArray(payload)) {
    return { ok: false, failure: { kind: 'unexpected-response' } }
  }

  const files: string[] = []
  for (const entry of payload) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'filename' in entry &&
      typeof (entry as { filename: unknown }).filename === 'string'
    ) {
      files.push((entry as { filename: string }).filename)
    }
  }

  return { ok: true, value: { ref, files: [...files].sort() } }
}

/** Pull request URL in, file list out — parse, then fetch. */
export async function lookupPullRequest(
  input: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LookupResult> {
  const ref = parsePullRequestUrl(input)
  if (ref === null) return { ok: false, failure: { kind: 'not-a-pr-url', input } }
  return fetchPullRequestFiles(ref, fetchImpl)
}

/** Plain, factual wording per cause. No emoji, no "Oops". */
export function describeFailure(failure: LookupFailure): string {
  switch (failure.kind) {
    case 'unreadable':
      return "This pull request can't be read. Impact Map only works with public repositories on GitHub."
    case 'rate-limited':
      return "GitHub's request limit was reached. Try again later, or mark files manually."
    case 'network':
      return "Couldn't reach GitHub. Mark files manually instead."
    case 'not-a-pr-url':
      return "That doesn't look like a GitHub pull request URL. It should look like github.com/owner/repo/pull/123."
    case 'unexpected-response':
      return 'GitHub returned an unexpected response. Mark files manually instead.'
  }
}
