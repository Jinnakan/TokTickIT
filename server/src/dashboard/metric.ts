import type { PrismaClient } from '@prisma/client'

export const WINDOW_DAYS = 7
export const LIST_SIZE = 5
const DAY_MS = 86_400_000

export type DashboardContext = {
  db: PrismaClient
  userId: number
  now: Date
  /** Start of the rolling window, UTC (BR-L4-19). */
  windowStart: Date
}

export function makeContext(db: PrismaClient, userId: number, now: Date = new Date()): DashboardContext {
  return { db, userId, now, windowStart: new Date(now.getTime() - WINDOW_DAYS * DAY_MS) }
}

/** Strategy: every number or list on a dashboard is one class with this shape. */
export interface Metric<T> {
  readonly key: string
  compute(context: DashboardContext): Promise<T>
}

export type DrillDown = { view: 'my-tickets' | 'ticket-queue'; query: Record<string, string> } | null
export type Card = { key: string; label: string; count: number; drillDown: DrillDown }
