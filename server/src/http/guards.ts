import type { Role } from '@prisma/client'
import { requireSession, requirePasswordAlreadyChanged } from '../auth/require-session.js'
import { requireRole } from '../authorization/require-role.js'

/** Session, then forced-password-change, then role (BR-L3-08): the order every protected route needs. */
export function guardFor(...roles: Role[]) {
  return [requireSession, requirePasswordAlreadyChanged, requireRole(...roles)]
}

export const requireRequester = guardFor('REQUESTER')
export const requireStaff = guardFor('IT_STAFF', 'ADMINISTRATOR')
export const requireAnyRole = guardFor('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR')
