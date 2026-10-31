import 'dotenv/config'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import { prisma } from '../../src/prisma.js'

const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const PRISMA_DIR = path.join(SERVER_DIR, 'prisma')
const LAB4_SUFFIX = 'lab4_actions_history_versioning'

export function migrationNames(): string[] {
  return readdirSync(path.join(PRISMA_DIR, 'migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

export function lab4MigrationName(): string {
  const name = migrationNames().find((candidate) => candidate.endsWith(LAB4_SUFFIX))
  if (!name) throw new Error('Lab 4 migration folder not found.')
  return name
}

/**
 * A throwaway Postgres schema plus a private copy of the schema file and the
 * chosen migrations, so a test can apply migrations in stages, insert legacy
 * rows in between, and never touch the shared test data.
 */
export class MigrationSandbox {
  private constructor(
    readonly schema: string,
    readonly url: string,
    private readonly dir: string,
    readonly client: PrismaClient,
  ) {}

  static async create(): Promise<MigrationSandbox> {
    const base = process.env.DATABASE_URL
    if (!base) throw new Error('DATABASE_URL is not set.')
    const schema = `mig_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)

    const url = new URL(base)
    url.searchParams.set('schema', schema)

    const dir = mkdtempSync(path.join(tmpdir(), 'toktickit-mig-'))
    mkdirSync(path.join(dir, 'prisma', 'migrations'), { recursive: true })
    cpSync(path.join(PRISMA_DIR, 'schema.prisma'), path.join(dir, 'prisma', 'schema.prisma'))
    cpSync(
      path.join(PRISMA_DIR, 'migrations', 'migration_lock.toml'),
      path.join(dir, 'prisma', 'migrations', 'migration_lock.toml'),
    )
    writeFileSync(path.join(dir, '.keep'), '')

    const client = new PrismaClient({ datasources: { db: { url: url.toString() } } })
    return new MigrationSandbox(schema, url.toString(), dir, client)
  }

  /** Copies the named migrations in (existing ones are skipped by Prisma) and runs `migrate deploy`. */
  deploy(names: string[]): void {
    for (const name of names) {
      cpSync(path.join(PRISMA_DIR, 'migrations', name), path.join(this.dir, 'prisma', 'migrations', name), { recursive: true })
    }
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--schema', path.join(this.dir, 'prisma', 'schema.prisma')], {
      cwd: SERVER_DIR,
      env: { ...process.env, DATABASE_URL: this.url },
      stdio: 'pipe',
    })
  }

  async dispose(): Promise<void> {
    await this.client.$disconnect()
    await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${this.schema}" CASCADE`)
    rmSync(this.dir, { recursive: true, force: true })
  }
}
