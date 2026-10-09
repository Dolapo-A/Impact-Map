import { addDays } from '../utils/cart'

export interface Reservation {
  id: string
  guestName: string
  roomCode: string
  checkIn: Date
  nights: number
  breakfast: boolean
}

export function reservationCheckOut(reservation: Reservation): Date {
  return addDays(reservation.nights, reservation.checkIn)
}

export function isWithinFreeCancellation(reservation: Reservation, today: Date): boolean {
  const cutoff = addDays(1, today)
  return reservationCheckOut(reservation) <= cutoff
}

export function reservationSummary(reservation: Reservation): string {
  const nights = reservation.nights === 1 ? '1 night' : `${reservation.nights} nights`
  const breakfast = reservation.breakfast ? ', breakfast included' : ''
  return `${reservation.guestName} · room ${reservation.roomCode} · ${nights}${breakfast}`
}