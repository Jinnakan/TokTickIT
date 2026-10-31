import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { createDashboardService } from '../src/dashboard/dashboard-service.js'

// Prints each dashboard number next to a hand-written SQL count and says whether they agree.
const prisma = new PrismaClient()
const lines: string[] = []
const say = (text: string) => { lines.push(text); console.log(text) }

async function count(sql: string, ...params: unknown[]): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(sql, ...params)
  return Number(rows[0].n)
}

const ACTIVE = `('NEW','OPEN','REOPENED','IN_PROGRESS','WAITING_FOR_REQUESTER')`
const staff = await prisma.user.findFirstOrThrow({ where: { email: 'alex.rivera@toktickit.test' } })
const requester = await prisma.user.findFirstOrThrow({ where: { email: 'sarah.johnson@toktickit.test' } })
const service = createDashboardService(prisma)
let mismatches = 0

function compare(label: string, shown: number, sql: string, expected: number) {
  const ok = shown === expected
  if (!ok) mismatches += 1
  say(`${ok ? 'MATCH   ' : 'MISMATCH'} ${label.padEnd(44)} dashboard=${String(shown).padStart(6)}  sql=${String(expected).padStart(6)}   ${sql}`)
}

say(`Dashboard numbers against direct SQL, generated ${new Date().toISOString()}`)
say('')
say(`IT Staff dashboard for ${staff.email}`)
const sd = await service.staff(staff.id, 'IT_STAFF')
const card = (key: string) => sd.cards.find((c) => c.key === key)!.count
compare('Unassigned', card('unassigned'), 'Ticket where ownerless and active', await count(`SELECT count(*) AS n FROM "Ticket" WHERE "ticketOwnerId" IS NULL AND "currentStatus" IN ${ACTIVE}`))
compare('Owned by me', card('mine'), 'Ticket where owner = user and active', await count(`SELECT count(*) AS n FROM "Ticket" WHERE "ticketOwnerId" = $1 AND "currentStatus" IN ${ACTIVE}`, staff.id))
compare('Reported resolved by Requester', card('reported-resolved'), 'Ticket where requesterResolvedAt set and active', await count(`SELECT count(*) AS n FROM "Ticket" WHERE "requesterResolvedAt" IS NOT NULL AND "currentStatus" IN ${ACTIVE}`))
compare('My open actions', card('my-open-actions'), 'ActionTaken planned or in progress for me', await count(`SELECT count(*) AS n FROM "ActionTaken" WHERE "assigneeId" = $1 AND "status" IN ('PLANNED','IN_PROGRESS')`, staff.id))
for (const row of sd.byStatus) {
  compare(`By status: ${row.status}`, row.count, 'Ticket by status', await count(`SELECT count(*) AS n FROM "Ticket" WHERE "currentStatus" = '${row.status}'`))
}
for (const row of sd.byItPriority) {
  compare(`By IT priority: ${row.priority} (active)`, row.count, 'Ticket by itPriority and active', await count(`SELECT count(*) AS n FROM "Ticket" WHERE "itPriority" = '${row.priority}' AND "currentStatus" IN ${ACTIVE}`))
}

say('')
say(`Requester dashboard for ${requester.email}`)
const rd = await service.requester(requester.id)
const rcard = (key: string) => rd.cards.find((c) => c.key === key)!.count
compare('Open tickets', rcard('open'), 'own Tickets, active', await count(`SELECT count(*) AS n FROM "Ticket" WHERE "requesterId" = $1 AND "currentStatus" IN ${ACTIVE}`, requester.id))
compare('In progress', rcard('in-progress'), 'own Tickets, IN_PROGRESS', await count(`SELECT count(*) AS n FROM "Ticket" WHERE "requesterId" = $1 AND "currentStatus" = 'IN_PROGRESS'`, requester.id))
compare('Waiting for you', rcard('waiting'), 'own Tickets, WAITING_FOR_REQUESTER', await count(`SELECT count(*) AS n FROM "Ticket" WHERE "requesterId" = $1 AND "currentStatus" = 'WAITING_FOR_REQUESTER'`, requester.id))
compare('Resolved', rcard('resolved'), 'own Tickets, RESOLVED', await count(`SELECT count(*) AS n FROM "Ticket" WHERE "requesterId" = $1 AND "currentStatus" = 'RESOLVED'`, requester.id))

say('')
say(mismatches === 0 ? 'Every number agrees with its SQL count.' : `${mismatches} number(s) disagree.`)
// Always run from server/ (see the run command); the file goes to the repository's artifacts folder.
mkdirSync('../artifacts/lab-04/evidence', { recursive: true })
writeFileSync('../artifacts/lab-04/evidence/dashboard-vs-database.txt', lines.join('\n') + '\n')
await prisma.$disconnect()
process.exit(mismatches === 0 ? 0 : 1)
