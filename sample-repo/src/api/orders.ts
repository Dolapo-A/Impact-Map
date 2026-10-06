import { totalsFor } from '../utils/totals'
import { formatPrice, describeItem } from '../utils/format'
import type { CartItem, CartTotals } from '../utils/cart'

/** An order as it exists after checkout. */
export interface Order {
  id: string
  items: CartItem[]
  totals: CartTotals
  placedAt: Date
}

export function placeOrder(items: CartItem[], now: Date = new Date()): Order {
  return {
    id: `ord_${now.getTime()}`,
    items: [...items],
    totals: totalsFor(items),
    placedAt: now,
  }
}

export function receiptFor(order: Order): string {
  const lines = order.items.map((item) => `  ${describeItem(item)}`)
  const money = [
    `  Subtotal: ${formatPrice(order.totals.subtotal)}`,
    `  Discount: -${formatPrice(order.totals.discount)}`,
    `  Tax: ${formatPrice(order.totals.tax)}`,
    `  Total: ${formatPrice(order.totals.total)}`,
  ]
  return [`Order ${order.id}`, ...lines, ...money].join('\n')
}