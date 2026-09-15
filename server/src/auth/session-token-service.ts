import { randomBytes } from 'node:crypto'

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

/**
 * Singleton: one shared instance holds the session token/TTL
 * configuration. Pure token/expiry logic only -- the Session row's
 * database lifecycle (create/find/delete) lives in AuthFacade, which
 * composes this service rather than duplicating its config.
 */
export class SessionTokenService {
  private static instance: SessionTokenService | undefined

  private constructor(private readonly ttlMs: number) {}

  static getInstance(): SessionTokenService {
    if (!SessionTokenService.instance) {
      SessionTokenService.instance = new SessionTokenService(SESSION_TTL_MS)
    }
    return SessionTokenService.instance
  }

  generateToken(): string {
    return randomBytes(32).toString('hex')
  }

  computeExpiresAt(from: Date = new Date()): Date {
    return new Date(from.getTime() + this.ttlMs)
  }

  isExpired(expiresAt: Date, now: Date = new Date()): boolean {
    return expiresAt.getTime() <= now.getTime()
  }
}
