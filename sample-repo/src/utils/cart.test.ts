import { describe, expect, it } from 'vitest'

import { lineTotal } from './cart'

describe('lineTotal', () => {
  it('multiplies price by quantity', () => {
    expect(lineTotal({ productId: 'p1', name: 'Mug', unitPrice: 12, quantity: 3 })).toBe(36)
  })

  it('is zero for a zero quantity', () => {
    expect(lineTotal({ productId: 'p1', name: 'Mug', unitPrice: 12, quantity: 0 })).toBe(0)
  })
})