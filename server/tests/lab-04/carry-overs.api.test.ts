import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../helpers/app.js'
import { prisma } from '../../src/prisma.js'
import { loginAsAdministrator, loginAsEmail, loginAsItStaff, type AuthenticatedAgent } from '../helpers/session.js'
import { createUser, loginAsNewUser } from '../helpers/users.js'

async function createTicketAs(agent: AuthenticatedAgent) {
  const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } })
  const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })
  const response = await agent.post('/api/tickets').send({
    categoryId: category.id,
    relatedSystemId: relatedSystem.id,
    requestedPriority: 'LOW',
    summary: 'Lab 4 carry-over test ticket',
    description: 'Used to verify the Lab 3 carry-over behavior.',
  })
  return response.body as { id: number }
}

describe('GET /api/users/assignable (CO-01, FR-L4-15)', () => {
  it('lists active IT Staff and Administrators with minimal fields, for staff roles only', async () => {
    const inactiveStaff = await createUser({ role: 'IT_STAFF', isActive: false })
    const requester = await createUser({ role: 'REQUESTER' })

    for (const { agent } of [await loginAsItStaff(), await loginAsAdministrator()]) {
      const response = await agent.get('/api/users/assignable')

      expect(response.status).toBe(200)
      expect(response.body.length).toBeGreaterThan(0)
      for (const item of response.body) {
        expect(Object.keys(item).sort()).toEqual(['id', 'name', 'role'])
        expect(['IT_STAFF', 'ADMINISTRATOR']).toContain(item.role)
      }
      const ids = response.body.map((item: { id: number }) => item.id)
      expect(ids).not.toContain(inactiveStaff.id)
      expect(ids).not.toContain(requester.id)
    }
  })

  it('refuses a Requester with 403 and no session with 401', async () => {
    const { agent: requester } = await loginAsNewUser('REQUESTER')

    expect((await requester.get('/api/users/assignable')).status).toBe(403)
    expect((await request(app).get('/api/users/assignable')).status).toBe(401)
  })
})

describe('Reassign accepts Administrators (CO-02, FR-L4-15)', () => {
  it('assigns to an active Administrator and refuses inactive or non-staff owners', async () => {
    const { agent: requester, userId: requesterId } = await loginAsNewUser('REQUESTER')
    const { agent: staff } = await loginAsNewUser('IT_STAFF')
    const admin = await createUser({ role: 'ADMINISTRATOR' })
    const inactiveStaff = await createUser({ role: 'IT_STAFF', isActive: false })
    const ticket = await createTicketAs(requester)

    const toAdmin = await staff.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: admin.id })
    expect(toAdmin.status).toBe(200)
    expect(toAdmin.body.ticketOwnerId).toBe(admin.id)

    expect((await staff.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: inactiveStaff.id })).status).toBe(400)
    expect((await staff.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: requesterId })).status).toBe(400)
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } })).ticketOwnerId).toBe(admin.id)
  })
})

describe('PATCH /api/users/:id email (CO-03, FR-L4-16)', () => {
  it('updates, trims, and lowercases the email', async () => {
    const { agent } = await loginAsAdministrator()
    const target = await createUser({ role: 'REQUESTER' })

    const response = await agent.patch(`/api/users/${target.id}`).send({ email: `  New-${target.email.toUpperCase()} ` })

    expect(response.status).toBe(200)
    expect(response.body.email).toBe(`new-${target.email}`)
  })

  it('rejects a duplicate with 400 EMAIL_TAKEN and a malformed address with 400, changing nothing', async () => {
    const { agent } = await loginAsAdministrator()
    const first = await createUser({ role: 'REQUESTER' })
    const second = await createUser({ role: 'REQUESTER' })

    const duplicate = await agent.patch(`/api/users/${second.id}`).send({ email: first.email })
    expect(duplicate.status).toBe(400)
    expect(duplicate.body.error).toBe('EMAIL_TAKEN')

    const malformed = await agent.patch(`/api/users/${second.id}`).send({ email: 'not-an-email' })
    expect(malformed.status).toBe(400)
    expect(malformed.body.error).toBe('VALIDATION_FAILED')
    expect(malformed.body.fields.email).toBeTruthy()

    expect((await prisma.user.findUniqueOrThrow({ where: { id: second.id } })).email).toBe(second.email)
  })

  it('accepts saving the user with their own unchanged email', async () => {
    const { agent } = await loginAsAdministrator()
    const target = await createUser({ role: 'REQUESTER' })

    const response = await agent.patch(`/api/users/${target.id}`).send({ email: target.email, name: 'Renamed Person' })

    expect(response.status).toBe(200)
    expect(response.body.name).toBe('Renamed Person')
  })

  it('refuses non-Administrators', async () => {
    const { agent: staff } = await loginAsNewUser('IT_STAFF')
    const target = await createUser({ role: 'REQUESTER' })

    expect((await staff.patch(`/api/users/${target.id}`).send({ email: 'x@toktickit.test' })).status).toBe(403)
  })
})

describe('Attachment endpoint rules are unchanged (CO-04, AC-L4-27)', () => {
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])

  it('lets IT Staff list and download but not upload or remove', async () => {
    const { agent: requester } = await loginAsNewUser('REQUESTER')
    const { agent: staff } = await loginAsNewUser('IT_STAFF')
    const ticket = await createTicketAs(requester)

    const uploaded = await requester
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach('file', validJpeg, { filename: 'photo.jpg', contentType: 'image/jpeg' })
    expect(uploaded.status).toBe(201)

    expect((await staff.get(`/api/tickets/${ticket.id}/attachments`)).status).toBe(200)
    expect((await staff.get(`/api/attachments/${uploaded.body.id}/download`)).status).toBe(200)
    expect(
      (await staff.post(`/api/tickets/${ticket.id}/attachments`).attach('file', validJpeg, { filename: 's.jpg', contentType: 'image/jpeg' })).status,
    ).toBe(403)
    expect((await staff.delete(`/api/attachments/${uploaded.body.id}`).send({ reason: 'x' })).status).toBe(403)
  })
})

describe('Specific error codes for Administrator guards (CO-05, FR-L4-17)', () => {
  it('returns SELF_DEACTIVATION with a message when an Administrator deactivates themselves', async () => {
    const { agent, userId } = await loginAsNewUser('ADMINISTRATOR')

    const response = await agent.post(`/api/users/${userId}/deactivate`)

    expect(response.status).toBe(409)
    expect(response.body.error).toBe('SELF_DEACTIVATION')
    expect(response.body.message).toBeTruthy()
  })

  it('returns EMAIL_TAKEN when creating a duplicate', async () => {
    const { agent } = await loginAsAdministrator()
    const existing = await createUser({ role: 'REQUESTER' })

    const response = await agent.post('/api/users').send({ name: 'Copy', email: existing.email, role: 'REQUESTER' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('EMAIL_TAKEN')
  })

  it('refuses to demote the only active Administrator with LAST_ADMINISTRATOR', async () => {
    const survivor = await createUser({ role: 'ADMINISTRATOR' })
    const others = await prisma.user.findMany({ where: { role: 'ADMINISTRATOR', isActive: true, id: { not: survivor.id } }, select: { id: true } })
    await prisma.user.updateMany({ where: { id: { in: others.map((user) => user.id) } }, data: { isActive: false } })
    try {
      const { agent } = await loginAsEmail(survivor.email)

      const response = await agent.patch(`/api/users/${survivor.id}`).send({ role: 'REQUESTER' })

      expect(response.status).toBe(409)
      expect(response.body.error).toBe('LAST_ADMINISTRATOR')
    } finally {
      await prisma.user.updateMany({ where: { id: { in: others.map((user) => user.id) } }, data: { isActive: true } })
    }
  })
})
