# 0003. One navigation reducer and list snapshots, not a router (yet)

## Context
A dashboard card must open a filtered list, a dashboard row must open a Ticket, and
Back must return to where the user came from with the same filters.

## Decision
`nav/app-navigation.ts` holds the place (screen plus filters), the open Ticket and a
refresh counter. List screens unmount while a Ticket is open and restore their
filters, page and search from a snapshot kept by `App` when the user comes back.

## Consequences
- No new dependency and no URL design now.
- Hidden list rows are not left in the page, so assistive technology and end-to-end
  locators only see the open Ticket.
- Pages cannot be bookmarked or opened in a new tab. A router would replace the
  reducer; the screens already take their starting filters as props.

## Alternatives considered
- Keep lists mounted but hidden: simpler, but the hidden rows confused locators.
- Add a router now: more than this sprint needed.
