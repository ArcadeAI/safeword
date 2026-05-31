---
id: 0QTXMB
slug: effort-frontmatter-skills
type: task
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.536Z
last_modified: 2026-05-31T21:05:09.536Z
---

# Per-skill effort frontmatter + $CLAUDE_EFFORT gate scaling

**Goal:** Tune reasoning effort per skill (high for hard reasoning, low for mechanical work) and let hooks read effort to scale gate strictness.

**Why:** CC now exposes effort as skill/agent frontmatter and to hooks/bash. Safeword can spend reasoning where it pays off (debug, decisions, review) and save it where it doesn't (lint), and gates could adapt to the session's effort level.

## Findings

- CC `2.1.120`: "Skills reference `${CLAUDE_EFFORT}`."
- CC `2.1.133`: "Hooks receive `effort.level` and `$CLAUDE_EFFORT`; Bash commands read `$CLAUDE_EFFORT`."
- CC `2.1.149`: status bar respects skill/agent `effort:` frontmatter; `/usage` per-category.
- CC `2.1.154`: Opus 4.8 defaults to high effort; `/effort xhigh` available.

## Evidence in safeword

- Grep confirms no skill sets `effort:` and no hook reads `$CLAUDE_EFFORT` today.
- Effort mapping (proposed):
  - High: `debug`, `figure-it-out`, `quality-review`, `audit`, `tdd-review`.
  - Default: `bdd`, `refactor`, `testing`, `verify`, `ticket-system`, `versioning`.
  - Low: `lint`, `cleanup-zombies` (mechanical).

## Approach

- Add `effort:` to skill frontmatter per the mapping; confirm valid values and behavior on Opus 4.8 (already high by default — does per-skill `effort:` still differentiate?) against current CC docs.
- Optional, smaller: have a gate hook read `$CLAUDE_EFFORT` to scale strictness (e.g., be terser in low-effort sessions). Keep this minimal — only if it earns its complexity.

## Done when

- Skills carry an `effort:` value matching the mapping (or a reasoned subset), verified against current CC docs.
- Decision recorded on whether hook-side `$CLAUDE_EFFORT` scaling is worth adding (yes → implemented; no → noted why).
- Templates + dogfood copies in parity.

## Out of scope

- Reworking which model runs (effort ≠ model selection).

## Work Log

- 2026-05-31T21:05:09.536Z Started: Created ticket 0QTXMB
- 2026-05-31 Confirmed no skill sets effort and no hook reads $CLAUDE_EFFORT.
