import { beforeAll, describe, expect, it } from 'vitest'
import type { TicketStatus } from '@prisma/client'
import { loginAsNewUser } from '../helpers/users.js'
import { createTicketRow } from '../helpers/tickets.js'

type Actor = Awaited<ReturnType<typeof loginAsNewUser>>
let staff: Actor

const ids = (response: { body: { data: Array<{ id: number }> } }) => response.body.data.map((item) => item.id).sort((a, b) => a - b)

beforeAll(async () => {
  staff = await loginAsNewUser('IT_STAFF')
}, 60_000)

/** Every test gets its own Requesters, so Tickets from one test never show up in another. */
async function seed() {
  const [requester, other] = await Promise.all([loginAsNewUser('REQUESTER'), loginAsNewUser('REQUESTER')])
  const made: Record<string, number> = {}
  for (const status of ['NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_REQUESTER', 'RESOLVED', 'CLOSED'] as TicketStatus[]) {
    made[status] = (await createTicketRow({ requesterId: requester.userId, status })).id
  }
  made.REPORTED = (await createTicketRow({ requesterId: requester.userId, status: 'IN_PROGRESS', requesterResolvedAt: new Date() })).id
  made.OTHER = (await createTicketRow({ requesterId: other.userId, status: 'IN_PROGRESS', requesterResolvedAt: new Date() })).id
  return { made, requester, other }
}

describe('statusGroup and requesterReportedResolved (WF-16, AC-L4-25)', () => {
  it('filters the Requester list by status group and stays scoped to the Requester', async () => {
    const { made, requester, other } = await seed()
    const get = (query: string) => requester.agent.get(`/api/tickets?${query}&pageSize=50`)

    expect(ids(await get('statusGroup=active'))).toEqual([made.NEW, made.OPEN, made.IN_PROGRESS, made.WAITING_FOR_REQUESTER, made.REPORTED].sort((a, b) => a - b))
    expect(ids(await get('statusGroup=in-progress'))).toEqual([made.IN_PROGRESS, made.REPORTED].sort((a, b) => a - b))
    expect(ids(await get('statusGroup=waiting'))).toEqual([made.WAITING_FOR_REQUESTER])
    expect(ids(await get('statusGroup=resolved'))).toEqual([made.RESOLVED])
    expect(ids(await get('requesterReportedResolved=true'))).toEqual([made.REPORTED])
    expect(ids(await get('statusGroup=active&requesterReportedResolved=true'))).toEqual([made.REPORTED])
  })

  it('requires both conditions when statusGroup and currentStatus are sent together', async () => {
    const { made, requester, other } = await seed()
    const get = (query: string) => requester.agent.get(`/api/tickets?${query}&pageSize=50`)
    expect(ids(await get('statusGroup=active&currentStatus=OPEN'))).toEqual([made.OPEN])
    expect(ids(await get('statusGroup=active&currentStatus=RESOLVED'))).toEqual([])
    expect(ids(await get('statusGroup=resolved&currentStatus=RESOLVED'))).toEqual([made.RESOLVED])
  })

  it('filters the staff list too, and keeps the indication on staff list items only', async () => {
    const { made, requester, other } = await seed()
    const response = await staff.agent.get(`/api/tickets?requesterReportedResolved=true&statusGroup=active&pageSize=50`)
    expect(response.status).toBe(200)
    const found = ids(response)
    expect(found).toContain(made.REPORTED)
    expect(found).toContain(made.OTHER)
    expect(found).not.toContain(made.IN_PROGRESS)
    expect(response.body.data.every((item: { requesterResolvedAt: string | null }) => item.requesterResolvedAt !== null)).toBe(true)
  })

  it('rejects an unknown value with 400 for both roles', async () => {
    const requester = await loginAsNewUser('REQUESTER')
    for (const actor of [requester, staff]) {
      const group = await actor.agent.get('/api/tickets?statusGroup=everything')
      expect(group.status).toBe(400)
      expect(group.body.fields.statusGroup).toBeDefined()
      const flag = await actor.agent.get('/api/tickets?requesterReportedResolved=false')
      expect(flag.status).toBe(400)
      expect(flag.body.fields.requesterReportedResolved).toBeDefined()
    }
  })

  it('still behaves like Lab 3 without the new parameters', async () => {
    const { requester } = await seed()
    const response = await requester.agent.get('/api/tickets?pageSize=50')
    expect(response.status).toBe(200)
    expect(response.body.data.length).toBeGreaterThanOrEqual(7)
    expect('requesterResolvedAt' in response.body.data[0]).toBe(false)
  })
})
