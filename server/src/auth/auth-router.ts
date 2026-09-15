import { Router } from 'express'
import type { User } from '@prisma/client'
import { prisma } from '../prisma.js'
import { AuthFacade } from './auth-facade.js'
import { requireSession } from './require-session.js'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from './session-cookie.js'
import { isLockedOut, lockoutKey, recordFailedAttempt, clearAttempts } from './login-rate-limiter.js'

export const authRouter = Router()

const authFacade = new AuthFacade(prisma)

function toUserResponse(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  }
}

authRouter.post('/login', async (request, response, next) => {
  try {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim() : ''
    const password = typeof request.body?.password === 'string' ? request.body.password : ''

    const fields: Record<string, string> = {}
    if (!email) fields.email = 'Email is required.'
    if (!password) fields.password = 'Password is required.'
    if (Object.keys(fields).length > 0) {
      response.status(400).json({ error: 'VALIDATION_FAILED', fields })
      return
    }

    const key = lockoutKey(email, request.ip ?? 'unknown')
    if (isLockedOut(key)) {
      response.status(429).json({
        error: 'TOO_MANY_ATTEMPTS',
        message: 'Too many failed attempts. Try again later.',
      })
      return
    }

    const result = await authFacade.login(email, password)
    if (result.status !== 'ok') {
      recordFailedAttempt(key)
      response.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' })
      return
    }

    clearAttempts(key)
    response.cookie(SESSION_COOKIE_NAME, result.session.id, sessionCookieOptions(result.session.expiresAt))
    response.status(200).json(toUserResponse(result.user))
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', requireSession, async (request, response, next) => {
  try {
    await authFacade.logout(response.locals.sessionId as string)
    response.clearCookie(SESSION_COOKIE_NAME)
    response.status(200).json({ success: true })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/me', requireSession, async (request, response, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: response.locals.userId as number } })
    response.status(200).json(toUserResponse(user))
  } catch (error) {
    next(error)
  }
})

authRouter.post('/change-password', requireSession, async (request, response, next) => {
  try {
    const currentPassword = typeof request.body?.currentPassword === 'string' ? request.body.currentPassword : ''
    const newPassword = typeof request.body?.newPassword === 'string' ? request.body.newPassword : ''

    const result = await authFacade.changePassword(response.locals.userId as number, currentPassword, newPassword)

    if (result.status === 'invalid-current-password') {
      response.status(400).json({ error: 'CURRENT_PASSWORD_INVALID' })
      return
    }
    if (result.status === 'validation-failed') {
      response.status(400).json({ error: 'VALIDATION_FAILED', fields: { newPassword: result.message } })
      return
    }

    response.status(200).json({ success: true })
  } catch (error) {
    next(error)
  }
})
