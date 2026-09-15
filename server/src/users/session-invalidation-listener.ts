import type { PrismaClient } from '@prisma/client'
import { userEvents, USER_DEACTIVATED } from './user-events.js'

/**
 * Reacts to `userDeactivated` by deleting every Session row for that user
 * (BR-L3-18, FR-L3-17). Registered once at startup; UserService never
 * calls this directly.
 */
export function registerSessionInvalidationListener(prisma: PrismaClient): void {
  userEvents.on(USER_DEACTIVATED, async (userId: number) => {
    await prisma.session.deleteMany({ where: { userId } })
  })
}
