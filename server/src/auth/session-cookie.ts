import type { CookieOptions } from 'express'

export const SESSION_COOKIE_NAME = 'toktickit_session'

export function sessionCookieOptions(expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    path: '/',
  }
}
