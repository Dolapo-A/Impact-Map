import { describe, expect, it } from 'vitest'

import { compareWithRepository, shouldAutoMark } from '../src/lib/mismatch.ts'

const repo = [
  'src/index.ts',
  'src/utils/cart.ts',
  'src/utils/totals.ts',
]

describe('compareWithRepository', () => {
  it('reports a clean match when every file is present', () => {
    const outcome = compareWithRepository({
      pullRequestFiles: ['src/utils/cart.ts', 'src/index.ts'],
      repoFiles: repo,
    })

    expect(outcome).toEqual({
      kind: 'match',
      files: ['src/index.ts', 'src/utils/cart.ts'],
    })
  })

  it('lists the missing files by name on a partial match', () => {
    // Naming them is the whole point: "it did not work" gives the user nothing to
    // act on, and invites them to trust a graph that is quietly wrong.
    const outcome = compareWithRepository({
      pullRequestFiles: ['src/index.ts', 'src/does-not-exist.ts', 'src/gone.ts'],
      repoFiles: repo,
    })

    expect(outcome).toEqual({
      kind: 'partial',
      found: ['src/index.ts'],
      missing: ['src/does-not-exist.ts', 'src/gone.ts'],
    })
  })

  it('reports none-match when nothing overlaps, which means a different repository', () => {
    const outcome = compareWithRepository({
      pullRequestFiles: ['lib/foo.rb', 'lib/bar.rb'],
      repoFiles: repo,
    })

    expect(outcome).toEqual({
      kind: 'none-match',
      missing: ['lib/bar.rb', 'lib/foo.rb'],
    })
  })

  it('is sorted, so the notice does not reshuffle between runs', () => {
    const outcome = compareWithRepository({
      pullRequestFiles: ['z.ts', 'a.ts', 'm.ts'],
      repoFiles: [],
    })
    expect(outcome.kind === 'none-match' && outcome.missing).toEqual(['a.ts', 'm.ts', 'z.ts'])
  })

  it('handles a pull request that changed nothing', () => {
    const outcome = compareWithRepository({ pullRequestFiles: [], repoFiles: repo })
    expect(outcome).toEqual({ kind: 'match', files: [] })
  })
})

describe('compareWithRepository — files the tool does not graph', () => {
  const isTracked = (path: string) => /\.(ts|tsx|js|jsx)$/.test(path) && !path.endsWith('.d.ts')

  it('does not call a README or a lockfile missing', () => {
    // Nearly every real pull request touches package.json. Reporting that as a
    // mismatch would mean almost every PR raised a false alarm.
    const outcome = compareWithRepository({
      pullRequestFiles: ['src/index.ts', 'package.json', 'README.md'],
      repoFiles: ['src/index.ts', 'src/utils/cart.ts'],
      isTracked,
    })

    expect(outcome).toEqual({ kind: 'match', files: ['src/index.ts'] })
  })

  it('treats a pull request that changed nothing tracked as a match, not a mismatch', () => {
    const outcome = compareWithRepository({
      pullRequestFiles: ['README.md', 'LICENSE'],
      repoFiles: ['src/index.ts'],
      isTracked,
    })

    expect(outcome).toEqual({ kind: 'match', files: [] })
  })

  it('still reports a genuinely absent source file', () => {
    const outcome = compareWithRepository({
      pullRequestFiles: ['src/index.ts', 'src/vanished.ts'],
      repoFiles: ['src/index.ts'],
      isTracked,
    })

    expect(outcome).toEqual({ kind: 'partial', found: ['src/index.ts'], missing: ['src/vanished.ts'] })
  })
})

describe('shouldAutoMark', () => {
  it('auto-marks only on a clean match', () => {
    expect(shouldAutoMark({ kind: 'match', files: ['a.ts'] })).toBe(true)
  })

  it('refuses to auto-mark on a partial match', () => {
    // Silently marking the files that happen to be present would draw the blast
    // radius of a change the user did not make, and would look entirely plausible.
    expect(shouldAutoMark({ kind: 'partial', found: ['a.ts'], missing: ['b.ts'] })).toBe(false)
  })

  it('refuses to auto-mark when nothing matches', () => {
    expect(shouldAutoMark({ kind: 'none-match', missing: ['a.ts'] })).toBe(false)
  })
})
