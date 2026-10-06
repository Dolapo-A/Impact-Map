import { totalsFor } from './totals'

/** A line item in the cart. */
export interface CartItem {
  productId: string
  name: string
  unitPrice: number
  quantity: number
}

export interface CartTotals {
  subtotal: number
  discount: number
  tax: number
  total: number
}

export const DISCOUNT_THRESHOLD = 100
export const DISCOUNT_RATE = 0.1
export const TAX_RATE = 0.2

export function lineTotal(item: CartItem): number {
  return item.unitPrice * item.quantity
}

export function addDays(days: number, from: Date = new Date()): Date {
  const result = new Date(from)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * What the customer actually pays for this cart.
 *
 * NOTE: this calls `totalsFor` in `./totals`, and that module imports the
 * constants above from this one. That is a deliberate circular import — a real
 * code smell, kept here so the graph has a cycle to render and the tracer has
 * something to prove it terminates on.
 */
export function checkoutTotal(items: CartItem[]): number {
  return totalsFor(items).total
}