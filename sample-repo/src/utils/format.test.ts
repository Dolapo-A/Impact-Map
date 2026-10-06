import { describe, expect, it } from 'vitest'

import { formatPrice } from './format'

describe('formatPrice', () => {
  it('renders whole dollars with two decimal places', () => {
    expect(formatPrice(12)).toBe('$12.00')
  })

  it('groups thousands', () => {
    expect(formatPrice(1234.5)).toBe('$1,234.50')
  })
})