import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../src/config.js'

const valid = { DATABASE_URL: 'postgresql://u:p@localhost:5434/db?schema=public', PORT: '3000', APP_ORIGIN: 'http://localhost:5173' }

describe('loadConfig', () => {
  it('reads the three settings', () => {
    expect(loadConfig(valid)).toEqual({ port: 3000, databaseUrl: valid.DATABASE_URL, appOrigins: ['http://localhost:5173'] })
  })

  it('defaults the port and the origin like the rest of the app', () => {
    expect(loadConfig({ DATABASE_URL: valid.DATABASE_URL })).toMatchObject({ port: 3000, appOrigins: ['http://localhost:5173'] })
  })

  it('splits several origins and trims them', () => {
    expect(loadConfig({ ...valid, APP_ORIGIN: 'http://a.test, http://b.test' }).appOrigins).toEqual(['http://a.test', 'http://b.test'])
  })

  it('reports every problem in one error, naming the setting', () => {
    expect(() => loadConfig({ PORT: 'abc', APP_ORIGIN: 'not a url' })).toThrowError(/DATABASE_URL[\s\S]*PORT[\s\S]*APP_ORIGIN/)
  })
})
