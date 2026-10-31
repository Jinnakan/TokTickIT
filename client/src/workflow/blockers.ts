export type Blocker =
  | { code: 'NO_COMPLETED_ACTION' }
  | { code: 'ACTIONS_STILL_OPEN'; count: number }
  | { code: 'FOLLOW_UP_OPEN'; count: number }

/** Plain-text line for one blocker (ui-spec §5). */
export function blockerLine(blocker: Blocker): string {
  switch (blocker.code) {
    case 'NO_COMPLETED_ACTION':
      return 'Add a completed action'
    case 'ACTIONS_STILL_OPEN':
      return blocker.count === 1
        ? '1 action is still planned or in progress'
        : `${blocker.count} actions are still planned or in progress`
    case 'FOLLOW_UP_OPEN':
      return blocker.count === 1 ? '1 follow-up is still open' : `${blocker.count} follow-ups are still open`
  }
}
