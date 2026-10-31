# 0002. Dashboard numbers as one class per metric

## Context
The dashboards are many small numbers and short lists, each with its own query and
a drill-down that must return the same count.

## Decision
Each metric is a class with `compute(context)` (`dashboard/metrics/*`). A service
(`createDashboardService(db)`) runs them together. The service takes the database
client as an argument.

## Consequences
- Adding a metric touches one file and one line in the service.
- Tests can run the service against a scratch schema, which is how the clean-state
  and 300-Ticket performance tests work.
- A card's drill-down is part of the metric, so count and list share one definition.

## Alternatives considered
- One large query per dashboard: harder to test, and a change to one number risks the others.
