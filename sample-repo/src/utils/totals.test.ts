import { describe, expect, it } from 'vitest'

import { DISCOUNT_THRESHOLD } from './cart'
import { discountFor, subtotalOf, totalsFor } from './totals'
import type { CartItem } from './cart'

const items: CartItem[] = [
  { productId: 'p1', name: 'Mug', unitPrice: 30, quantity: 2 },
  { productId: 'p2', name: 'Kettle', unitPrice: 40, quantity: 1 },
]

describe('subtotalOf', () => {
  it('sums every line total', () => {
    expect(subtotalOf(items)).toBe(100)
  })

  it('is zero for an empty cart', () => {
    expect(subtotalOf([])).toBe(0)
  })
})

describe('discountFor', () => {
  it('gives no discount below the threshold', () => {
    expect(discountFor([{ productId: 'p1', name: 'Mug', unitPrice: 10, quantity: 1 }])).toBe(0)
  })

  it('discounts once the threshold is reached', () => {
    expect(DISCOUNT_THRESHOLD).toBe(100)
    expect(discountFor(items)).toBe(10)
  })
})

describe('totalsFor', () => {
  it('applies tax after the discount', () => {
    const totals = totalsFor(items)
    expect(totals).toEqual({ subtotal: 100, discount: 10, tax: 18, total: 108 })
  })
})