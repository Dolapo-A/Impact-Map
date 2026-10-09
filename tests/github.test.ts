import { describe, expect, it } from 'vitest'

import {
  describeFailure,
  fetchPullRequestFiles,
  lookupPullRequest,
  parsePullRequestUrl,
  type LookupFailure,
} from '../src/services/github.ts'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

describe('parsePullRequestUrl', () => {
  it('reads a plain pull request URL', () => {
    expect(
      parsePullRequestUrl('https://github.com/facebook/react/pull/28016'),
    ).toEqual({ owner: 'facebook', repo: 'react', number: 28016 })
  })

  it('ignores a www prefix, a trailing path, and a query string', () => {
    expect(
      parsePullRequestUrl('https://www.github.com/vercel/next.js/pull/12345/files?w=1'),
    ).toEqual({ owner: 'vercel', repo: 'next.js', number: 12345 })
  })

  it('accepts the owner/repo#number shorthand', () => {
    expect(parsePullRequestUrl('facebook/react#28016')).toEqual({
      owner: 'facebook',
      repo: 'react',
      number: 28016,
    })
  })

  it('tolerates surrounding whitespace', () => {
    expect(parsePullRequestUrl('  https://github.com/a/b/pull/7  ')).toEqual({
      owner: 'a',
      repo: 'b',
      number: 7,
    })
  })

  it('rejects an issue URL — a different thing from a pull request', () => {
    // `/issues/7` is not a pull request, and marking its files would be wrong.
    expect(parsePullRequestUrl('https://github.com/facebook/react/issues/28016')).toBeNull()
  })

  it('rejects a repository URL with no pull request number', () => {
    expect(parsePullRequestUrl('https://github.com/facebook/react')).toBeNull()
  })

  it('rejects an unrelated host', () => {
    expect(parsePullRequestUrl('https://gitlab.com/owner/repo/pull/1')).toBeNull()
    expect(parsePullRequestUrl('https://evil.example/owner/repo/pull/1')).toBeNull()
  })

  it('rejects empty and nonsense input', () => {
    expect(parsePullRequestUrl('')).toBeNull()
    expect(parsePullRequestUrl('   ')).toBeNull()
    expect(parsePullRequestUrl('just some words')).toBeNull()
    expect(parsePullRequestUrl('https://github.com/owner/repo/pull/abc')).toBeNull()
  })

  it('rejects a missing number segment', () => {
    expect(parsePullRequestUrl('https://github.com/owner/repo/pull/')).toBeNull()
  })
})

describe('fetchPullRequestFiles', () => {
  const ref = { owner: 'facebook', repo: 'react', number: 28016 }

  it('returns the changed file names, sorted', async () => {
    const fetchImpl = async () =>
      jsonResponse([{ filename: 'src/b.ts' }, { filename: 'src/a.ts' }])

    const result = await fetchPullRequestFiles(ref, fetchImpl as unknown as typeof fetch)
    expect(result).toEqual({
      ok: true,
      value: { ref, files: ['src/a.ts', 'src/b.ts'] },
    })
  })

  it('ignores entries with no filename rather than failing the whole lookup', async () => {
    const fetchImpl = async () => jsonResponse([{ filename: 'src/a.ts' }, { nonsense: true }])

    const result = await fetchPullRequestFiles(ref, fetchImpl as unknown as typeof fetch)
    expect(result.ok && result.value.files).toEqual(['src/a.ts'])
  })

  it('reports 404 as unreadable, not as "private"', async () => {
    // GitHub returns one status for private, deleted and wrong. Claiming to know
    // which would be a guess dressed as evidence.
    const fetchImpl = async () => new Response('', { status: 404 })

    const result = await fetchPullRequestFiles(ref, fetchImpl as unknown as typeof fetch)
    expect(result.ok).toBe(false)
    expect(!result.ok && result.failure.kind).toBe('unreadable')
  })

  it('reports an exhausted rate limit distinctly from an unreadable PR', async () => {
    const fetchImpl = async () =>
      new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } })

    const result = await fetchPullRequestFiles(ref, fetchImpl as unknown as typeof fetch)
    expect(!result.ok && result.failure.kind).toBe('rate-limited')
  })

  it('reports 429 as a rate limit too', async () => {
    const fetchImpl = async () => new Response('', { status: 429 })
    const result = await fetchPullRequestFiles(ref, fetchImpl as unknown as typeof fetch)
    expect(!result.ok && result.failure.kind).toBe('rate-limited')
  })

  it('reports a rejected request as a network problem', async () => {
    const fetchImpl = async () => {
      throw new TypeError('Failed to fetch')
    }

    const result = await fetchPullRequestFiles(ref, fetchImpl as unknown as typeof fetch)
    expect(!result.ok && result.failure.kind).toBe('network')
  })

  it('reports a body that is not a list as unexpected', async () => {
    const fetchImpl = async () => jsonResponse({ message: 'Not Found' })
    const result = await fetchPullRequestFiles(ref, fetchImpl as unknown as typeof fetch)
    expect(!result.ok && result.failure.kind).toBe('unexpected-response')
  })

  it('sends an Accept header, since GitHub rejects requests without one', async () => {
    let seen: Record<string, string> = {}
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      seen = (init?.headers ?? {}) as Record<string, string>
      return jsonResponse([])
    }

    await fetchPullRequestFiles(ref, fetchImpl as unknown as typeof fetch)
    expect(seen.Accept).toBe('application/vnd.github+json')
  })

  it('handles a pull request that changes no files', async () => {
    const fetchImpl = async () => jsonResponse([])
    const result = await fetchPullRequestFiles(ref, fetchImpl as unknown as typeof fetch)
    expect(result.ok && result.value.files).toEqual([])
  })
})

describe('lookupPullRequest', () => {
  it('rejects unparseable input before making any request', async () => {
    let called = false
    const fetchImpl = async () => {
      called = true
      return jsonResponse([])
    }

    const result = await lookupPullRequest('not a url', fetchImpl as unknown as typeof fetch)
    expect(called).toBe(false)
    expect(!result.ok && result.failure.kind).toBe('not-a-pr-url')
  })

  it('fetches when the URL parses', async () => {
    const fetchImpl = async () => jsonResponse([{ filename: 'a.ts' }])
    const result = await lookupPullRequest(
      'https://github.com/owner/repo/pull/1',
      fetchImpl as unknown as typeof fetch,
    )
    expect(result.ok && result.value.files).toEqual(['a.ts'])
  })
})

describe('describeFailure', () => {
  it('gives a different sentence and a different remedy for every cause', () => {
    // The mismatch check's whole value is that causes stay distinguishable, so two
    // causes sharing a message would collapse them.
    const messages = (['unreadable', 'rate-limited', 'network', 'unexpected-response'] as const).map(
      (kind) => describeFailure({ kind } as LookupFailure),
    )
    expect(new Set(messages).size).toBe(messages.length)
  })

  it('does not claim a repository is private, because 404 cannot tell us', () => {
    expect(describeFailure({ kind: 'unreadable' }).toLowerCase()).not.toContain('private')
  })

  it('always offers a way forward', () => {
    for (const kind of ['unreadable', 'rate-limited', 'network', 'unexpected-response'] as const) {
      expect(describeFailure({ kind })).toMatch(/later|manually|public/i)
    }
  })

  it('names the expected shape for a URL it could not read', () => {
    expect(describeFailure({ kind: 'not-a-pr-url', input: 'x' })).toContain('github.com')
  })
})
