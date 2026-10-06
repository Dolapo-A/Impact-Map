import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parseFile, isTypeScript, grammarFor } from '../src/lib/parser.ts'

const FIXTURES = resolve(import.meta.dirname, 'fixtures')

async function parseFixture(name: string) {
  const source = readFileSync(resolve(FIXTURES, name), 'utf8')
  return parseFile(name, source)
}

describe('isTypeScript', () => {
  it('recognises TypeScript extensions', () => {
    expect(isTypeScript('src/a.ts')).toBe(true)
    expect(isTypeScript('src/a.tsx')).toBe(true)
    expect(isTypeScript('src/a.mts')).toBe(true)
    expect(isTypeScript('src/a.js')).toBe(false)
    expect(isTypeScript('src/a.jsx')).toBe(false)
  })

  it('picks the right grammar per dialect', () => {
    expect(grammarFor('src/a.ts')).toBe('typescript')
    expect(grammarFor('src/a.tsx')).toBe('tsx')
    expect(grammarFor('src/a.js')).toBe('javascript')
    expect(grammarFor('src/a.jsx')).toBe('javascript')
  })
})

describe('parseFile — the WASM grammar loads and parses', () => {
  it('parses a multi-line import that spans several lines', async () => {
    // The case a regex would get wrong. If this passes, the real parser works.
    const { imports, parseFailed } = await parseFixture('multiline.ts')
    expect(parseFailed).toBe(false)
    expect(imports.map((i) => i.specifier)).toEqual(['./utils/cart', 'react'])
  })

  it('extracts static imports, re-exports, requires and dynamic imports', async () => {
    const { imports, parseFailed } = await parseFixture('all-forms.ts')
    expect(parseFailed).toBe(false)

    const bySpecifier = Object.fromEntries(imports.map((i) => [i.specifier, i.kind]))

    expect(bySpecifier['./static']).toBe('static')
    expect(bySpecifier['./reexported']).toBe('reexport')
    expect(bySpecifier['./required']).toBe('require')
    expect(bySpecifier['./dynamic']).toBe('dynamic')
    expect(bySpecifier['./side-effect']).toBe('static')
  })

  it('reports the line each import starts on', async () => {
    const { imports } = await parseFixture('all-forms.ts')
    const staticImport = imports.find((i) => i.specifier === './static')
    expect(staticImport?.line).toBe(1)
  })

  it('parses TSX with the TSX grammar, where generics and JSX coexist', async () => {
    // The plain TypeScript grammar misreads `<Props>` in a `.tsx` file; this
    // asserts the dedicated TSX grammar is selected and actually works.
    const { imports, parseFailed } = await parseFixture('widget.tsx')
    expect(parseFailed).toBe(false)
    expect(imports.map((i) => i.specifier)).toEqual(['react', '../utils/format'])
  })

  it('parses JavaScript with the JavaScript grammar', async () => {
    const { imports, parseFailed } = await parseFixture('plain.js')
    expect(parseFailed).toBe(false)
    expect(imports.map((i) => i.specifier)).toEqual(['./helper'])
  })

  it('does not treat string literals that are not imports as imports', async () => {
    const { imports } = await parseFixture('not-imports.ts')
    expect(imports).toHaveLength(0)
  })
})