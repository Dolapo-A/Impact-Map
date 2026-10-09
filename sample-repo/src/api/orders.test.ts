import { describe, expect, it } from 'vitest'

import { placeOrder, receiptFor } from './orders'
import type { CartItem } from '../utils/cart'

/** A fresh cart per test — sharing one let a test's mutation leak into the next. */
const sampleItems = (): CartItem[] => [
  { productId: 'p1', name: 'Mug', unitPrice: 30.5, quantity: 2 },
]

const fixedNow = new Date('2026-03-01T12:00:00Z')

describe('placeOrder', () => {
  it('freezes the totals at the moment of placing the order', () => {
    const items = sampleItems()
    const order = placeOrder(items, fixedNow)
    expect(order.items).toEqual(items)
    expect(order.placedAt).toBe(fixedNow)
    // Two mugs at $30.50. Below the $100 threshold, so no discount.
    expect(order.totals.subtotal).toBe(61)
  })

  it('copies the item list so later edits cannot change a placed order', () => {
    const items = sampleItems()
    const order = placeOrder(items, fixedNow)
    items.push({ productId: 'p2', name: 'Kettle', unitPrice: 1, quantity: 1 })
    expect(order.items).toHaveLength(1)
  })
})

describe('receiptFor', () => {
  it('includes the order id and the total', () => {
    const receipt = receiptFor(placeOrder(sampleItems(), fixedNow))
    expect(receipt).toContain('Order ord_')
    // $61.00 plus 20% tax, with no discount below the threshold.
    expect(receipt).toContain('Total: $73.20')
  })
})