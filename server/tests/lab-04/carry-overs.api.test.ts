import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/prisma.js'
import { loginAsAdministrator, loginAsItStaff, loginAsRequester, type AuthenticatedAgent } from '../helpers/session.js'

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
  it('lists only active IT Staff and Administrators, with minimal fields, for staff roles', async () => {
    const { agent: staff } = await loginAsItStaff()
    const { agent: admin } = await loginAsAdministrator()

    for (const agent of [staff, admin]) {
      const response = await agent.get('/api/users/assignable')
      expect(response.status).toBe(200)
      expect(response.body.length).toBeGreaterThan(0)
      for (const item of response.body) {
        expect(Object.keys(item).sort()).toEqual(['id', 'name', 'role'])
        expect(['IT_STAFF', 'ADMINISTRATOR']).toContain(item.role)
      }
      const ids = response.body.map((item: { id: number }) => item.id)
      const inactive = await prisma.user.findMany({ where: { isActive: false }, select: { id: true } })
      for (const user of inactive) expect(ids).not.toContain(user.id)
      const requesters = await prisma.user.findMany({ where: { role: 'REQUESTER' }, select: { id: true } })
      for (const user of requesters) expect(ids).not.toContain(user.id)
    }
  })

  it('refuses a Requester with 403 and no session with 401', async () => {
    const { agent: requester } = await loginAsRequester()
    expect((await requester.get('/api/users/assignable')).status).toBe(403)

    const request = (await import('supertest')).default
    const { app } = await import('../../src/app.js')
    expect((await request(app).get('/api/users/assignable')).status).toBe(401)
  })
})

describe('Reassign accepts Administrators (CO-02, FR-L4-15)', () => {
  it('assigns to an active Administrator and refuses inactive or non-staff owners', async () => {
    const { agent: requester } = await loginAsRequester()
    const { agent: staff } = await loginAsItStaff()
    const { userId: adminId } = await loginAsAdministrator()
    const ticket = await createTicketAs(requester)

    const toAdmin = await staff.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: adminId })
    expect(toAdmin.status).toBe(200)
    expect(toAdmin.body.ticketOwnerId).toBe(adminId)

    const inactiveStaff = await prisma.user.findFirstOrThrow({ where: { role: 'IT_STAFF', isActive: false } })
    const toInactive = await staff.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: inactiveStaff.id })
    expect(toInactive.status).toBe(400)

    const aRequester = await prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } })
    const toRequester = await staff.post(`/api/tickets/${ticket.id}/reassign`).send({ ticketOwnerId: aRequester.id })
    expect(toRequester.status).toBe(400)
  })
})

describe('PATCH /api/users/:id email (CO-03, FR-L4-16)', () => {
  it('updates, trims, and lowercases the email', async () => {
    const { agent } = await loginAsAdministrator()
    const stamp = Date.now()
    const created = await agent.post('/api/users').send({ name: 'Email Edit', email: `email-edit-${stamp}@toktickit.test`, role: 'REQUESTER' })

    const response = await agent.patch(`/api/users/${created.body.id}`).send({ email: `  Email-Edited-${stamp}@Toktickit.test ` })

    expect(response.status).toBe(200)
    expect(response.body.email).toBe(`email-edited-${stamp}@toktickit.test`)
  })

  it('rejects a duplicate email with 400 EMAIL_TAKEN and a malformed one with 400', async () => {
    const { agent } = await loginAsAdministrator()
    const stamp = Date.now()
    const first = await agent.post('/api/users').send({ name: 'First', email: `dup-a-${stamp}@toktickit.test`, role: 'REQUESTER' })
    const second = await agent.post('/api/users').send({ name: 'Second', email: `dup-b-${stamp}@toktickit.test`, role: 'REQUESTER' })

    const duplicate = await agent.patch(`/api/users/${second.body.id}`).send({ email: first.body.email })
    expect(duplicate.status).toBe(400)
    expect(duplicate.body.error).toBe('EMAIL_TAKEN')

    const malformed = await agent.patch(`/api/users/${second.body.id}`).send({ email: 'not-an-email' })
    expect(malformed.status).toBe(400)
    expect(malformed.body.error).toBe('VALIDATION_FAILED')
    expect(malformed.body.fields.email).toBeTruthy()

    const stored = await prisma.user.findUniqueOrThrow({ where: { id: second.body.id } })
    expect(stored.email).toBe(second.body.email)
  })

  it('allows saving the user with their own unchanged email', async () => {
    const { agent } = await loginAsAdministrator()
    const created = await agent.post('/api/users').send({ name: 'Same Email', email: `same-email-${Date.now()}@toktickit.test`, role: 'REQUESTER' })

    const response = await agent.patch(`/api/users/${created.body.id}`).send({ email: created.body.email, name: 'Same Email Renamed' })

    expect(response.status).toBe(200)
    expect(response.body.name).toBe('Same Email Renamed')
  })

  it('refuses non-Administrators', async () => {
    const { agent: staff } = await loginAsItStaff()
    const { userId } = await loginAsRequester()
    expect((await staff.patch(`/api/users/${userId}`).send({ email: 'x@toktickit.test' })).status).toBe(403)
  })
})

describe('Attachment endpoint rules are unchanged (CO-04, AC-L4-25)', () => {
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])

  it('lets IT Staff list and download but not upload or remove', async () => {
    const { agent: requester } = await loginAsRequester()
    const { agent: staff } = await loginAsItStaff()
    const ticket = await createTicketAs(requester)

    const uploaded = await requester
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach('file', validJpeg, { filename: 'photo.jpg', contentType: 'image/jpeg' })
    expect(uploaded.status).toBe(201)

    expect((await staff.get(`/api/tickets/${ticket.id}/attachments`)).status).toBe(200)
    expect((await staff.get(`/api/attachments/${uploaded.body.id}/download`)).status).toBe(200)

    const staffUpload = await staff
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach('file', validJpeg, { filename: 'staff.jpg', contentType: 'image/jpeg' })
    expect(staffUpload.status).toBe(403)
    expect((await staff.delete(`/api/attachments/${uploaded.body.id}`).send({ reason: 'x' })).status).toBe(403)
  })
})

describe('Specific error codes for Administrator guards (CO-05, FR-L4-17)', () => {
  it('returns SELF_DEACTIVATION when an Administrator deactivates themselves', async () => {
    const { agent, userId } = await loginAsAdministrator()
    const response = await agent.post(`/api/users/${userId}/deactivate`)
    expect(response.status).toBe(409)
    expect(response.body.error).toBe('SELF_DEACTIVATION')
    expect(response.body.message).toBeTruthy()
  })

  it('returns EMAIL_TAKEN with a field message when creating a duplicate', async () => {
    const { agent } = await loginAsAdministrator()
    const email = `dup-create-${Date.now()}@toktickit.test`
    await agent.post('/api/users').send({ name: 'Original', email, role: 'REQUESTER' })

    const response = await agent.post('/api/users').send({ name: 'Copy', email, role: 'REQUESTER' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('EMAIL_TAKEN')
  })
})
