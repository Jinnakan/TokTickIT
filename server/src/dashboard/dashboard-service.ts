import type { PrismaClient } from '@prisma/client'
import { WINDOW_DAYS, makeContext } from './metric.js'
import {
  RequesterCardsMetric,
  RequesterRecentlyResolvedMetric,
  RequesterRecentlyUpdatedMetric,
} from './metrics/requester-metrics.js'
import {
  ByItPriorityMetric,
  ByStatusMetric,
  MyActionsMetric,
  StaffCardsMetric,
  StaffRecentlyUpdatedMetric,
  UserCountsMetric,
} from './metrics/staff-metrics.js'

/** Assembles the dashboards from independent metric classes. Takes the client so tests can use a scratch schema. */
export function createDashboardService(db: PrismaClient) {
  return {
    async requester(userId: number, now: Date = new Date()) {
      const context = makeContext(db, userId, now)
      const [cards, recentlyUpdated, recentlyResolved] = await Promise.all([
        new RequesterCardsMetric().compute(context),
        new RequesterRecentlyUpdatedMetric().compute(context),
        new RequesterRecentlyResolvedMetric().compute(context),
      ])
      return { generatedAt: now.toISOString(), windowDays: WINDOW_DAYS, cards, recentlyUpdated, recentlyResolved }
    },

    async staff(userId: number, role: 'IT_STAFF' | 'ADMINISTRATOR', now: Date = new Date()) {
      const context = makeContext(db, userId, now)
      const [cards, byStatus, byItPriority, myActions, recentlyUpdated] = await Promise.all([
        new StaffCardsMetric().compute(context),
        new ByStatusMetric().compute(context),
        new ByItPriorityMetric().compute(context),
        new MyActionsMetric().compute(context),
        new StaffRecentlyUpdatedMetric().compute(context),
      ])
      const base = { generatedAt: now.toISOString(), windowDays: WINDOW_DAYS, cards, byStatus, byItPriority, myActions, recentlyUpdated }
      // `users` is omitted (not null) for IT Staff (api-spec §4).
      return role === 'ADMINISTRATOR' ? { ...base, users: await new UserCountsMetric().compute(context) } : base
    },
  }
}
