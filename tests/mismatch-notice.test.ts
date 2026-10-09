import { describe, expect, it } from 'vitest'

import { MismatchNotice } from '../src/components/MismatchNotice.tsx'
import type { MismatchOutcome } from '../src/lib/mismatch.ts'
import type { PullRequestFiles } from '../src/services/github.ts'
import { buildGraph, type SourceFile } from '../src/lib/graph.ts'
import type { ImportStatement } from '../src/lib/parser.ts'

const files: SourceFile[] = [
  'src/a.ts',
  'src/b.ts',
].map((path) => ({ path, content: '' }))

const graph = buildGraph({
  files,
  importsByPath: new Map<string, ImportStatement[]>([
    ['src/a.ts', []],
    ['src/b.ts', []],
  ]),
  repoFiles: new Set(files.map((f) => f.path)),
  resolve: () => null,
})

function render(
  outcome: MismatchOutcome,
  found: string[],
  failure?: Parameters<typeof MismatchNotice>[0]['failure'],
) {
  const pullRequest: PullRequestFiles = {
    ref: { owner: 'o', repo: 'r', number: 1 },
    files: [...found, ...(outcome.kind === 'match' ? [] : outcome.missing)],
  }

  const element = MismatchNotice({
    outcome,
    found,
    failure,
    onDismiss: () => {},
    onMarkFound: () => {},
  })

  return { element, pullRequest, graph }
}

/**
 * A one-item list takes a singular verb. These read on screen, and a notice that
 * says "1 file that are here" undermines the one thing this state exists for —
 * getting the user to trust what the tool is telling them.
 */
describe('mismatch notice copy', () => {
  it('never says "1 file that are"', () => {
    const { element } = render(
      { kind: 'partial', found: ['src/a.ts'], missing: ['src/gone.ts'] },
      ['src/a.ts'],
    )

    // Walk the rendered tree for text nodes, as a user would read them.
    const text = collectText(element).join(' ').replace(/\s+/g, ' ')
    expect(text).not.toMatch(/1 file that are/)
    expect(text).toMatch(/1 file that is here/)
  })

  it('says "2 files that are" when there are two', () => {
    const { element } = render(
      { kind: 'partial', found: ['src/a.ts', 'src/b.ts'], missing: ['src/gone.ts'] },
      ['src/a.ts', 'src/b.ts'],
    )

    const text = collectText(element).join(' ').replace(/\s+/g, ' ')
    expect(text).toMatch(/2 files that are here/)
  })

  it('agrees the verb in the partial summary sentence', () => {
    const one = render({ kind: 'partial', found: ['src/a.ts'], missing: ['src/gone.ts'] }, ['src/a.ts'])
    const two = render(
      { kind: 'partial', found: ['src/a.ts', 'src/b.ts'], missing: ['src/gone.ts'] },
      ['src/a.ts', 'src/b.ts'],
    )

    // Collapse whitespace: JSX inserts breaks between expressions, and a reader
    // does not see them.
    const oneText = collectText(one.element).join(' ').replace(/\s+/g, ' ')
    const twoText = collectText(two.element).join(' ').replace(/\s+/g, ' ')

    expect(oneText).toMatch(/\b1\b of the pull request's 2 changed files is here/)
    expect(twoText).toMatch(/\b2\b of the pull request's 3 changed files are here/)
  })
})

/** Flatten a React element tree into its text nodes. */
function collectText(node: unknown): string[] {
  if (node === null || node === undefined || node === false) return []
  if (typeof node === 'string' || typeof node === 'number') return [String(node)]
  if (Array.isArray(node)) return node.flatMap(collectText)

  if (typeof node === 'object' && 'props' in (node as Record<string, unknown>)) {
    const element = node as { props?: { children?: unknown } }
    return collectText(element.props?.children)
  }

  return []
}
