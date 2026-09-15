import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../prisma.js'
import { AuthFacade } from './auth-facade.js'
import { SESSION_COOKIE_NAME } from './session-cookie.js'
import { originMatches } from './origin-check.js'

const authFacade = new AuthFacade(prisma)

declare module 'express-serve-static-core' {
  interface Locals {
    userId?: number
    userRole?: 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'
    mustChangePassword?: boolean
    sessionId?: string
  }
}

/**
 * Requires a valid session cookie (AC-L3-04). Also enforces the CSRF
 * Origin/Referer check (BR-L3-09) on mutating requests -- scoped to
 * session-authenticated routes only, since an unauthenticated request has
 * no session-backed state for a forged request to abuse.
 */
export async function requireSession(request: Request, response: Response, next: NextFunction) {
  const sessionId = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined

  if (!sessionId) {
    response.status(401).json({ error: 'UNAUTHENTICATED' })
    return
  }

  const context = await authFacade.getCurrentUser(sessionId)
  if (!context) {
    response.status(401).json({ error: 'UNAUTHENTICATED' })
    return
  }

  if (!originMatches(request)) {
    response.status(403).json({ error: 'ORIGIN_MISMATCH' })
    return
  }

  response.locals.userId = context.user.id
  response.locals.userRole = context.user.role
  response.locals.mustChangePassword = context.user.mustChangePassword
  response.locals.sessionId = context.sessionId
  next()
}

/**
 * Blocks every route it's applied to until the logged-in user has changed
 * their password (AC-L3-03, BR-L3-07). Must run after requireSession.
 * Never applied to /api/auth/change-password, /api/auth/logout, or
 * /api/auth/me -- those three stay reachable specifically so a user stuck
 * behind this gate can act on it (and the client can discover the gate
 * exists after a page refresh via /me).
 */
export function requirePasswordAlreadyChanged(request: Request, response: Response, next: NextFunction) {
  if (response.locals.mustChangePassword) {
    response.status(403).json({ error: 'PASSWORD_CHANGE_REQUIRED' })
    return
  }
  next()
}
