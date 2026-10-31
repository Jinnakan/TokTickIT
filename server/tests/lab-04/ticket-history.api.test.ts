import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/prisma.js'
import { loginAsNewUser } from '../helpers/users.js'
import { createTicketVia } from '../helpers/tickets.js'

describe('Ticket creation writes the first history row (BR-L4-16, AC-L4-18)', () => {
  it('records fromStatus null, toStatus NEW and the Requester as actor, once', async () => {
    const requester = await loginAsNewUser('REQUESTER')
    const ticket = await createTicketVia(requester.agent)

    const rows = await prisma.ticketStatusHistory.findMany({ where: { ticketId: ticket.id } })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ fromStatus: null, toStatus: 'NEW', changedById: requester.userId })
  })
})
