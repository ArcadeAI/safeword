---
id: SBRA2R
slug: document-phase-skips-convention
type: task
phase: done
status: done
depends_on: [0KYEBN]
created: 2026-07-03T16:47:02.634Z
last_modified: 2026-07-03T16:47:02.634Z
---

# Document the phase-provenance gate + phase_skips convention

**Goal:** Make the 0KYEBN phase-provenance gate (#644 G2) and its `phase_skips` frontmatter convention discoverable outside the gate's denial messages. Three doc edits:

1. **`phase_skips` convention** — a glossary entry and a line in the ticket-system skill's frontmatter-values list (template + dogfood copies). Convention: an indented block sequence under `phase_skips:`, `- <phase>: <reason>` per skipped phase, non-empty reason; a block sequence (not flow-style `[...]`, which the minimal parser comma-splits, corrupting comma-bearing reasons); the `-` must be indented.
2. **Glossary "Gate" entry** — its enumeration (phase / LOC / done / AC gates) is now missing the **phase-provenance gate** (feature tickets born at intake, advance one canonical step at a time, deviations need `phase_skips`). Add it so the gate list is complete.

**Why:** 0KYEBN's whole-ticket quality review + the PR #693 doc-impact pass flagged that both the gate and its new frontmatter convention are currently taught only by denial text — fine for enforcement, poor for discoverability.

**Out of scope:** README / `workflow.mdx` "three hard gates" narrative — the phase-provenance gate is an integrity guard, not a user-facing workflow step; leave the curated high-level docs alone unless the maintainer wants it surfaced there.

## Work Log

- 2026-07-03T16:47:02.634Z Started: Created ticket SBRA2R
- 2026-07-03T16:48:00Z Found: Scoped from 0KYEBN quality-review suggestion #1; parked as open (not in_progress) until picked up.
- 2026-07-03T20:50:00Z Found: PR #693 doc-impact pass — broadened scope to also cover the glossary "Gate" enumeration gap (new gate unlisted). Separately noted a PRE-EXISTING, unrelated typo: `ticket-template.md:12` phase enum omits `verify` (`intake | define-behavior | scenario-gate | implement | done`) in both `.safeword/templates/` and `packages/cli/templates/doc-templates/` copies — a one-word fix, but not this gate's regression; fold into this task or a trivial patch, maintainer's call.
- 2026-07-03T20:56:00Z Complete: all three edits done. (1) `phase_skips` added to the ticket-system skill frontmatter list across all 3 mirrors (.claude, .agents, packages/cli/templates); (2) phase-provenance gate added to glossary "Gate" enumeration; (3) `verify` restored to the phase enum in both ticket-template.md copies AND the 3 skill copies (same-line correctness while editing). Parity 210/210, markdownlint clean, no test snapshots the enum string. Docs task — no test-definitions.md/verify.md; closed via status.
