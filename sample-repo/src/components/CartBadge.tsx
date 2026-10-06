import { cartHeadline, checkoutEnabled, recentActivity } from '../state/selectors'
import type { StorefrontState } from '../state/selectors'

export interface CartBadgeProps {
  state: StorefrontState
}

export function CartBadge({ state }: CartBadgeProps) {
  const enabled = checkoutEnabled(state.items)
  return (
    <div className="cart-badge">
      <span>{cartHeadline(state.items)}</span>
      <button disabled={!enabled}>Checkout</button>
    </div>
  )
}

export interface ActivityFeedProps {
  state: StorefrontState
}

export function ActivityFeed({ state }: ActivityFeedProps) {
  const entries = recentActivity(state)
  if (entries.length === 0) return <p>Nothing yet.</p>

  return (
    <ul className="activity-feed">
      {entries.map((entry) => (
        <li key={entry}>{entry}</li>
      ))}
    </ul>
  )
}