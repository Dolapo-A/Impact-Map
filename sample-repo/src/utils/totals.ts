import {
  DISCOUNT_RATE,
  DISCOUNT_THRESHOLD,
  TAX_RATE,
  lineTotal,
  type CartItem,
  type CartTotals,
} from './cart'

export function subtotalOf(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + lineTotal(item), 0)
}

/**
 * The discount is deliberately simple: one threshold, one rate.
 * Returns the discount amount, not the discounted total.
 */
export function discountFor(items: CartItem[]): number {
  const subtotal = subtotalOf(items)
  return subtotal >= DISCOUNT_THRESHOLD ? subtotal * DISCOUNT_RATE : 0
}

export function totalsFor(items: CartItem[]): CartTotals {
  const subtotal = subtotalOf(items)
  const discount = discountFor(items)
  // Tax applies to what you actually pay, after the discount.
  const taxable = subtotal - discount
  const tax = taxable * TAX_RATE

  return { subtotal, discount, tax, total: taxable + tax }
}