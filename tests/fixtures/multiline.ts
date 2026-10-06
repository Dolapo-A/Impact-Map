import {
  addDays,
  taxRate,
} from './utils/cart'
import React from 'react'

export { addDays } from './utils/cart'
export const fine = addDays(1, taxRate)