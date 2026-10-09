import { describe, expect, it } from 'vitest'

import { layoutGraph, LAYOUT_LABELS, LAYOUT_MODES, type LayoutMode } from '../src/lib/layout.ts'
import { layoutGraphLayered } from '../src/lib/layered.ts'
import { layoutGraphPhysics } from '../src/lib/physics.ts'

const nodes = (ids: string[]) => ids.map((id) => ({ id }))

const LINEAR: Array<{ from: string; to: string; isExternal: boolean }> = [
  { from: 'a.ts', to: 'b.ts', isExternal: false },
  { from: 'b.ts', to: 'c.ts', isExternal: false },
]

describe('layout dispatch', () => {
  it('offers both layouts, and labels each one', () => {
    expect(LAYOUT_MODES).toEqual(['layered', 'physics'])
    for (const mode of LAYOUT_MODES) {
      expect(LAYOUT_LABELS[mode]).toBeTruthy()
    }
  })

  it('routes each mode to the matching algorithm', async () => {
    const input = { nodes: nodes(['a.ts', 'b.ts', 'c.ts']), edges: LINEAR }

    expect(await layoutGraph('layered', input)).toEqual(
      layoutGraphLayered(input.nodes, input.edges),
    )
    expect(await layoutGraph('physics', input)).toEqual(
      layoutGraphPhysics(input.nodes, input.edges),
    )
  })

  it('places every node in both layouts', async () => {
    const input = { nodes: nodes(['a.ts', 'b.ts', 'c.ts']), edges: LINEAR }

    for (const mode of LAYOUT_MODES) {
      const laid = await layoutGraph(mode, input)
      expect(laid, `mode: ${mode}`).toHaveLength(3)
      expect(new Set(laid.map((n) => n.id)), `mode: ${mode}`).toEqual(
        new Set(['a.ts', 'b.ts', 'c.ts']),
      )
    }
  })

  it('returns nothing for an empty graph without throwing', async () => {
    for (const mode of LAYOUT_MODES) {
      expect(await layoutGraph(mode, { nodes: [], edges: [] })).toEqual([])
    }
  })
})

/**
 * `spec.md > Data Model`: the same repository must always produce the same graph.
 * `d3-force` seeds randomly by default, so this is the test that would catch a
 * regression in the deterministic seeding — it is load-bearing, not incidental.
 */
describe('determinism across runs', () => {
  const modes: LayoutMode[] = ['layered', 'physics']

  for (const mode of modes) {
    it(`${mode} layout gives identical positions on repeated runs`, async () => {
      const input = {
        nodes: nodes(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']),
        edges: [
          ...LINEAR,
          { from: 'c.ts', to: 'd.ts', isExternal: false },
          { from: 'a.ts', to: 'e.ts', isExternal: false },
        ],
      }

      const first = await layoutGraph(mode, input)
      const second = await layoutGraph(mode, input)
      expect(second).toEqual(first)
    })

    it(`${mode} layout ignores the order nodes are supplied in`, async () => {
      const edges = LINEAR
      const forwards = await layoutGraph(mode, { nodes: nodes(['a.ts', 'b.ts', 'c.ts']), edges })
      const backwards = await layoutGraph(mode, {
        nodes: nodes(['c.ts', 'b.ts', 'a.ts']),
        edges,
      })

      const asMap = (laid: Array<{ id: string; position: { x: number; y: number } }>) =>
        Object.fromEntries(laid.map((n) => [n.id, n.position]))

      expect(asMap(backwards)).toEqual(asMap(forwards))
    })
  }
})
