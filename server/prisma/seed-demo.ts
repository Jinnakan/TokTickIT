import { PrismaClient } from '@prisma/client'
import { runDemoSeed } from './seed-demo-data.js'

const prisma = new PrismaClient()

runDemoSeed(prisma)
  .then((result) => {
    console.log(`Demo data: ${result.created} new ticket(s) created, ${result.present} already present.`)
  })
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
