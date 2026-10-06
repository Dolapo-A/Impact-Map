import { describe, it, expect } from 'vitest'

import { displayPath, isTestFile, shouldIncludeFile } from '../src/lib/files.ts'

describe('shouldIncludeFile', () => {
  it('keeps JavaScript and TypeScript source', () => {
    expect(shouldIncludeFile('src/index.ts')).toBe(true)
    expect(shouldIncludeFile('src/app.tsx')).toBe(true)
    expect(shouldIncludeFile('src/legacy.js')).toBe(true)
    expect(shouldIncludeFile('src/view.jsx')).toBe(true)
  })

  it('drops dependencies and build output', () => {
    expect(shouldIncludeFile('node_modules/react/index.js')).toBe(false)
    expect(shouldIncludeFile('dist/bundle.js')).toBe(false)
    expect(shouldIncludeFile('build/main.js')).toBe(false)
  })

  it('drops declaration files, which are generated from source', () => {
    expect(shouldIncludeFile('src/types.d.ts')).toBe(false)
    expect(shouldIncludeFile('types/index.d.mts')).toBe(false)
  })

  it('drops lockfiles', () => {
    expect(shouldIncludeFile('package-lock.json')).toBe(false)
    expect(shouldIncludeFile('pnpm-lock.yaml')).toBe(false)
  })

  it('drops minified bundles', () => {
    expect(shouldIncludeFile('public/app.min.js')).toBe(false)
  })

  it('drops non-source files', () => {
    expect(shouldIncludeFile('README.md')).toBe(false)
    expect(shouldIncludeFile('src/styles.css')).toBe(false)
    expect(shouldIncludeFile('src/data/products.json')).toBe(false)
  })

  it('drops dotfile directories', () => {
    expect(shouldIncludeFile('.github/scripts/build.ts')).toBe(false)
    expect(shouldIncludeFile('.vscode/tasks.ts')).toBe(false)
  })

  it('keeps test files — they drive the coverage channel', () => {
    expect(shouldIncludeFile('src/utils/cart.test.ts')).toBe(true)
    expect(shouldIncludeFile('src/utils/cart.spec.ts')).toBe(true)
  })
})

describe('isTestFile', () => {
  it('recognises the common test naming conventions', () => {
    expect(isTestFile('src/cart.test.ts')).toBe(true)
    expect(isTestFile('src/cart.spec.tsx')).toBe(true)
    expect(isTestFile('src/cart.test.js')).toBe(true)
  })

  it('does not mistake ordinary files for tests', () => {
    expect(isTestFile('src/cart.ts')).toBe(false)
    expect(isTestFile('src/latest.ts')).toBe(false)
    expect(isTestFile('src/contest.tsx')).toBe(false)
  })
})

describe('displayPath', () => {
  it('keeps short paths whole', () => {
    expect(displayPath('index.ts')).toBe('index.ts')
    expect(displayPath('src/cart.ts')).toBe('src/cart.ts')
  })

  it('trims deep paths to the last two segments', () => {
    expect(displayPath('src/lib/deep/cart.ts')).toBe('deep/cart.ts')
  })
})