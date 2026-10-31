/** A route parameter that must be a whole number, or null. One rule for every router. */
export function parseId(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) ? parsed : null
}
