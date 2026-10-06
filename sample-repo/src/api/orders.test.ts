import { describe, expect, it } from 'vitest'

import { placeOrder, receiptFor } from './orders'
import type { CartItem } from '../utils/cart'

const items: CartItem[] = [
  { productId: 'p1', name: 'Mug', unitPrice: 30, quantity: 2 },
]

const fixedNow = new Date('2026-03-01T12:00:00Z')

describe('placeOrder', () => {
  it('freezes the totals at the moment of placing the order', () => {
    const order = placeOrder(items, fixedNow)
    expect(order.items).toEqual(items)
    expect(order.placedAt).toBe(fixedNow)
    expect(order.totals.subtotal).toBe(60)
  })

  it('copies the item list so later edits cannot change a placed order', () => {
    const order = placeOrder(items, fixedNow)
    items.push({ productId: 'p2', name: 'Kettle', unitPrice: 1, quantity: 1 })
    expect(order.items).toHaveLength(1)
  })
})

describe('receiptFor', () => {
  it('includes the order id and the total', () => {
    const receipt = receiptFor(placeOrder(items, fixedNow))
    expect(receipt).toContain('Order ord_')
    expect(receipt).toContain('Total: $60.00')
  })
})