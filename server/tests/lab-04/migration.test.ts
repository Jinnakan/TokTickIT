import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runSeed } from '../../prisma/seed-data.js'
import { runDemoSeed } from '../../prisma/seed-demo-data.js'
import { MigrationSandbox, PRISMA_DIR, lab4MigrationName, migrationNames } from '../helpers/migration-sandbox.js'

// Every test here runs in a throwaway schema (see migration-sandbox.ts):
// Lab 3 migrations, then legacy rows, then the Lab 4 migration on top.

let sandbox: MigrationSandbox
let client: PrismaClient

type LegacySnapshot = {
  counts: Record<string, number>
  tickets: Array<{ id: number; ticketNumber: string; summary: string; currentStatus: string; updatedAt: Date }>
  users: Array<{ id: number; email: string; role: string }>
}

async function insertOne(sql: string): Promise<number> {
  const rows = await client.$queryRawUnsafe<Array<{ id: number }>>(sql)
  return rows[0].id
}

async function insertLegacyRows(): Promise<void> {
  const requester = await insertOne(
    `INSERT INTO "User" ("email","name","passwordHash","role","isActive","mustChangePassword") VALUES ('legacy.requester@mig.test','Legacy Requester','x','REQUESTER',true,false) RETURNING id`,
  )
  const staff = await insertOne(
    `INSERT INTO "User" ("email","name","passwordHash","role","isActive","mustChangePassword") VALUES ('legacy.staff@mig.test','Legacy Staff','x','IT_STAFF',true,false) RETURNING id`,
  )
  const category = await insertOne(`INSERT INTO "Category" ("name") VALUES ('Legacy Category') RETURNING id`)
  const system = await insertOne(`INSERT INTO "RelatedSystem" ("name") VALUES ('Legacy System') RETURNING id`)
  const ticketSql = (number: string, summary: string, status: string, updatedAt: string) =>
    `INSERT INTO "Ticket" ("ticketNumber","requesterId","categoryId","relatedSystemId","summary","description","requestedPriority","itPriority","currentStatus","createdAt","updatedAt") VALUES ('${number}',${requester},${category},${system},'${summary}','Legacy description text','LOW','LOW','${status}','2026-09-01T08:00:00Z','${updatedAt}') RETURNING id`
  const newTicket = await insertOne(ticketSql('TKT-LEG-000001', 'Legacy new ticket', 'NEW', '2026-09-01T08:00:00Z'))
  await insertOne(ticketSql('TKT-LEG-000002', 'Legacy resolved ticket', 'RESOLVED', '2026-09-03T10:30:00Z'))
  await insertOne(`INSERT INTO "PublicComment" ("ticketId","authorId","body") VALUES (${newTicket},${staff},'Legacy comment') RETURNING id`)
  await insertOne(`INSERT INTO "InternalNote" ("ticketId","authorId","body") VALUES (${newTicket},${staff},'Legacy note') RETURNING id`)
  await insertOne(
    `INSERT INTO "Attachment" ("ticketId","originalFilename","storedPath","mimeType","sizeBytes") VALUES (${newTicket},'legacy.png','legacy/legacy.png','image/png',10) RETURNING id`,
  )
}

async function snapshotLegacy(): Promise<LegacySnapshot> {
  const count = async (table: string) =>
    Number((await client.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "${table}"`))[0].n)
  return {
    counts: {
      User: await count('User'),
      Ticket: await count('Ticket'),
      PublicComment: await count('PublicComment'),
      InternalNote: await count('InternalNote'),
      Attachment: await count('Attachment'),
    },
    tickets: await client.$queryRawUnsafe(
      `SELECT "id","ticketNumber","summary","currentStatus"::text AS "currentStatus","updatedAt" FROM "Ticket" ORDER BY id`,
    ),
    users: await client.$queryRawUnsafe(`SELECT "id","email","role"::text AS "role" FROM "User" ORDER BY id`),
  }
}

let before: LegacySnapshot

beforeAll(async () => {
  sandbox = await MigrationSandbox.create()
  client = sandbox.client
  const lab4 = lab4MigrationName()
  sandbox.deploy(migrationNames().filter((name) => name !== lab4))
  await insertLegacyRows()
  before = await snapshotLegacy()
  sandbox.deploy([lab4])
}, 180_000)

afterAll(async () => {
  await sandbox.dispose()
})

describe('Lab 4 migration on existing data', () => {
  it('MIG-01 keeps every earlier row and key field unchanged', async () => {
    const after = await snapshotLegacy()
    expect(after.counts).toEqual(before.counts)
    expect(after.tickets).toEqual(before.tickets)
    expect(after.users).toEqual(before.users)
  })

  it('MIG-02 writes one baseline history row per existing Ticket', async () => {
    const tickets = await client.ticket.findMany({ orderBy: { id: 'asc' } })
    const history = await client.ticketStatusHistory.findMany({ orderBy: { ticketId: 'asc' } })
    expect(history).toHaveLength(tickets.length)
    for (const ticket of tickets) {
      const rows = history.filter((row) => row.ticketId === ticket.id)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ fromStatus: null, toStatus: ticket.currentStatus, changedById: null })
      expect(rows[0].changedAt.getTime()).toBe(ticket.updatedAt.getTime())
    }
  })

  it('MIG-03 gives legacy Tickets version 1, no requester indication, and zero Actions', async () => {
    const tickets = await client.ticket.findMany()
    expect(tickets.length).toBeGreaterThan(0)
    for (const ticket of tickets) {
      expect(ticket.version).toBe(1)
      expect(ticket.requesterResolvedAt).toBeNull()
    }
    expect(await client.actionTaken.count()).toBe(0)
  })

  it('MIG-04 rollback.sql drops the new objects and leaves earlier data intact, inside a discarded transaction', async () => {
    const statements = readFileSync(path.join(PRISMA_DIR, 'migrations', lab4MigrationName(), 'rollback.sql'), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
    expect(statements.length).toBeGreaterThan(0)

    class Discard extends Error {}
    let observed: { tables: string[]; ticketColumns: string[]; tickets: number } | undefined

    await expect(
      client.$transaction(async (tx) => {
        for (const statement of statements) await tx.$executeRawUnsafe(statement)
        const tables = await tx.$queryRawUnsafe<Array<{ table_name: string }>>(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()`,
        )
        const columns = await tx.$queryRawUnsafe<Array<{ column_name: string }>>(
          `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Ticket'`,
        )
        const tickets = await tx.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "Ticket"`)
        observed = {
          tables: tables.map((row) => row.table_name),
          ticketColumns: columns.map((row) => row.column_name),
          tickets: Number(tickets[0].n),
        }
        throw new Discard()
      }),
    ).rejects.toBeInstanceOf(Discard)

    expect(observed?.tables).not.toContain('ActionTaken')
    expect(observed?.tables).not.toContain('TicketStatusHistory')
    expect(observed?.ticketColumns).not.toContain('version')
    expect(observed?.ticketColumns).not.toContain('requesterResolvedAt')
    expect(observed?.tickets).toBe(before.counts.Ticket)

    // The transaction was discarded, so the new objects are back.
    expect(await client.actionTaken.count()).toBe(0)
    expect(await client.ticketStatusHistory.count()).toBeGreaterThan(0)
  })
})

describe('Demo seed (MIG-05, MIG-06)', () => {
  async function counts() {
    return {
      users: await client.user.count(),
      tickets: await client.ticket.count(),
      actions: await client.actionTaken.count(),
      history: await client.ticketStatusHistory.count(),
      comments: await client.publicComment.count(),
      notes: await client.internalNote.count(),
    }
  }

  it('MIG-05 is idempotent and covers zero, one and many Actions, open and done follow-ups, and a Requester with no Tickets', async () => {
    await runSeed(client)
    await runDemoSeed(client)
    const first = await counts()
    await runDemoSeed(client)
    expect(await counts()).toEqual(first)

    const grouped = await client.actionTaken.groupBy({ by: ['ticketId'], _count: { _all: true } })
    const perTicket = new Map(grouped.map((row) => [row.ticketId, row._count._all]))
    const tickets = await client.ticket.findMany({ select: { id: true } })
    const sizes = tickets.map((ticket) => perTicket.get(ticket.id) ?? 0)
    expect(sizes.some((size) => size === 0)).toBe(true)
    expect(sizes.some((size) => size === 1)).toBe(true)
    expect(sizes.some((size) => size >= 3)).toBe(true)

    expect(await client.actionTaken.count({ where: { followUpRequired: true, followUpDoneAt: null } })).toBeGreaterThan(0)
    expect(await client.actionTaken.count({ where: { followUpRequired: true, followUpDoneAt: { not: null } } })).toBeGreaterThan(0)
    const statuses = new Set((await client.actionTaken.findMany({ select: { status: true } })).map((row) => row.status))
    expect(statuses).toEqual(new Set(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']))

    const historyCounts = await client.ticket.findMany({ select: { currentStatus: true, _count: { select: { statusHistory: true } } } })
    for (const ticket of historyCounts) {
      expect(ticket._count.statusHistory).toBeGreaterThanOrEqual(1)
    }
    const demoNonNew = await client.ticket.findMany({
      where: { requester: { email: { endsWith: '@toktickit.test' } }, currentStatus: { not: 'NEW' }, summary: { not: { startsWith: 'Legacy' } } },
      select: { _count: { select: { statusHistory: true } } },
    })
    expect(demoNonNew.length).toBeGreaterThan(0)
    for (const ticket of demoNonNew) expect(ticket._count.statusHistory).toBe(2)

    const noTickets = await client.user.findFirst({
      where: { role: 'REQUESTER', isActive: true, mustChangePassword: false, ticketsRequested: { none: {} } },
    })
    expect(noTickets).not.toBeNull()
  }, 120_000)

  it('MIG-06 keeps a staff edit of a seeded Action when the seed runs again', async () => {
    const seeded = await client.actionTaken.findFirstOrThrow({ where: { requestId: { startsWith: 'demo-' } }, orderBy: { id: 'asc' } })
    await client.actionTaken.update({
      where: { id: seeded.id },
      data: { description: 'Edited by staff after seeding.', version: { increment: 1 } },
    })

    await runDemoSeed(client)

    const after = await client.actionTaken.findUniqueOrThrow({ where: { id: seeded.id } })
    expect(after.description).toBe('Edited by staff after seeding.')
    expect(after.version).toBe(seeded.version + 1)
  }, 120_000)
})
