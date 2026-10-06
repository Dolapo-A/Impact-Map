import type { CartItem } from './cart'

const formatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function formatPrice(amount: number): string {
  return formatter.format(amount)
}

/** Plain English summary of a cart line, for the receipt and the email. */
export function describeItem(item: CartItem): string {
  const plural = item.quantity === 1 ? '' : 's'
  return `${item.quantity} × ${item.name} (${formatPrice(item.unitPrice)} each, ${item.quantity} item${plural} total)`
}