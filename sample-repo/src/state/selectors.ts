import { checkoutTotal, type CartItem } from '../utils/cart'
import { describeItem } from '../utils/format'
import { receiptFor, type Order } from '../api/orders'
import { reservationSummary, isWithinFreeCancellation, type Reservation } from '../domain/reservations'

export interface StorefrontState {
  items: CartItem[]
  lastOrder: Order | null
  reservation: Reservation | null
}

/**
 * The single read model the components render from.
 *
 * Note the fan-out: this one file pulls in cart maths, formatting, orders, and
 * reservations. Changing anything it uses lights up a wide slice of the graph —
 * which is exactly the situation the tool exists to show.
 */
export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
}

export function cartHeadline(items: CartItem[]): string {
  if (items.length === 0) return 'Your cart is empty'
  const count = items.reduce((sum, item) => sum + item.quantity, 0)
  return `${count} item${count === 1 ? '' : 's'} · ${cartSubtotal(items).toFixed(2)}`
}

export function checkoutEnabled(items: CartItem[]): boolean {
  return items.length > 0 && checkoutTotal(items) > 0
}

export function recentActivity(state: StorefrontState): string[] {
  const entries: string[] = []
  if (state.lastOrder) entries.push(receiptFor(state.lastOrder))
  if (state.reservation) {
    entries.push(reservationSummary(state.reservation))
    if (isWithinFreeCancellation(state.reservation, new Date())) {
      entries.push('Free cancellation still applies.')
    }
  }
  return entries
}