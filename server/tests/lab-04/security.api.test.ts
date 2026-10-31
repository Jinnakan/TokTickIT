import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app } from '../helpers/app.js'
import { prisma } from '../../src/prisma.js'
import { loginWithoutOrigin } from '../helpers/session.js'
import { createUser, loginAsNewUser } from '../helpers/users.js'
import { addActionRow, createTicketRow, createTicketVia } from '../helpers/tickets.js'

type Actor = Awaited<ReturnType<typeof loginAsNewUser>>
let owner: Actor
let intruder: Actor
let staff: Actor
let admin: Actor
let ticketId: number
let actionId: number

beforeAll(async () => {
  ;[owner, intruder, staff, admin] = await Promise.all([
    loginAsNewUser('REQUESTER'),
    loginAsNewUser('REQUESTER'),
    loginAsNewUser('IT_STAFF'),
    loginAsNewUser('ADMINISTRATOR'),
  ])
  ticketId = (await createTicketVia(owner.agent)).id
  actionId = (await addActionRow(ticketId, staff.userId, 'PLANNED')).id
}, 90_000)

describe('IDOR sweep (SEC4-01, BR-L4-22)', () => {
  it('lets only the owner or staff read Actions, history and Ticket detail', async () => {
    for (const path of [`/api/tickets/${ticketId}`, `/api/tickets/${ticketId}/actions`, `/api/tickets/${ticketId}/history`]) {
      expect((await owner.agent.get(path)).status, `owner ${path}`).toBe(200)
      expect((await staff.agent.get(path)).status, `staff ${path}`).toBe(200)
      expect((await admin.agent.get(path)).status, `admin ${path}`).toBe(200)
      const foreign = await intruder.agent.get(path)
      expect(foreign.status, `intruder ${path}`).toBe(403)
      expect(foreign.body.error).toBe('TICKET_FORBIDDEN')
      expect((await request(app).get(path)).status, `anonymous ${path}`).toBe(401)
    }
  })

  it('refuses a Requester every write on Actions and workflow, even on their own Ticket', async () => {
    const writes: Array<[string, string, object]> = [
      ['post', `/api/tickets/${ticketId}/actions`, { description: 'x' }],
      ['patch', `/api/tickets/${ticketId}/actions/${actionId}`, { version: 1, description: 'x' }],
      ['patch', `/api/tickets/${ticketId}/status`, { status: 'OPEN', expectedVersion: 1 }],
      ['patch', `/api/tickets/${ticketId}/priority`, { itPriority: 'HIGH', expectedVersion: 1 }],
      ['post', `/api/tickets/${ticketId}/reassign`, { ticketOwnerId: staff.userId, expectedVersion: 1 }],
      ['post', `/api/tickets/${ticketId}/claim`, {}],
    ]
    for (const [method, path, body] of writes) {
      const response = await (owner.agent as unknown as Record<string, (p: string) => request.Test>)[method](path).send(body)
      expect(response.status, `${method} ${path}`).toBe(403)
    }
  })

  it('refuses another Requester the indication on a Ticket they do not own', async () => {
    const response = await intruder.agent.post(`/api/tickets/${ticketId}/appears-resolved`)
    expect(response.status).toBe(403)
    expect(response.body.error).toBe('TICKET_FORBIDDEN')
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).requesterResolvedAt).toBeNull()
  })

  it('refuses staff the Requester-only indication, and scopes the Requester dashboard to the session user', async () => {
    expect((await staff.agent.post(`/api/tickets/${ticketId}/appears-resolved`)).status).toBe(403)
    expect((await staff.agent.get('/api/dashboard/requester')).status).toBe(403)
    expect((await owner.agent.get('/api/dashboard/staff')).status).toBe(403)
    // The Requester dashboard takes no id: another user's numbers cannot be asked for.
    const other = await intruder.agent.get('/api/dashboard/requester?requesterId=' + owner.userId)
    expect(other.body.cards.find((card: { key: string }) => card.key === 'open').count).toBe(0)
  })

  it('answers an Action addressed through another Ticket with 404, not 403', async () => {
    const otherTicket = (await createTicketVia(intruder.agent)).id
    const response = await staff.agent.patch(`/api/tickets/${otherTicket}/actions/${actionId}`).send({ version: 1, description: 'x' })
    expect(response.status).toBe(404)
    expect(response.body.error).toBe('ACTION_NOT_FOUND')
  })
})

describe('Mass assignment (SEC4-02, §10)', () => {
  it('ignores protected and unknown fields on Action create and edit', async () => {
    const created = await staff.agent.post(`/api/tickets/${ticketId}/actions`).send({
      description: 'Mass assignment probe', createdById: admin.userId, ticketId: 999999999, version: 50, id: 123456789, isAdmin: true,
    })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ createdById: staff.userId, ticketId, version: 1 })
    expect(created.body.id).not.toBe(123456789)
    expect(created.body.isAdmin).toBeUndefined()

    const edited = await staff.agent.patch(`/api/tickets/${ticketId}/actions/${created.body.id}`).send({
      version: 1, description: 'Edited', createdById: admin.userId, ticketId: 999999999, createdAt: '2000-01-01T00:00:00.000Z',
    })
    expect(edited.status).toBe(200)
    expect(edited.body).toMatchObject({ createdById: staff.userId, ticketId, version: 2 })
    expect(new Date(edited.body.createdAt).getFullYear()).toBeGreaterThan(2000)
  })

  it('ignores protected fields on Ticket mutations', async () => {
    const ticket = await createTicketRow({ requesterId: owner.userId, status: 'OPEN' })
    const response = await staff.agent.patch(`/api/tickets/${ticket.id}/priority`).send({
      itPriority: 'HIGH', expectedVersion: ticket.version, requesterId: intruder.userId, ticketNumber: 'HACKED', currentStatus: 'CLOSED', version: 99,
    })
    expect(response.status).toBe(200)
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })
    expect(stored).toMatchObject({ itPriority: 'HIGH', requesterId: owner.userId, currentStatus: 'OPEN', version: ticket.version + 1 })
    expect(stored.ticketNumber).not.toBe('HACKED')
  })
})

describe('Origin check on every new mutating route (SEC4-03, BR-L3-09)', () => {
  it('answers 403 ORIGIN_MISMATCH for a wrong or missing Origin', async () => {
    const staffUser = await createUser({ role: 'IT_STAFF' })
    const requesterUser = await createUser({ role: 'REQUESTER' })
    const { agent: rawStaff } = await loginWithoutOrigin(staffUser.email)
    const { agent: rawRequester } = await loginWithoutOrigin(requesterUser.email)

    const routes: Array<[typeof rawStaff, string, string, object]> = [
      [rawStaff, 'post', `/api/tickets/${ticketId}/actions`, { description: 'x' }],
      [rawStaff, 'patch', `/api/tickets/${ticketId}/actions/${actionId}`, { version: 1, description: 'x' }],
      [rawStaff, 'patch', `/api/tickets/${ticketId}/status`, { status: 'OPEN', expectedVersion: 1 }],
      [rawStaff, 'patch', `/api/tickets/${ticketId}/priority`, { itPriority: 'HIGH', expectedVersion: 1 }],
      [rawStaff, 'post', `/api/tickets/${ticketId}/reassign`, { ticketOwnerId: staffUser.id, expectedVersion: 1 }],
      [rawStaff, 'post', `/api/tickets/${ticketId}/claim`, {}],
      [rawRequester, 'post', `/api/tickets/${ticketId}/appears-resolved`, {}],
    ]
    for (const [agent, method, path, body] of routes) {
      const send = (agent as unknown as Record<string, (p: string) => request.Test>)[method]
      const missing = await send.call(agent, path).send(body)
      expect(missing.status, `no Origin: ${method} ${path}`).toBe(403)
      expect(missing.body.error).toBe('ORIGIN_MISMATCH')
      const wrong = await send.call(agent, path).set('Origin', 'http://evil.example').send(body)
      expect(wrong.status, `wrong Origin: ${method} ${path}`).toBe(403)
      expect(wrong.body.error).toBe('ORIGIN_MISMATCH')
    }
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).version).toBe(1)
  })
})

describe('Static guards (SEC4-05, §10)', () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src')

  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? files(path.join(dir, entry.name)) : entry.name.endsWith('.ts') ? [path.join(dir, entry.name)] : [],
    )
  }
  const sources = () => files(SRC).map((file) => ({ file: path.relative(SRC, file), text: readFileSync(file, 'utf8') }))

  it('uses raw SQL only as bound tagged templates, and only where a row lock or a constant connectivity check needs it', () => {
    // db-check.ts runs a constant `SELECT 1` and takes no input.
    const allowed = new Set(['tickets/lock-ticket.ts', 'attachments/attachments-router.ts', 'attachments.ts', 'db-check.ts'])
    for (const { file, text } of sources()) {
      expect(/\$(queryRawUnsafe|executeRawUnsafe)/.test(text), `${file} uses an unsafe raw call`).toBe(false)
      if (/\$queryRaw|\$executeRaw/.test(text)) expect(allowed.has(file), `${file} uses raw SQL`).toBe(true)
    }
  })

  it('never runs a shell command and never builds HTML from user text', () => {
    for (const { file, text } of sources()) {
      expect(/child_process|\bexec\(|\bspawn\(/.test(text), `${file} runs a command`).toBe(false)
      expect(/res(ponse)?\.send\(`<|\.send\('<|innerHTML/.test(text), `${file} builds markup`).toBe(false)
    }
  })

  it('never returns an error message or stack from a caught error to the client', () => {
    for (const { file, text } of sources()) {
      expect(/json\(\{[^}]*(error\.message|error\.stack|err\.message|err\.stack)/.test(text), `${file} leaks an error`).toBe(false)
    }
  })
})
