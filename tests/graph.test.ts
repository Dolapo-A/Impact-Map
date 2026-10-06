import { describe, it, expect } from 'vitest'

import { buildGraph, type SourceFile } from '../src/lib/graph.ts'
import { resolveToRepoFile, resolveRelative } from '../src/lib/resolve.ts'
import type { ImportStatement } from '../src/lib/parser.ts'

const REPO_FILES = new Set([
  'src/index.ts',
  'src/utils/cart.ts',
  'src/utils/format.ts',
  'src/components/CartSummary.tsx',
  'src/data/products.json',
])

function resolver(specifier: string, fromPath: string) {
  return resolveToRepoFile(specifier, fromPath, REPO_FILES)
}

function file(path: string): SourceFile {
  return { path, content: '' }
}

function statement(specifier: string): ImportStatement {
  return { specifier, line: 1, kind: 'static' }
}

describe('resolveRelative', () => {
  it('resolves a sibling import', () => {
    expect(resolveRelative('./cart', 'src/utils/price.ts')).toBe('src/utils/cart')
  })

  it('resolves a parent-directory import', () => {
    expect(resolveRelative('../utils/cart', 'src/api/orders.ts')).toBe('src/utils/cart')
  })

  it('resolves a current-directory import', () => {
    expect(resolveRelative('./sub/thing', 'src/a.ts')).toBe('src/sub/thing')
  })

  it('returns null for a bare package specifier', () => {
    expect(resolveRelative('react', 'src/a.ts')).toBeNull()
    expect(resolveRelative('@scope/pkg', 'src/a.ts')).toBeNull()
  })

  it('returns null when a relative path climbs above the repository root', () => {
    // `../..` from a top-level file has nowhere left to go.
    expect(resolveRelative('../../outside', 'src/a.ts')).toBeNull()
  })
})

describe('resolveToRepoFile', () => {
  it('finds a file with no extension in the specifier', () => {
    expect(resolveToRepoFile('./utils/cart', 'src/index.ts', REPO_FILES)).toBe('src/utils/cart.ts')
  })

  it('finds a file when the specifier already names the extension', () => {
    expect(resolveToRepoFile('./utils/cart.ts', 'src/index.ts', REPO_FILES)).toBe('src/utils/cart.ts')
  })

  it('resolves a TypeScript import written with a .js extension', () => {
    // This is common in ESM-first TypeScript and must resolve to the .ts source.
    expect(resolveToRepoFile('./utils/cart.js', 'src/index.ts', REPO_FILES)).toBe('src/utils/cart.ts')
  })

  it('resolves a directory import to its index file', () => {
    const files = new Set([...REPO_FILES, 'src/utils/index.ts'])
    expect(resolveToRepoFile('./utils', 'src/index.ts', files)).toBe('src/utils/index.ts')
  })

  it('returns null for a package that is not in the repository', () => {
    expect(resolveToRepoFile('react', 'src/index.ts', REPO_FILES)).toBeNull()
    expect(resolveToRepoFile('./nowhere', 'src/index.ts', REPO_FILES)).toBeNull()
  })
})

describe('buildGraph', () => {
  it('creates one node per file and marks test files', () => {
    const files = [file('src/index.ts'), file('src/utils/cart.test.ts')]
    const graph = buildGraph({
      files,
      importsByPath: new Map([
        ['src/index.ts', [statement('./utils/cart')]],
        ['src/utils/cart.test.ts', [statement('./cart')]],
      ]),
      repoFiles: REPO_FILES,
      resolve: resolver,
    })

    expect(graph.nodes).toHaveLength(2)
    expect(graph.nodes.find((n) => n.path === 'src/utils/cart.test.ts')?.isTest).toBe(true)
    expect(graph.nodes.find((n) => n.path === 'src/index.ts')?.isTest).toBe(false)
  })

  it('turns a resolvable import into an internal edge', () => {
    const graph = buildGraph({
      files: [file('src/index.ts')],
      importsByPath: new Map([['src/index.ts', [statement('./utils/cart')]]]),
      repoFiles: REPO_FILES,
      resolve: resolver,
    })

    expect(graph.edges).toEqual([
      { from: 'src/index.ts', to: 'src/utils/cart.ts', isExternal: false },
    ])
  })

  it('marks a bare package specifier as an external edge rather than an error', () => {
    const graph = buildGraph({
      files: [file('src/index.ts')],
      importsByPath: new Map([['src/index.ts', [statement('react')]]]),
      repoFiles: REPO_FILES,
      resolve: resolver,
    })

    expect(graph.edges).toEqual([
      { from: 'src/index.ts', to: 'react', isExternal: true },
    ])
    expect(graph.externalModules).toEqual(['react'])
    expect(graph.parseFailures).toEqual([])
  })

  it('collapses a duplicate import of the same module into one edge', () => {
    const graph = buildGraph({
      files: [file('src/index.ts')],
      importsByPath: new Map([
        ['src/index.ts', [statement('./utils/cart'), statement('./utils/cart')]],
      ]),
      repoFiles: REPO_FILES,
      resolve: resolver,
    })

    expect(graph.edges).toHaveLength(1)
  })

  it('records a parse failure by name and still keeps the node', () => {
    const graph = buildGraph({
      files: [file('src/broken.ts')],
      // No entry in importsByPath means the file failed to parse.
      importsByPath: new Map(),
      repoFiles: REPO_FILES,
      resolve: resolver,
    })

    expect(graph.parseFailures).toEqual(['src/broken.ts'])
    expect(graph.nodes).toHaveLength(1)
    expect(graph.nodes[0].parseFailed).toBe(true)
  })

  it('builds a cycle without complaint — circular imports are legal', () => {
    const graph = buildGraph({
      files: [file('src/a.ts'), file('src/b.ts')],
      importsByPath: new Map([
        ['src/a.ts', [statement('./b')]],
        ['src/b.ts', [statement('./a')]],
      ]),
      repoFiles: new Set(['src/a.ts', 'src/b.ts']),
      resolve: (specifier, fromPath) =>
        specifier === './b' ? 'src/b.ts' : specifier === './a' ? 'src/a.ts' : null,
    })

    expect(graph.edges).toHaveLength(2)
    expect(graph.parseFailures).toEqual([])
  })
})