import { describe, expect, it } from 'vitest'

import { resolveCssColors } from '../src/lib/css.ts'

describe('resolveCssColors', () => {
  it('falls back when there is no page to read', () => {
    // The test environment has no document, which is the same situation as
    // rendering on a server. The fallbacks are the answer, not a crash.
    const resolved = resolveCssColors({
      background: { variable: '--bg', fallback: '#0d1117' },
      accent: { variable: '--accent', fallback: '#58a6ff' },
    })

    expect(resolved.background).toBe('#0d1117')
    expect(resolved.accent).toBe('#58a6ff')
  })

  it('keeps one key per token', () => {
    const resolved = resolveCssColors({
      a: { variable: '--a', fallback: '#aaa' },
      b: { variable: '--b', fallback: '#bbb' },
      c: { variable: '--c', fallback: '#ccc' },
    })

    expect(Object.keys(resolved).sort()).toEqual(['a', 'b', 'c'])
  })
})
