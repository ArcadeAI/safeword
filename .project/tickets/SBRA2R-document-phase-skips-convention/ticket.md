---
id: SBRA2R
slug: document-phase-skips-convention
type: task
phase: intake
status: open
depends_on: [0KYEBN]
created: 2026-07-03T16:47:02.634Z
last_modified: 2026-07-03T16:47:02.634Z
---

# Document the phase_skips frontmatter convention (glossary + ticket-system skill)

**Goal:** Make the `phase_skips` frontmatter convention (introduced by the 0KYEBN phase-provenance gate, #644 G2) discoverable outside denial messages: a glossary entry and a line in the ticket-system skill's frontmatter-values list (template + dogfood copies).

**Why:** 0KYEBN's whole-ticket quality review flagged that a new frontmatter convention is currently taught only by the gate's denial text — fine for enforcement, poor for discoverability. Convention: block-sequence entries `- <phase>: <reason>`, one per skipped phase, non-empty reason; flow-style arrays unsupported (comma-splitting parser).

## Work Log

- 2026-07-03T16:47:02.634Z Started: Created ticket SBRA2R
- 2026-07-03T16:48:00Z Found: Scoped from 0KYEBN quality-review suggestion #1; parked as open (not in_progress) until picked up.
