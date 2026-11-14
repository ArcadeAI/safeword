# Release and Recovery Decision Guide

Use during Implementation Planning when a change can disrupt existing users,
stored data, dependent services, background work, or a live rollout. Risk
determines depth: a reversible local change may need a sentence; a migration
or shared contract change needs an explicit transition and recovery policy.

## Decide the transition before listing steps

Describe the current and proposed states, then name the boundary where users
or consumers may see each. Decide the relevant questions:

- Which old and new versions must coexist? What reads, writes, messages, or
  clients remain valid during that overlap?
- Who or what is allowed to change state, and what happens under concurrent
  changes, duplicate work, a crash, or a partial dependency failure?
- What is the smallest useful exposure before broad release? What evidence
  permits expansion, pauses it, or triggers rollback?
- What can be reversed? If data or contracts cannot be rolled back safely,
  what forward recovery or compatibility window is required?
- Who owns the decision to pause, reverse, or repair, and what must remain
  visible to that owner while the change is underway?

Put the chosen compatibility, cutover, failure, rollout, and recovery policies
in `impl-plan.md` with their reasons and consequences. An answer such as
"deploy gradually" is incomplete until it names what is observed and what
happens when that observation is bad. A feature flag is a mechanism, not a
rollback policy if durable writes or outside consumers have already changed.

Put ordered deployments, commands, flag percentages, dashboard links, named
operators, and evidence collection in the Execution Plan. Use the data
architecture guide for schema, backfill, retention, and source-of-truth
decisions. Use the measurement guide when a rollout signal must represent a
specific promised outcome.

**Example:** A new writer produces a field that old readers do not understand.
The plan decides whether readers are upgraded first, how long mixed versions
coexist, and whether reversing the writer leaves unreadable data. The Execution
Plan orders the releases and records the exact checks.

## Sources and fit

- [Google SRE Workbook: Canarying Releases](https://sre.google/workbook/canarying-releases/)
  explains partial exposure, comparison, and rollback as ways to reduce the
  cost of discovering defects in production. A canary is one option, not a
  requirement for every change.
- [Google SRE: Release Engineering](https://sre.google/sre-book/release-engineering/)
  describes fitting rollout depth to the service's risk profile.
