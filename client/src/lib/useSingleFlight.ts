import { useRef } from 'react'

/**
 * A synchronous "one request at a time" guard. Setting state to disable a
 * button is asynchronous, so two submits in the same tick (a double click, Enter
 * plus click) can both pass. A ref flips immediately.
 *
 *   if (!flight.begin()) return
 *   try { await save() } finally { flight.end() }
 */
export function useSingleFlight() {
  const inFlight = useRef(false)
  return {
    begin(): boolean {
      if (inFlight.current) return false
      inFlight.current = true
      return true
    },
    end(): void {
      inFlight.current = false
    },
  }
}
