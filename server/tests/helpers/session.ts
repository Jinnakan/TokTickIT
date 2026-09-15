import request from 'supertest'
import type { Role } from '@prisma/client'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'
import { SEED_PASSWORD } from '../../prisma/seed-data.js'

export type AuthenticatedAgent = ReturnType<typeof request.agent>

const ALLOWED_ORIGIN = process.env.APP_ORIGIN ?? 'http://localhost:5173'

/**
 * Every mutating request on a session-protected route now goes through the
 * Origin/Referer check (BR-L3-09, origin-check.ts) that requireSession
 * enforces. Real browser requests carry Origin automatically; supertest
 * requests don't unless told to -- so every agent this helper hands out is
 * patched once here to always send a matching Origin, instead of every
 * test call site having to remember `.set('Origin', ...)` individually.
 */
function withDefaultOrigin(agent: AuthenticatedAgent): AuthenticatedAgent {
  for (const method of ['post', 'put', 'patch', 'delete'] as const) {
    const original = agent[method].bind(agent)
    agent[method] = ((...args: Parameters<typeof original>) =>
      original(...args).set('Origin', ALLOWED_ORIGIN)) as typeof original
  }
  return agent
}

/**
 * Logs in as the `index`-th active seeded user of the given role (0 =
 * first) and returns an authenticated supertest agent (carries the
 * session cookie across requests) plus that user's id. Replaces Lab 2's
 * raw `X-Dev-Requester-Id` header now that the header is gone (Issue 16).
 */
export async function loginAsRole(role: Role, index = 0): Promise<{ agent: AuthenticatedAgent; userId: number }> {
  const user = await prisma.user.findFirstOrThrow({
    where: { role, isActive: true },
    orderBy: { id: 'asc' },
    skip: index,
  })

  const agent = withDefaultOrigin(request.agent(app))
  const response = await agent.post('/api/auth/login').send({ email: user.email, password: SEED_PASSWORD })
  if (response.status !== 200) {
    throw new Error(`Test login failed for ${user.email}: ${response.status} ${JSON.stringify(response.body)}`)
  }

  return { agent, userId: user.id }
}

export function loginAsRequester(index = 0) {
  return loginAsRole('REQUESTER', index)
}

export function loginAsItStaff(index = 0) {
  return loginAsRole('IT_STAFF', index)
}

export function loginAsAdministrator(index = 0) {
  return loginAsRole('ADMINISTRATOR', index)
}
