import type { NextFunction, Request, Response } from 'express'
import type { Role } from '@prisma/client'

/**
 * Restricts a route to the given roles. Must run after requireSession (it
 * reads response.locals.userRole, set there). Returns 403 FORBIDDEN for a
 * logged-in user of the wrong role -- AC-L3-05, never just a hidden button.
 */
export function requireRole(...roles: Role[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const userRole = response.locals.userRole as Role | undefined
    if (!userRole || !roles.includes(userRole)) {
      response.status(403).json({ error: 'FORBIDDEN' })
      return
    }
    next()
  }
}
