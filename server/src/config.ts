export type AppConfig = { port: number; databaseUrl: string; appOrigins: string[] }

/**
 * Fail fast at startup with one message that lists every problem, instead of
 * a confusing failure on the first request. Defaults match the rest of the app
 * (PORT 3000, APP_ORIGIN http://localhost:5173, see auth/origin-check.ts).
 */
export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const problems: string[] = []

  const databaseUrl = env.DATABASE_URL?.trim() ?? ''
  if (!databaseUrl) problems.push('DATABASE_URL is required.')

  const port = env.PORT === undefined || env.PORT === '' ? 3000 : Number(env.PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push('PORT must be a whole number from 1 to 65535.')

  const appOrigins = (env.APP_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean)
  for (const origin of appOrigins) {
    try {
      new URL(origin)
    } catch {
      problems.push(`APP_ORIGIN contains "${origin}", which is not a URL.`)
    }
  }

  if (problems.length > 0) throw new Error(`Invalid configuration:\n- ${problems.join('\n- ')}`)
  return { port, databaseUrl, appOrigins }
}
