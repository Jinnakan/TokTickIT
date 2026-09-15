import type { Request } from 'express'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function allowedOrigins(): string[] {
  const configured = process.env.APP_ORIGIN ?? 'http://localhost:5173'
  return configured.split(',').map((origin) => origin.trim())
}

/**
 * CSRF defense-in-depth (BR-L3-09), paired with the SameSite=Lax session
 * cookie. Only relevant to session-authenticated mutating requests -- an
 * unauthenticated request (e.g. login) has no session to protect yet.
 */
export function originMatches(request: Request): boolean {
  if (!MUTATING_METHODS.has(request.method)) return true

  const source = request.header('origin') ?? request.header('referer')
  if (!source) return false

  return allowedOrigins().some((allowed) => source === allowed || source.startsWith(`${allowed}/`))
}
