import { describe, expect, it } from 'vitest'

import { layoutGraphRadial } from '../src/lib/radial.ts'

const nodes = (ids: string[]) => ids.map((id) => ({ id }))

const LINEAR = [
  { from: 'a.ts', to: 'b.ts', isExternal: false },
  { from: 'b.ts', to: 'c.ts', isExternal: false },
  { from: 'c.ts', to: 'd.ts', isExternal: false },
]

function distanceMap(entries: Array<[string, number]>) {
  return new Map(entries)
}

function positionsOf(laid: Array<{ id: string; position: { x: number; y: number } }>) {
  return new Map(laid.map((n) => [n.id, n.position]))
}

describe('layoutGraphRadial — with a change marked', () => {
  it('puts the changed file at the centre of the shape', () => {
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts']),
      distanceByPath: distanceMap([
        ['a.ts', 0],
        ['b.ts', 1],
        ['c.ts', 2],
      ]),
    })

    const at = positionsOf(laid)
    // The centre file is the one every other node is measured against.
    const centre = at.get('a.ts')!
    const others = ['b.ts', 'c.ts'].map((id) => at.get(id)!)

    for (const other of others) {
      const gap = Math.hypot(other.x - centre.x, other.y - centre.y)
      expect(gap, `${id0(other, centre)} should sit outside the centre`).toBeGreaterThan(0)
    }
  })

  it('places each hop further from the centre than the last', () => {
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts', 'd.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts']),
      distanceByPath: distanceMap([
        ['a.ts', 0],
        ['b.ts', 1],
        ['c.ts', 2],
        ['d.ts', 3],
      ]),
    })

    const at = positionsOf(laid)
    const centre = at.get('a.ts')!
    const gapTo = (id: string) => {
      const p = at.get(id)!
      return Math.hypot(p.x - centre.x, p.y - centre.y)
    }

    expect(gapTo('b.ts')).toBeGreaterThan(gapTo('a.ts'))
    expect(gapTo('c.ts')).toBeGreaterThan(gapTo('b.ts'))
    expect(gapTo('d.ts')).toBeGreaterThan(gapTo('c.ts'))
  })

  it('gives every node in one ring the same distance from the centre', () => {
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts']),
      edges: [
        { from: 'a.ts', to: 'b.ts', isExternal: false },
        { from: 'a.ts', to: 'c.ts', isExternal: false },
        { from: 'a.ts', to: 'd.ts', isExternal: false },
        { from: 'a.ts', to: 'e.ts', isExternal: false },
      ],
      changedPaths: new Set(['a.ts']),
      distanceByPath: distanceMap([
        ['a.ts', 0],
        ['b.ts', 1],
        ['c.ts', 1],
        ['d.ts', 1],
        ['e.ts', 1],
      ]),
    })

    const at = positionsOf(laid)
    const centre = at.get('a.ts')!
    const ringGaps = ['b.ts', 'c.ts', 'd.ts', 'e.ts'].map((id) => {
      const p = at.get(id)!
      return Math.round(Math.hypot(p.x - centre.x, p.y - centre.y))
    })

    expect(new Set(ringGaps).size).toBe(1)
  })

  it('keeps several changed files apart enough to click each one', () => {
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts', 'b.ts']),
      distanceByPath: distanceMap([
        ['a.ts', 0],
        ['b.ts', 0],
        ['c.ts', 1],
      ]),
    })

    const at = positionsOf(laid)
    const gap = Math.hypot(at.get('a.ts')!.x - at.get('b.ts')!.x, at.get('a.ts')!.y - at.get('b.ts')!.y)
    // Marking two files must not stack them on the same spot.
    expect(gap).toBeGreaterThan(30)
  })

  it('is deterministic — same input, same positions', () => {
    const input = {
      nodes: nodes(['a.ts', 'b.ts', 'c.ts', 'd.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts']),
      distanceByPath: distanceMap([
        ['a.ts', 0],
        ['b.ts', 1],
        ['c.ts', 2],
        ['d.ts', 3],
      ]),
    }

    expect(layoutGraphRadial(input)).toEqual(layoutGraphRadial(input))
  })

  it('ignores the order nodes are supplied in', () => {
    const edges = LINEAR
    const distances = distanceMap([
      ['a.ts', 0],
      ['b.ts', 1],
      ['c.ts', 2],
    ])

    const forwards = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts']),
      edges,
      changedPaths: new Set(['a.ts']),
      distanceByPath: distances,
    })
    const backwards = layoutGraphRadial({
      nodes: nodes(['c.ts', 'b.ts', 'a.ts']),
      edges,
      changedPaths: new Set(['a.ts']),
      distanceByPath: distances,
    })

    expect([...positionsOf(backwards)]).toEqual([...positionsOf(forwards)])
  })

  it('omits files the tracer never reached, so they do not join the bloom', () => {
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'orphan.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts']),
      distanceByPath: distanceMap([
        ['a.ts', 0],
        ['b.ts', 1],
        // orphan.ts deliberately absent — nothing reaches it from a.ts, so it is
        // not part of this blast radius and must not be drawn in the bloom.
      ]),
    })

    expect(laid.map((n) => n.id).sort()).toEqual(['a.ts', 'b.ts'])
  })

  it('emits positive coordinates so the canvas can pan freely', () => {
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts']),
      distanceByPath: distanceMap([
        ['a.ts', 0],
        ['b.ts', 1],
        ['c.ts', 2],
      ]),
    })

    for (const node of laid) {
      expect(node.position.x).toBeGreaterThanOrEqual(0)
      expect(node.position.y).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('layoutGraphRadial — before a change is marked', () => {
  it('still places every file rather than collapsing them onto the centre', () => {
    // There is no blast radius to show yet, so the shape falls back to dependency
    // depth. Stacking everything in the middle would be unreadable and unclickable.
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts', 'd.ts']),
      edges: LINEAR,
      changedPaths: new Set<string>(),
      distanceByPath: new Map<string, number>(),
    })

    expect(laid).toHaveLength(4)

    const distinct = new Set(laid.map((n) => `${n.position.x},${n.position.y}`))
    expect(distinct.size).toBe(4)
  })

  it('is deterministic in the fallback too', () => {
    const input = {
      nodes: nodes(['a.ts', 'b.ts', 'c.ts']),
      edges: LINEAR,
      changedPaths: new Set<string>(),
      distanceByPath: new Map<string, number>(),
    }

    expect(layoutGraphRadial(input)).toEqual(layoutGraphRadial(input))
  })
})

describe('layoutGraphRadial — edge cases', () => {
  it('returns nothing for an empty graph without throwing', () => {
    expect(
      layoutGraphRadial({
        nodes: [],
        edges: [],
        changedPaths: new Set(['a.ts']),
        distanceByPath: distanceMap([['a.ts', 0]]),
      }),
    ).toEqual([])
  })

  it('handles a lone node', () => {
    const laid = layoutGraphRadial({
      nodes: nodes(['only.ts']),
      edges: [],
      changedPaths: new Set(['only.ts']),
      distanceByPath: distanceMap([['only.ts', 0]]),
    })

    expect(laid).toHaveLength(1)
  })

  it('terminates on a circular import instead of looping', () => {
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts']),
      edges: [
        { from: 'a.ts', to: 'b.ts', isExternal: false },
        { from: 'b.ts', to: 'c.ts', isExternal: false },
        { from: 'c.ts', to: 'a.ts', isExternal: false },
      ],
      changedPaths: new Set(['a.ts']),
      distanceByPath: distanceMap([
        ['a.ts', 0],
        ['b.ts', 1],
        ['c.ts', 2],
      ]),
    })

    expect(laid).toHaveLength(3)
  })

  it('keeps every file visible when a change is marked but not yet traced', () => {
    // Selecting files and pressing Trace are separate steps. If radial hid
    // everything the tracer had not reached, switching to it before tracing would
    // make the whole graph vanish except the one file just clicked.
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts']),
      distanceByPath: new Map<string, number>(),
    })

    expect(laid.map((n) => n.id).sort()).toEqual(['a.ts', 'b.ts', 'c.ts'])
  })

  it('centres the marked files even before the trace has run', () => {
    const laid = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts']),
      distanceByPath: new Map<string, number>(),
    })

    const at = positionsOf(laid)
    const centre = at.get('a.ts')!
    for (const id of ['b.ts', 'c.ts']) {
      const p = at.get(id)!
      expect(Math.hypot(p.x - centre.x, p.y - centre.y)).toBeGreaterThan(0)
    }
  })

  it('returns nodes in a stable order regardless of input order', () => {
    const distances = distanceMap([
      ['a.ts', 0],
      ['b.ts', 1],
      ['c.ts', 2],
    ])

    const forwards = layoutGraphRadial({
      nodes: nodes(['a.ts', 'b.ts', 'c.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts']),
      distanceByPath: distances,
    })
    const backwards = layoutGraphRadial({
      nodes: nodes(['c.ts', 'b.ts', 'a.ts']),
      edges: LINEAR,
      changedPaths: new Set(['a.ts']),
      distanceByPath: distances,
    })

    expect(forwards.map((n) => n.id)).toEqual(backwards.map((n) => n.id))
  })
})

/** Tiny helper so a failed assertion names the node that broke. */
function id0(point: { x: number; y: number }, centre: { x: number; y: number }) {
  return `point(${point.x},${point.y}) vs centre(${centre.x},${centre.y})`
}
