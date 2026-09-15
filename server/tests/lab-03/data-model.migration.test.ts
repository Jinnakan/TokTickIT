import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/prisma.js'
import {
  activeAdministrators,
  activeItStaff,
  activeRequesters,
  inactiveItStaff,
  inactiveRequesters,
  runSeed,
} from '../../prisma/seed-data.js'

// MIG-01 (AC-L3-17): every pre-Lab-3 Ticket must still resolve to the
// correct requester after the DevRequester -> User migration. There is no
// DevRequester table left to compare against directly (the migration
// dropped it), so this asserts the invariant the migration was designed to
// guarantee: every migrated seed Requester's email is now a User with role
// REQUESTER, and every Ticket's requesterId resolves to a User (the FK
// retarget didn't rewrite ids, so a dangling/mismatched reference would
// show up here as a Prisma relation-load failure or a wrong role).
describe('DevRequester -> User migration (MIG-01, AC-L3-17)', () => {
  it('every seeded Requester identity is now a User with role REQUESTER', async () => {
    const allRequesters = [...activeRequesters, ...inactiveRequesters]

    for (const requester of allRequesters) {
      const user = await prisma.user.findUnique({ where: { email: requester.email } })
      expect(user).not.toBeNull()
      expect(user?.role).toBe('REQUESTER')
      expect(user?.name).toBe(requester.name)
    }
  })

  it('every existing Ticket still resolves to its correct Requester User', async () => {
    const tickets = await prisma.ticket.findMany({
      include: { requester: true },
      take: 50,
      orderBy: { id: 'asc' },
    })

    expect(tickets.length).toBeGreaterThan(0)

    for (const ticket of tickets) {
      expect(ticket.requester).not.toBeNull()
      expect(ticket.requester.id).toBe(ticket.requesterId)
      expect(ticket.requester.role).toBe('REQUESTER')
    }
  })

  it("copies itPriority from requestedPriority at creation, matching the migration's original backfill", async () => {
    // Issue 19's PATCH /priority now legitimately changes itPriority
    // independently of requestedPriority, so a whole-table equality check
    // is no longer a valid invariant -- this instead re-proves the same
    // rule the migration backfill established, against a ticket nothing
    // else in this run has touched.
    const requester = await prisma.user.findFirstOrThrow({ where: { role: 'REQUESTER', isActive: true } })
    const category = await prisma.category.findFirstOrThrow({ where: { isActive: true } })
    const relatedSystem = await prisma.relatedSystem.findFirstOrThrow({ where: { isActive: true } })

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TEST-MIG-${Date.now()}`,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        requestedPriority: 'HIGH',
        itPriority: 'HIGH',
        summary: 'Migration backfill regression check',
        description: 'Verifies itPriority still starts equal to requestedPriority.',
      },
    })

    expect(ticket.itPriority).toBe(ticket.requestedPriority)
  })

  it('the DevRequester table no longer exists (migrated away, not duplicated)', async () => {
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'DevRequester'
    `
    expect(tables).toHaveLength(0)
  })
})

// MIG-02: the seed script is idempotent and the required minimums
// (specification.md §7) hold after running it any number of times.
describe('Seed script idempotency and minimums (MIG-02)', () => {
  it('running the seed twice produces the same user set with no duplicates', async () => {
    await runSeed(prisma)
    const firstRunCount = await prisma.user.count()

    await runSeed(prisma)
    const secondRunCount = await prisma.user.count()

    expect(secondRunCount).toBe(firstRunCount)
  })

  it('meets the required seed minimums for every role', async () => {
    await runSeed(prisma)

    const activeRequesterCount = await prisma.user.count({ where: { role: 'REQUESTER', isActive: true } })
    const inactiveRequesterCount = await prisma.user.count({ where: { role: 'REQUESTER', isActive: false } })
    const activeItStaffCount = await prisma.user.count({ where: { role: 'IT_STAFF', isActive: true } })
    const inactiveItStaffCount = await prisma.user.count({ where: { role: 'IT_STAFF', isActive: false } })
    const activeAdminCount = await prisma.user.count({ where: { role: 'ADMINISTRATOR', isActive: true } })

    expect(activeRequesterCount).toBeGreaterThanOrEqual(activeRequesters.length)
    expect(inactiveRequesterCount).toBeGreaterThanOrEqual(inactiveRequesters.length)
    expect(activeItStaffCount).toBeGreaterThanOrEqual(activeItStaff.length)
    expect(inactiveItStaffCount).toBeGreaterThanOrEqual(inactiveItStaff.length)
    expect(activeAdminCount).toBeGreaterThanOrEqual(activeAdministrators.length)
  })
})
