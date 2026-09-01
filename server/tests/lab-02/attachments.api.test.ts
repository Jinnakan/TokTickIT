import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app } from '../../src/app.js'
import { prisma } from '../../src/prisma.js'

let requesterAId: number
let requesterBId: number
let categoryId: number
let relatedSystemId: number

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
const FAKE_JPEG_WRONG_BYTES = Buffer.from('this is not actually a jpeg, just plain text', 'utf-8')

async function createTicketAs(requesterId: number) {
  const response = await request(app)
    .post('/api/tickets')
    .set('X-Dev-Requester-Id', String(requesterId))
    .send({
      categoryId,
      relatedSystemId,
      requestedPriority: 'MEDIUM',
      summary: 'Attachment lifecycle test ticket',
      description: 'Used to verify attachment upload, download, and removal behavior.',
    })
  return response.body
}

function uploadTo(ticketId: number, requesterId: number) {
  return request(app)
    .post(`/api/tickets/${ticketId}/attachments`)
    .set('X-Dev-Requester-Id', String(requesterId))
}

beforeAll(async () => {
  const [requesterA, requesterB, category, relatedSystem] = await Promise.all([
    prisma.devRequester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' } }),
    prisma.devRequester.findFirstOrThrow({ where: { isActive: true }, orderBy: { id: 'asc' }, skip: 1 }),
    prisma.category.findFirstOrThrow({ where: { isActive: true } }),
    prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } }),
  ])
  requesterAId = requesterA.id
  requesterBId = requesterB.id
  categoryId = category.id
  relatedSystemId = relatedSystem.id
})

describe('POST /api/tickets/:id/attachments', () => {
  it('accepts a valid JPEG and returns active-attachment metadata', async () => {
    const ticket = await createTicketAs(requesterAId)

    const response = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    expect(response.status).toBe(201)
    expect(response.body.originalFilename).toBe('photo.jpg')
    expect(response.body.isRemoved).toBe(false)
  })

  it('rejects a file whose bytes do not match its claimed type, even with a matching extension and MIME (magic-byte check)', async () => {
    const ticket = await createTicketAs(requesterAId)

    const response = await uploadTo(ticket.id, requesterAId).attach('file', FAKE_JPEG_WRONG_BYTES, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('UNSUPPORTED_FILE_TYPE')
  })

  it('rejects a disallowed extension', async () => {
    const ticket = await createTicketAs(requesterAId)

    const response = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'malware.exe',
      contentType: 'application/octet-stream',
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('UNSUPPORTED_FILE_TYPE')
  })

  it('rejects a file larger than 5 MB', async () => {
    const ticket = await createTicketAs(requesterAId)
    const oversized = Buffer.concat([VALID_JPEG, Buffer.alloc(5 * 1024 * 1024)])

    const response = await uploadTo(ticket.id, requesterAId).attach('file', oversized, {
      filename: 'huge.jpg',
      contentType: 'image/jpeg',
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('FILE_TOO_LARGE')
  })

  it('rejects upload with no file in the request', async () => {
    const ticket = await createTicketAs(requesterAId)

    const response = await uploadTo(ticket.id, requesterAId)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('FILE_REQUIRED')
  })

  it('returns 403 (not 404) uploading to a ticket owned by a different Requester', async () => {
    const ticket = await createTicketAs(requesterAId)

    const response = await uploadTo(ticket.id, requesterBId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('TICKET_FORBIDDEN')
  })

  it('returns 404 uploading to an unknown ticket', async () => {
    const response = await uploadTo(9999999, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('TICKET_NOT_FOUND')
  })

  it('rejects a request with no Development Requester context', async () => {
    const ticket = await createTicketAs(requesterAId)

    const response = await request(app)
      .post(`/api/tickets/${ticket.id}/attachments`)
      .attach('file', VALID_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('DEV_REQUESTER_REQUIRED')
  })

  it('enforces the 5-active-attachment limit and leaves exactly 5 stored (AC-08)', async () => {
    const ticket = await createTicketAs(requesterAId)

    for (let index = 0; index < 5; index += 1) {
      const response = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
        filename: `photo-${index}.jpg`,
        contentType: 'image/jpeg',
      })
      expect(response.status).toBe(201)
    }

    const sixth = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo-6.jpg',
      contentType: 'image/jpeg',
    })
    expect(sixth.status).toBe(400)
    expect(sixth.body.error).toBe('ATTACHMENT_LIMIT_REACHED')

    const activeCount = await prisma.attachment.count({ where: { ticketId: ticket.id, isRemoved: false } })
    expect(activeCount).toBe(5)
  })

  it('enforces the limit correctly under real concurrent uploads, not just sequential ones', async () => {
    const ticket = await createTicketAs(requesterAId)

    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
          filename: `concurrent-${index}.jpg`,
          contentType: 'image/jpeg',
        }),
      ),
    )

    const succeeded = responses.filter((response) => response.status === 201)
    const limitRejected = responses.filter(
      (response) => response.status === 400 && response.body.error === 'ATTACHMENT_LIMIT_REACHED',
    )

    expect(succeeded.length).toBe(5)
    expect(limitRejected.length).toBe(3)

    const activeCount = await prisma.attachment.count({ where: { ticketId: ticket.id, isRemoved: false } })
    expect(activeCount).toBe(5)
  })
})

describe('GET /api/tickets/:id/attachments', () => {
  it('lists metadata for an owned ticket and rejects a non-owner', async () => {
    const ticket = await createTicketAs(requesterAId)
    await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const owned = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments`)
      .set('X-Dev-Requester-Id', String(requesterAId))
    expect(owned.status).toBe(200)
    expect(owned.body.length).toBe(1)
    expect(owned.body[0].originalFilename).toBe('photo.jpg')

    const notOwned = await request(app)
      .get(`/api/tickets/${ticket.id}/attachments`)
      .set('X-Dev-Requester-Id', String(requesterBId))
    expect(notOwned.status).toBe(403)
    expect(notOwned.body.error).toBe('TICKET_FORBIDDEN')
  })
})

describe('GET /api/attachments/:id/download', () => {
  it('streams the file for its owner with the original filename', async () => {
    const ticket = await createTicketAs(requesterAId)
    const uploaded = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const response = await request(app)
      .get(`/api/attachments/${uploaded.body.id}/download`)
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(200)
    expect(response.headers['content-disposition']).toContain('photo.jpg')
    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(Buffer.compare(response.body, VALID_JPEG)).toBe(0)
  })

  it('returns 403 (not 404) for an attachment owned by a different Requester', async () => {
    const ticket = await createTicketAs(requesterAId)
    const uploaded = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const response = await request(app)
      .get(`/api/attachments/${uploaded.body.id}/download`)
      .set('X-Dev-Requester-Id', String(requesterBId))

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('ATTACHMENT_FORBIDDEN')
  })

  it('returns 404 for an unknown attachment id', async () => {
    const response = await request(app)
      .get('/api/attachments/9999999/download')
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('ATTACHMENT_NOT_FOUND')
  })

  it('returns 410 for a removed attachment and blocks the download (BR-20)', async () => {
    const ticket = await createTicketAs(requesterAId)
    const uploaded = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    await request(app)
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set('X-Dev-Requester-Id', String(requesterAId))
      .send({ reason: 'Uploaded the wrong file' })

    const response = await request(app)
      .get(`/api/attachments/${uploaded.body.id}/download`)
      .set('X-Dev-Requester-Id', String(requesterAId))

    expect(response.status).toBe(410)
    expect(response.body.error).toBe('ATTACHMENT_REMOVED')
  })
})

describe('DELETE /api/attachments/:id', () => {
  it('soft-removes with a valid reason and keeps the metadata visible (AC-13)', async () => {
    const ticket = await createTicketAs(requesterAId)
    const uploaded = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const response = await request(app)
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set('X-Dev-Requester-Id', String(requesterAId))
      .send({ reason: 'Uploaded the wrong file' })

    expect(response.status).toBe(200)
    expect(response.body.isRemoved).toBe(true)
    expect(response.body.removedReason).toBe('Uploaded the wrong file')
    expect(response.body.originalFilename).toBe('photo.jpg')
  })

  it('rejects a missing or too-short reason (AC-14)', async () => {
    const ticket = await createTicketAs(requesterAId)
    const uploaded = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const noReason = await request(app)
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set('X-Dev-Requester-Id', String(requesterAId))
      .send({})
    expect(noReason.status).toBe(400)
    expect(noReason.body.error).toBe('REASON_REQUIRED')

    const tooShort = await request(app)
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set('X-Dev-Requester-Id', String(requesterAId))
      .send({ reason: 'ab' })
    expect(tooShort.status).toBe(400)
    expect(tooShort.body.error).toBe('REASON_REQUIRED')
  })

  it('rejects removing an already-removed attachment', async () => {
    const ticket = await createTicketAs(requesterAId)
    const uploaded = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    await request(app)
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set('X-Dev-Requester-Id', String(requesterAId))
      .send({ reason: 'First removal' })

    const response = await request(app)
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set('X-Dev-Requester-Id', String(requesterAId))
      .send({ reason: 'Second removal attempt' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('ALREADY_REMOVED')
  })

  it('returns 403 (not 404) removing an attachment owned by a different Requester', async () => {
    const ticket = await createTicketAs(requesterAId)
    const uploaded = await uploadTo(ticket.id, requesterAId).attach('file', VALID_JPEG, {
      filename: 'photo.jpg',
      contentType: 'image/jpeg',
    })

    const response = await request(app)
      .delete(`/api/attachments/${uploaded.body.id}`)
      .set('X-Dev-Requester-Id', String(requesterBId))
      .send({ reason: 'Trying to remove someone else\'s attachment' })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('ATTACHMENT_FORBIDDEN')
  })
})
