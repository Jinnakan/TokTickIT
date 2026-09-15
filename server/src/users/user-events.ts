import { EventEmitter } from 'node:events'

export const USER_DEACTIVATED = 'userDeactivated'

/**
 * Observer: UserService fires this event and moves on -- it never imports
 * or knows about SessionInvalidationListener (specification.md §9). A
 * plain `emitter.emit()` doesn't let a caller await async listeners, but
 * BR-L3-18 requires the session wipe to have actually happened before the
 * deactivate request responds. `emitAndWait` below invokes every
 * registered listener and awaits them all, without the emitter or its
 * listeners needing to know about each other -- the decoupling Observer
 * is for is preserved; only the "did everyone finish" concern is added.
 */
export const userEvents = new EventEmitter()

export async function emitUserDeactivated(userId: number): Promise<void> {
  const listeners = userEvents.listeners(USER_DEACTIVATED) as Array<(userId: number) => Promise<void> | void>
  await Promise.all(listeners.map((listener) => listener(userId)))
}
