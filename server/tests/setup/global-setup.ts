import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { runSeed } from '../../prisma/seed-data.js'

const SCHEMA = 'test_suite'
const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Runs the server tests in their own schema, rebuilt for every run, so test
 * data never lands in the development database or the demo seed's tables.
 * Workers are started after this runs, so they inherit DATABASE_URL.
 */
export default async function setup() {
  const base = process.env.DATABASE_URL
  if (!base) throw new Error('DATABASE_URL is not set.')

  const url = new URL(base)
  url.searchParams.set('schema', SCHEMA)

  const admin = new PrismaClient({ datasources: { db: { url: base } } })
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`)
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${SCHEMA}"`)
  await admin.$disconnect()

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: SERVER_DIR,
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'pipe',
  })

  const seeded = new PrismaClient({ datasources: { db: { url: url.toString() } } })
  await runSeed(seeded)
  await seeded.$disconnect()

  process.env.DATABASE_URL = url.toString()
}
