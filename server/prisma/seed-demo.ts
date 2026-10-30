import { PrismaClient, Priority, TicketStatus } from '@prisma/client'

// Opt-in demo data for screenshots and manual review: realistic Tickets spread
// across Requesters, statuses, priorities and owners, plus example Public
// Comments and Internal Notes. Kept out of `prisma:seed` on purpose so the
// automated test suites (which count and filter tickets) keep a clean baseline.
// Idempotent: a demo ticket is skipped when its summary already exists.

const prisma = new PrismaClient()

const DAY_MS = 24 * 60 * 60 * 1000

// Same format as generateTicketNumber in src/tickets.ts; not imported because
// that module opens its own database connection at import time.
function generateTicketNumber(id: number, createdAt: Date): string {
  return `TKT-${createdAt.getUTCFullYear()}-${String(id).padStart(6, '0')}`
}

type DemoTicket = {
  requester: string
  owner: string | null
  category: string
  system: string
  requested: Priority
  it: Priority
  status: TicketStatus
  summary: string
  description: string
  daysAgo: number
  comments: Array<{ by: 'requester' | 'owner'; body: string }>
  notes: string[]
}

const DEMO_TICKETS: DemoTicket[] = [
  { requester: 'jennifer.anderson', owner: 'alex.rivera', category: 'Hardware', system: 'Corporate Laptop', requested: 'MEDIUM', it: 'MEDIUM', status: 'IN_PROGRESS', summary: 'Laptop battery drains quickly', description: 'Battery drops from 100% to 20% in about an hour, even when the laptop is idle. It started after last week\'s Windows update.', daysAgo: 12, comments: [{ by: 'owner', body: 'We are looking at the battery health report for your device.' }, { by: 'requester', body: 'Thank you. Let me know if you need the device brought in.' }], notes: ['Battery report shows 61% design capacity. Replacement likely.'] },
  { requester: 'sarah.johnson', owner: 'priya.nair', category: 'Network', system: 'VPN', requested: 'HIGH', it: 'HIGH', status: 'OPEN', summary: 'Cannot connect to VPN from home', description: 'The VPN client shows "authentication failed" since this morning. Other campus systems work.', daysAgo: 11, comments: [{ by: 'owner', body: 'Could you confirm the exact error text and your client version?' }], notes: ['Three other users reported the same VPN error today. Possible gateway certificate issue.'] },
  { requester: 'david.lee', owner: 'tom.walker', category: 'Software', system: 'Email', requested: 'MEDIUM', it: 'MEDIUM', status: 'IN_PROGRESS', summary: 'Email not syncing on mobile', description: 'New messages only appear on my phone after I open the app manually.', daysAgo: 10, comments: [], notes: [] },
  { requester: 'michael.brown', owner: 'alex.rivera', category: 'Account and Access', system: 'LEB2 App', requested: 'LOW', it: 'LOW', status: 'RESOLVED', summary: 'New employee setup request', description: 'Please set up LEB2 access for a new teaching assistant starting Monday.', daysAgo: 10, comments: [{ by: 'owner', body: 'Account created. The TA will get a temporary password from the Administrator.' }], notes: ['Access request approved by the department head over email.'] },
  { requester: 'jennifer.anderson', owner: null, category: 'Hardware', system: 'Printer', requested: 'LOW', it: 'LOW', status: 'NEW', summary: 'Printer keeps showing offline', description: 'The second-floor printer shows offline on every computer in the office.', daysAgo: 9, comments: [], notes: [] },
  { requester: 'sarah.johnson', owner: 'priya.nair', category: 'Account and Access', system: 'Grade Submission App', requested: 'HIGH', it: 'HIGH', status: 'WAITING_FOR_REQUESTER', summary: 'Request access to grade submission', description: 'I need submit permission for two additional course sections this term.', daysAgo: 9, comments: [{ by: 'owner', body: 'Please send the section codes so we can verify with the registrar.' }], notes: [] },
  { requester: 'david.lee', owner: 'tom.walker', category: 'Software', system: 'Corporate Laptop', requested: 'HIGH', it: 'MEDIUM', status: 'IN_PROGRESS', summary: 'Outlook freezing intermittently', description: 'Outlook stops responding for about 30 seconds several times a day.', daysAgo: 8, comments: [{ by: 'owner', body: 'Lowered to Medium since a workaround exists (Safe Mode). Working on the root cause.' }], notes: ['Add-in conflict suspected. Disabled the PDF add-in for testing.'] },
  { requester: 'michael.brown', owner: 'alex.rivera', category: 'Hardware', system: 'Corporate Laptop', requested: 'MEDIUM', it: 'MEDIUM', status: 'CLOSED', summary: 'Docking station not detected', description: 'The laptop does not detect the docking station after waking from sleep.', daysAgo: 8, comments: [{ by: 'owner', body: 'Firmware updated on the dock. Closing this ticket.' }], notes: [] },
  { requester: 'jennifer.anderson', owner: null, category: 'Software', system: 'LEB2 App', requested: 'LOW', it: 'LOW', status: 'NEW', summary: 'Software installation request', description: 'Please install the latest statistics package on my office computer.', daysAgo: 7, comments: [], notes: [] },
  { requester: 'sarah.johnson', owner: 'tom.walker', category: 'Hardware', system: 'Corporate Laptop', requested: 'MEDIUM', it: 'LOW', status: 'CANCELLED', summary: 'Multi-monitor not detected', description: 'My second monitor is not detected by the laptop.', daysAgo: 7, comments: [{ by: 'requester', body: 'It was a loose cable. Please cancel this ticket.' }], notes: [] },
  { requester: 'david.lee', owner: null, category: 'Network', system: 'Campus Wi-Fi', requested: 'HIGH', it: 'HIGH', status: 'NEW', summary: 'Campus Wi-Fi drops in the library', description: 'The connection drops every few minutes on the third floor of the library.', daysAgo: 6, comments: [], notes: [] },
  { requester: 'michael.brown', owner: 'priya.nair', category: 'Account and Access', system: 'Email', requested: 'MEDIUM', it: 'MEDIUM', status: 'OPEN', summary: 'Shared mailbox permission needed', description: 'I need send-as permission on the department shared mailbox.', daysAgo: 6, comments: [], notes: ['Waiting for the mailbox owner to approve.'] },
  { requester: 'jennifer.anderson', owner: 'alex.rivera', category: 'Software', system: 'Grade Submission App', requested: 'HIGH', it: 'HIGH', status: 'REOPENED', summary: 'Grade export fails for large sections', description: 'Exporting grades for sections above 150 students ends with a blank file.', daysAgo: 5, comments: [{ by: 'requester', body: 'The problem is back after the last update.' }], notes: ['Reopened by the Requester. Check the export timeout setting.'] },
  { requester: 'sarah.johnson', owner: null, category: 'Hardware', system: 'Printer', requested: 'LOW', it: 'LOW', status: 'NEW', summary: 'Toner replacement for room 305', description: 'The printer in room 305 prints faded pages.', daysAgo: 5, comments: [], notes: [] },
  { requester: 'david.lee', owner: 'tom.walker', category: 'Account and Access', system: 'VPN', requested: 'LOW', it: 'LOW', status: 'RESOLVED', summary: 'VPN token expired', description: 'My VPN token expired and I cannot renew it myself.', daysAgo: 4, comments: [{ by: 'owner', body: 'A new token was issued. Please try again.' }], notes: [] },
  { requester: 'michael.brown', owner: null, category: 'Network', system: 'Campus Wi-Fi', requested: 'MEDIUM', it: 'MEDIUM', status: 'NEW', summary: 'Guest Wi-Fi password request', description: 'Visiting lecturers need guest Wi-Fi access next Tuesday.', daysAgo: 4, comments: [], notes: [] },
  { requester: 'jennifer.anderson', owner: 'priya.nair', category: 'Software', system: 'Email', requested: 'LOW', it: 'LOW', status: 'IN_PROGRESS', summary: 'Calendar invites arrive twice', description: 'Every meeting invite shows up twice in my calendar.', daysAgo: 3, comments: [], notes: ['Duplicate rule found in the mail flow. Removing it.'] },
  { requester: 'sarah.johnson', owner: 'alex.rivera', category: 'Hardware', system: 'Corporate Laptop', requested: 'HIGH', it: 'HIGH', status: 'OPEN', summary: 'Laptop screen flickers', description: 'The screen flickers when the brightness is below 50%.', daysAgo: 3, comments: [{ by: 'owner', body: 'Please bring the laptop to the IT desk so we can test the display.' }], notes: [] },
  { requester: 'david.lee', owner: null, category: 'Account and Access', system: 'LEB2 App', requested: 'MEDIUM', it: 'MEDIUM', status: 'NEW', summary: 'Locked out after password change', description: 'I changed my password and now the LEB2 app rejects the new one.', daysAgo: 2, comments: [], notes: [] },
  { requester: 'michael.brown', owner: 'tom.walker', category: 'Software', system: 'LEB2 App', requested: 'MEDIUM', it: 'HIGH', status: 'IN_PROGRESS', summary: 'LEB2 app very slow at noon', description: 'Pages take more than 20 seconds to load between 12:00 and 13:00.', daysAgo: 2, comments: [{ by: 'owner', body: 'Raised to High: several users are affected during the lunch peak.' }], notes: ['Database connections spike at noon. Escalating to the platform team.'] },
  { requester: 'jennifer.anderson', owner: null, category: 'Network', system: 'VPN', requested: 'LOW', it: 'LOW', status: 'NEW', summary: 'VPN split tunnel question', description: 'Can the VPN be set so only campus traffic goes through it?', daysAgo: 1, comments: [], notes: [] },
  { requester: 'sarah.johnson', owner: 'priya.nair', category: 'Account and Access', system: 'Email', requested: 'LOW', it: 'LOW', status: 'WAITING_FOR_REQUESTER', summary: 'Rename email display name', description: 'My display name still shows my maiden name.', daysAgo: 1, comments: [{ by: 'owner', body: 'Please confirm the exact spelling you want to use.' }], notes: [] },
  { requester: 'david.lee', owner: 'alex.rivera', category: 'Hardware', system: 'Printer', requested: 'MEDIUM', it: 'MEDIUM', status: 'OPEN', summary: 'Scanner does not send to email', description: 'The office scanner reports "SMTP error" when sending scans.', daysAgo: 1, comments: [], notes: [] },
  { requester: 'michael.brown', owner: null, category: 'Software', system: 'Corporate Laptop', requested: 'HIGH', it: 'HIGH', status: 'NEW', summary: 'Antivirus blocks a teaching tool', description: 'The antivirus quarantines a lab simulation tool I need for class today.', daysAgo: 0, comments: [], notes: [] },
]

async function main() {
  const users = await prisma.user.findMany()
  const categories = await prisma.category.findMany()
  const systems = await prisma.relatedSystem.findMany()
  const userByLocalPart = (localPart: string) => {
    const user = users.find((candidate) => candidate.email === `${localPart}@toktickit.test`)
    if (!user) throw new Error(`Run prisma:seed first: user ${localPart} not found.`)
    return user
  }

  let created = 0
  for (const demo of DEMO_TICKETS) {
    const exists = await prisma.ticket.findFirst({ where: { summary: demo.summary } })
    if (exists) continue

    const requester = userByLocalPart(demo.requester)
    const owner = demo.owner ? userByLocalPart(demo.owner) : null
    const category = categories.find((item) => item.name === demo.category)
    const system = systems.find((item) => item.name === demo.system)
    if (!category || !system) throw new Error(`Run prisma:seed first: missing category or system for "${demo.summary}".`)

    const createdAt = new Date(Date.now() - demo.daysAgo * DAY_MS - Math.floor(Math.random() * 6) * 3600_000)
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `PENDING-${demo.summary}`,
        requesterId: requester.id,
        ticketOwnerId: owner?.id ?? null,
        categoryId: category.id,
        relatedSystemId: system.id,
        summary: demo.summary,
        description: demo.description,
        requestedPriority: demo.requested,
        itPriority: demo.it,
        currentStatus: demo.status,
        createdAt,
      },
    })
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { ticketNumber: generateTicketNumber(ticket.id, createdAt) },
    })

    for (const [index, comment] of demo.comments.entries()) {
      const author = comment.by === 'requester' ? requester : owner ?? requester
      await prisma.publicComment.create({
        data: { ticketId: ticket.id, authorId: author.id, body: comment.body, createdAt: new Date(createdAt.getTime() + (index + 1) * 3600_000) },
      })
    }
    for (const [index, body] of demo.notes.entries()) {
      await prisma.internalNote.create({
        data: { ticketId: ticket.id, authorId: (owner ?? userByLocalPart('alex.rivera')).id, body, createdAt: new Date(createdAt.getTime() + (index + 2) * 3600_000) },
      })
    }
    created += 1
  }

  console.log(`Demo data: ${created} new ticket(s) created, ${DEMO_TICKETS.length - created} already present.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
