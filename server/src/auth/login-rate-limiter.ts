// Time-based, auto-clearing lockout keyed by (email, IP) -- BR-L3-08. No
// administrator unlock action exists by design (labsheet §4.2 excludes
// account-unlocking workflows): a locked-out key simply waits out the
// window. In-memory is sufficient for this course's single-process scope.

// Read lazily (not cached at module load) so tests can override the
// threshold/window via process.env without needing a fresh module import.
function maxAttempts(): number {
  return Number(process.env.LOGIN_LOCKOUT_MAX_ATTEMPTS ?? 5)
}

function windowMs(): number {
  return Number(process.env.LOGIN_LOCKOUT_WINDOW_MS ?? 15 * 60 * 1000)
}

interface AttemptRecord {
  count: number
  windowStart: number
}

const attempts = new Map<string, AttemptRecord>()

export function lockoutKey(email: string, ip: string): string {
  return `${email.trim().toLowerCase()}:${ip}`
}

function currentRecord(key: string, now: number): AttemptRecord | undefined {
  const record = attempts.get(key)
  if (!record) return undefined
  if (now - record.windowStart > windowMs()) {
    attempts.delete(key)
    return undefined
  }
  return record
}

export function isLockedOut(key: string): boolean {
  const record = currentRecord(key, Date.now())
  return (record?.count ?? 0) >= maxAttempts()
}

export function recordFailedAttempt(key: string): void {
  const now = Date.now()
  const record = currentRecord(key, now)
  if (!record) {
    attempts.set(key, { count: 1, windowStart: now })
    return
  }
  record.count += 1
}

export function clearAttempts(key: string): void {
  attempts.delete(key)
}
