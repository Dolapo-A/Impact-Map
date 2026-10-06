import { useState } from 'react'
import { formatPrice } from '../utils/format'

type Props = {
  total: number
}

export function CartSummary({ total }: Props) {
  const [open, setOpen] = useState(false)
  return <div onClick={() => setOpen(!open)}>{formatPrice(total)}</div>
}