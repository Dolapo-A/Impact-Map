import { describe, expect, it } from 'vitest'

import { compareWithRepository, shouldAutoMark } from '../src/lib/mismatch.ts'
import { folderNameFrom, toRepoRelativePath } from '../src/lib/paths.ts'

describe('toRepoRelativePath', () => {
  it('strips the folder name the browser prepends', () => {
    // The browser reports `impact-map/src/index.ts`; GitHub reports `src/index.ts`.
    expect(toRepoRelativePath('impact-map/src/index.ts', 'impact-map')).toBe('src/index.ts')
  })

  it('strips a differently named folder', () => {
    expect(toRepoRelativePath('my-repo/src/utils/cart.ts', 'my-repo')).toBe(
      'src/utils/cart.ts',
    )
  })

  it('strips only the first segment', () => {
    expect(toRepoRelativePath('repo/packages/app/src/a.ts', 'repo')).toBe(
      'packages/app/src/a.ts',
    )
  })

  it('normalises Windows separators', () => {
    expect(toRepoRelativePath('repo\\src\\index.ts', 'repo')).toBe('src/index.ts')
  })

  it('leaves a bare filename alone', () => {
    expect(toRepoRelativePath('index.ts', 'repo')).toBe('index.ts')
  })

  it('still strips when the caller does not know the folder name', () => {
    expect(toRepoRelativePath('anything/src/a.ts')).toBe('src/a.ts')
  })
})

describe('folderNameFrom', () => {
  it('reads the folder name from a browser path', () => {
    expect(folderNameFrom('impact-map/src/index.ts')).toBe('impact-map')
  })
})

/**
 * The bug this guards against: stored paths carried the picked folder's name while
 * GitHub reports repository-relative paths, so a real pull request never matched
 * anything and every file was reported missing.
 */
describe('a real pull request against the same folder', () => {
  const githubFiles = [
    'src/index.ts',
    'src/utils/cart.ts',
    'src/utils/totals.ts',
  ]

  it('matches when the folder was read with paths relative to its root', () => {
    const stored = new Set(githubFiles.map((path) => toRepoRelativePath(`impact-map/${path}`, 'impact-map')))

    expect([...stored].sort()).toEqual(githubFiles)

    const outcome = compareWithRepository({ pullRequestFiles: githubFiles, repoFiles: stored })
    expect(outcome.kind).toBe('match')
    expect(shouldAutoMark(outcome)).toBe(true)
  })

  it('would fail if the folder name were left on the stored paths', () => {
    // Documents the failure mode directly, so a regression is legible.
    const stored = new Set(githubFiles.map((path) => `impact-map/${path}`))
    const outcome = compareWithRepository({ pullRequestFiles: githubFiles, repoFiles: stored })

    expect(outcome.kind).toBe('none-match')
    expect(shouldAutoMark(outcome)).toBe(false)
  })
})
