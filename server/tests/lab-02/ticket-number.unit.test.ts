import { describe, expect, it } from 'vitest'
import { generateTicketNumber } from '../../src/tickets.js'

describe('generateTicketNumber (unit, no database)', () => {
  it('returns the required TKT-YYYY-NNNNNN format', () => {
    expect(generateTicketNumber(7, new Date('2026-03-15T00:00:00Z'))).toBe('TKT-2026-000007')
  })

  it('pads the id to 6 digits', () => {
    expect(generateTicketNumber(1, new Date('2026-01-01T00:00:00Z'))).toBe('TKT-2026-000001')
  })

  it('does not truncate an id already 6 or more digits long', () => {
    expect(generateTicketNumber(123456, new Date('2026-01-01T00:00:00Z'))).toBe('TKT-2026-123456')
    expect(generateTicketNumber(1234567, new Date('2026-01-01T00:00:00Z'))).toBe('TKT-2026-1234567')
  })

  it('uses the UTC year of createdAt, not the local year', () => {
    expect(generateTicketNumber(1, new Date('2025-12-31T23:30:00Z'))).toBe('TKT-2025-000001')
  })
})
