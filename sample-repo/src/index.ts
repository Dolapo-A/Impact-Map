export { checkoutTotal, DISCOUNT_THRESHOLD, TAX_RATE } from './utils/cart'
export { totalsFor, subtotalOf } from './utils/totals'
export { formatPrice, describeItem } from './utils/format'
export { placeOrder, receiptFor } from './api/orders'
export type { CartItem, CartTotals } from './utils/cart'
export type { Order } from './api/orders'
export {
  reservationSummary,
  isWithinFreeCancellation,
  type Reservation,
} from './domain/reservations'
export {
  cartHeadline,
  checkoutEnabled,
  recentActivity,
  type StorefrontState,
} from './state/selectors'
export { CartBadge, ActivityFeed } from './components/CartBadge'