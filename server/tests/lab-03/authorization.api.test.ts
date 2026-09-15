import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import type { Response } from 'express'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'
import { requireSession, requirePasswordAlreadyChanged } from '../../src/auth/require-session.js'
import { requireRole } from '../../src/authorization/require-role.js'
import { respondOwnershipFailure, type OwnershipResult } from '../../src/authorization/ownership.js'
import { loginAsAdministrator, loginAsItStaff, loginAsRequester } from '../helpers/session.js'

// AUTHZ-01/02 (AC-L3-05): requireRole has no real IT-Staff-only or
// Administrator-only endpoint to exercise against yet in Issue 16 (those
// land in Issues 18-20) -- a minimal test-only app exercises the guard
// itself, the same pattern Issue 15's password-change-gate test used.
const roleGateApp = express()
roleGateApp.use(cookieParser())
roleGateApp.get(
  '/it-staff-only',
  requireSession,
  requirePasswordAlreadyChanged,
  requireRole('IT_STAFF'),
  (_request, response) => response.status(200).json({ ok: true }),
)
roleGateApp.get(
  '/admin-only',
  requireSession,
  requirePasswordAlreadyChanged,
  requireRole('ADMINISTRATOR'),
  (_request, response) => response.status(200).json({ ok: true }),
)

async function loginCookie(email: string): Promise<string> {
  const { SEED_PASSWORD } = await import('../../prisma/seed-data.js')
  const response = await request(app).post('/api/auth/login').send({ email, password: SEED_PASSWORD })
  const cookie = response.headers['set-cookie']?.[0]
  if (!cookie) throw new Error(`login failed for ${email}`)
  return cookie
}

describe('requireRole (AUTHZ-01, AUTHZ-02)', () => {
  it('blocks a Requester from an IT-Staff-only route with 403 FORBIDDEN', async () => {
    const { userId } = await loginAsRequester()
    const requester = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const cookie = await loginCookie(requester.email)

    const response = await request(roleGateApp).get('/it-staff-only').set('Cookie', cookie)

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('FORBIDDEN')
  })

  it('blocks IT Staff from an Administrator-only route with 403 FORBIDDEN', async () => {
    const { userId } = await loginAsItStaff()
    const staff = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const cookie = await loginCookie(staff.email)

    const response = await request(roleGateApp).get('/admin-only').set('Cookie', cookie)

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('FORBIDDEN')
  })

  it('allows the matching role through', async () => {
    const { userId } = await loginAsAdministrator()
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    const cookie = await loginCookie(admin.email)

    const response = await request(roleGateApp).get('/admin-only').set('Cookie', cookie)

    expect(response.status).toBe(200)
  })
})

describe('Ticket ownership under session auth (AUTHZ-03, AC-L3-07)', () => {
  it('returns 403 TICKET_FORBIDDEN when a Requester requests a ticket they do not own', async () => {
    // Indices 2/3 (not 0/1) so this doesn't add tickets to the same
    // Requester identity the Lab 2 my-tickets/attachments/ticket-detail
    // suites use as "agentA"/"agentB" and assert exact result sets against.
    const owner = await loginAsRequester(2)
    const otherRequester = await loginAsRequester(3)

    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } })
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })

    const created = await owner.agent.post('/api/tickets').send({
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      requestedPriority: 'MEDIUM',
      summary: 'Cross-requester ticket access check',
      description: 'Verifies cross-Requester access is forbidden under session auth.',
    })

    const response = await otherRequester.agent.get(`/api/tickets/${created.body.id}`)

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('TICKET_FORBIDDEN')
  })
})

// AUTHZ-04 (BR-L3-10): the OwnershipResult<T> type/respondOwnershipFailure
// helper was generalized out of ticket-ownership.ts in this issue
// specifically so every future resource type (Comment/Note in Issue 17/19,
// User in Issue 20) reuses this one module instead of re-deriving the
// 404-vs-403 decision. No User/Session-specific resolver exists yet since
// nothing calls one yet -- this proves the shared primitive itself is
// resource-agnostic, which is what "extended to" means until those issues
// give it a concrete second resource to resolve.
describe('Generalized OwnershipResult<T> primitive (AUTHZ-04, BR-L3-10)', () => {
  function mockResponse(): { response: Response; statusCalls: number[]; jsonCalls: unknown[] } {
    const statusCalls: number[] = []
    const jsonCalls: unknown[] = []
    const response = {
      status(code: number) {
        statusCalls.push(code)
        return this
      },
      json(body: unknown) {
        jsonCalls.push(body)
        return this
      },
    } as unknown as Response
    return { response, statusCalls, jsonCalls }
  }

  it('writes 404 for a not_found result, generic to any resource type', () => {
    const { response, statusCalls, jsonCalls } = mockResponse()
    const result: OwnershipResult<never> = { status: 'not_found' }

    respondOwnershipFailure(response, result, { notFound: 'THING_NOT_FOUND', forbidden: 'THING_FORBIDDEN' })

    expect(statusCalls).toEqual([404])
    expect(jsonCalls).toEqual([{ error: 'THING_NOT_FOUND' }])
  })

  it('writes 403 for a forbidden result, generic to any resource type', () => {
    const { response, statusCalls, jsonCalls } = mockResponse()
    const result: OwnershipResult<never> = { status: 'forbidden' }

    respondOwnershipFailure(response, result, { notFound: 'THING_NOT_FOUND', forbidden: 'THING_FORBIDDEN' })

    expect(statusCalls).toEqual([403])
    expect(jsonCalls).toEqual([{ error: 'THING_FORBIDDEN' }])
  })
})

describe('Requester-only ticket creation blocked for other roles (AUTHZ-05)', () => {
  it('rejects IT Staff creating a ticket as if they were a Requester', async () => {
    const { agent } = await loginAsItStaff()

    const response = await agent.post('/api/tickets').send({})

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('FORBIDDEN')
  })

  it('rejects an Administrator creating a ticket as if they were a Requester', async () => {
    const { agent } = await loginAsAdministrator()

    const response = await agent.post('/api/tickets').send({})

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('FORBIDDEN')
  })
})
