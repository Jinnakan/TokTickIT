import { blockerLine, type Blocker } from '../../workflow/blockers.js'

/** Plain text, one line per blocker (ui-spec §5). Meaning is in words, never in color alone. */
export function ResolutionBlockers({ blockers }: { blockers: Blocker[] }) {
  if (blockers.length === 0) return null
  return (
    <div className="small mt-2" role="status">
      <div className="fw-semibold">Before this ticket can be resolved:</div>
      <ul className="mb-0 ps-3" aria-label="Why this ticket cannot be resolved yet">
        {blockers.map((blocker) => (
          <li key={blocker.code}>{blockerLine(blocker)}</li>
        ))}
      </ul>
    </div>
  )
}
