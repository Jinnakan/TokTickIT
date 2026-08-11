import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  await prisma.$queryRaw`SELECT 1`
  console.log('PostgreSQL connection successful.')
} finally {
  await prisma.$disconnect()
}
