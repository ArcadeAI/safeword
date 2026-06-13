---
id: XXX66G
slug: disallowed-tools-readonly-skills
type: task
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.535Z
last_modified: 2026-05-31T21:05:09.535Z
---

# Lock read-only review skills with disallowed-tools

**Goal:** Prevent review/analysis skills from mutating code by declaring `disallowed-tools` for Edit/Write in their frontmatter.

**Why:** Every safeword skill currently ships `allowed-tools: '*'`. A review pass (audit, quality-review) that's supposed to only read can accidentally edit. CC `2.1.152` added `disallowed-tools` so we can make read-only skills structurally read-only.

## Finding (CC 2.1.152)

> Skills and slash commands can set `disallowed-tools` in frontmatter

## Evidence in safeword

- All skills use `allowed-tools: '*'` — e.g. `.claude/skills/bdd/SKILL.md:8`. Grep confirms no skill uses `disallowed-tools` today.
- Skills that should be read-only by contract:
  - `quality-review`, `audit`, `tdd-review`, `verify` — review/inspect, should not edit.
  - `testing`, `elicit`, `brainstorm`, `figure-it-out` — knowledge/elicitation/decision, should not edit.
  - (Leave write-capable: `bdd`, `refactor`, `lint`, `debug`, `cleanup-zombies`, `ticket-system`, `versioning`.)

## Approach

- Add `disallowed-tools` (Edit, Write, MultiEdit, NotebookEdit) to the read-only skills' frontmatter.
- Confirm exact frontmatter key + precedence vs `allowed-tools` against current CC docs (do they combine, or does one win?).
- Edit the source skills (the `.claude/skills/*` here are the dogfood copy; confirm the canonical template location the CLI installs from and change there too — parity-check should catch drift).

## Done when

- Read-only skills declare `disallowed-tools` covering all edit tools.
- Key + precedence verified against current CC docs.
- Source-of-truth templates and dogfood copies in parity (run parity-check).

## Out of scope

- Skills that legitimately write (bdd, refactor, lint, debug).

## Work Log

- 2026-05-31T21:05:09.535Z Started: Created ticket XXX66G
- 2026-05-31 Confirmed all skills are `allowed-tools: '*'`; none use disallowed-tools.
