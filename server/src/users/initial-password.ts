import { randomInt } from 'node:crypto'

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // no I/O, avoids look-alike confusion
const LOWER = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*'
const ALL = UPPER + LOWER + DIGITS + SYMBOLS

function randomChar(charset: string): string {
  return charset[randomInt(charset.length)]
}

/**
 * System-generated initial password (BR-L3-19) -- an Administrator never
 * types or chooses this, closing the "admin picks a weak/reused password"
 * gap. Guarantees at least one of each character class, length 12.
 */
export function generateInitialPassword(): string {
  const length = 12
  const required = [randomChar(UPPER), randomChar(LOWER), randomChar(DIGITS), randomChar(SYMBOLS)]
  const rest = Array.from({ length: length - required.length }, () => randomChar(ALL))
  const chars = [...required, ...rest]

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.join('')
}
