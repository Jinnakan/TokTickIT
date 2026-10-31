import { beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '../../src/prisma.js'
import { loginAsNewUser } from '../helpers/users.js'
import { createTicketVia } from '../helpers/tickets.js'

// A real JPEG signature is enough for the content check (same bytes the Lab 2 attachment tests use).
const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

let requester: Awaited<ReturnType<typeof loginAsNewUser>>
let staff: Awaited<ReturnType<typeof loginAsNewUser>>

async function updatedAt(ticketId: number): Promise<number> {
  return (await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } })).updatedAt.getTime()
}

beforeAll(async () => {
  ;[requester, staff] = await Promise.all([loginAsNewUser('REQUESTER'), loginAsNewUser('IT_STAFF')])
}, 60_000)

describe('Child activity refreshes Ticket.updatedAt (BR-L4-15, AC-L4-20)', () => {
  it('refreshes on a Public Comment', async () => {
    const ticket = await createTicketVia(requester.agent)
    const before = await updatedAt(ticket.id)
    await sleep(15)
    expect((await requester.agent.post(`/api/tickets/${ticket.id}/comments`).send({ body: 'Hello' })).status).toBe(201)
    expect(await updatedAt(ticket.id)).toBeGreaterThan(before)
  })

  it('refreshes on an Internal Note', async () => {
    const ticket = await createTicketVia(requester.agent)
    const before = await updatedAt(ticket.id)
    await sleep(15)
    expect((await staff.agent.post(`/api/tickets/${ticket.id}/notes`).send({ body: 'Note' })).status).toBe(201)
    expect(await updatedAt(ticket.id)).toBeGreaterThan(before)
  })

  it('refreshes on an Attachment upload and on its removal', async () => {
    const ticket = await createTicketVia(requester.agent)
    const beforeUpload = await updatedAt(ticket.id)
    await sleep(15)
    const upload = await requester.agent
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach('file', VALID_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' })
    expect(upload.status).toBe(201)
    const afterUpload = await updatedAt(ticket.id)
    expect(afterUpload).toBeGreaterThan(beforeUpload)

    await sleep(15)
    const removal = await requester.agent.delete(`/api/attachments/${upload.body.id}`).send({ reason: 'Wrong file' })
    expect(removal.status).toBe(200)
    expect(await updatedAt(ticket.id)).toBeGreaterThan(afterUpload)
  })
})
