---
id: 9V9DVF
slug: fork-context-heavy-skills
type: task
phase: intake
status: in_progress
epic: cc-changelog-alignment
relates_to: 8R54HV
created: 2026-05-31T21:05:09.535Z
last_modified: 2026-05-31T21:05:09.535Z
---

# Run heavy skills in forked context (context: fork)

**Goal:** Keep token-heavy skills from bloating the main conversation by running them in a forked context.

**Why:** Skills like `audit`, `deep-research`, and `quality-review` fan out across many files and pull in a lot of material. CC now supports forked-context skills so that cost stays out of the main window — the context-window analogue of safeword's existing blast-radius (LOC) discipline.

## Findings

- CC `2.1.117`: `CLAUDE_CODE_FORK_SUBAGENT=1` enables forked subagents (external).
- CC `2.1.126`: "Fixed deferred tools unavailable to `context: fork` subagents."
- CC `2.1.145`: "Fixed infinite loop with `context: fork` skills" — feature is maturing/stabilized.

## Evidence in safeword

- Grep confirms no skill uses `context: fork` today.
- Candidates (read-heavy, output is a summary/verdict, not interleaved edits):
  - `audit` — whole-codebase sweep.
  - `deep-research` — multi-source web fan-out.
  - `quality-review` — deep review with web research.
  - Possibly `figure-it-out` (research-heavy decision).

## Approach

- Add `context: fork` to the candidate skills' frontmatter; confirm exact key/semantics and any tool-availability caveats against current CC docs (note the 2.1.126 deferred-tools fix — verify our skills don't rely on deferred tools inside the fork).
- Verify the skill's final output (the verdict/report) still returns cleanly to the main thread.
- Skills that must interleave edits with the main flow (bdd, refactor, debug) stay non-forked.

## Done when

- Heavy read-only skills run forked; their summary returns to the main thread intact.
- No regression from forked tool availability (deferred tools, MCP) verified.
- Key/semantics confirmed against current CC docs; templates + dogfood copies in parity.

## Out of scope

- Skills that edit incrementally in the main flow.

## Work Log

- 2026-05-31T21:05:09.535Z Started: Created ticket 9V9DVF
- 2026-05-31 Confirmed no skill uses context: fork; identified audit/deep-research/quality-review as candidates.
