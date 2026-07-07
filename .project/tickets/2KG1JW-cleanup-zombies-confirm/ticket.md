---
id: 2KG1JW
slug: cleanup-zombies-confirm
type: task
phase: intake
status: in_progress
created: 2026-07-07T17:59:01.912Z
last_modified: 2026-07-07T17:59:01.912Z
external_issue: https://github.com/ArcadeAI/safeword/issues/773
scope:
  - cleanup-zombies.sh previews by default (bare invocation = today's --dry-run) and only kills with an explicit --yes/-y
  - the preview summary names the confirm flag; --dry-run stays accepted as an explicit alias (back-compat)
  - script tests pin default-preview, --yes kill-mode messaging, and --dry-run back-compat
  - pre-tool-quality.ts deny message + the three prose sites (skill, command, guide) drop the "run --dry-run first" ritual — the script enforces it now
out_of_scope:
  - changing kill semantics (kill -9, port+1000 convention, pattern scoping) — the rung is only who decides, not what is killed
  - the process-kill-guard predicate (rung 1, shipped)
  - an interactive TTY prompt (agents run non-interactive; a flag is the auditable consent artifact)
done_when:
  - bare invocation in a project with zombies reports what would be killed and exits without killing
  - --yes kills exactly what the preview showed; --dry-run still previews
  - prose sites describe one-step usage with the flag instead of the two-step ritual
  - repo tests/lint green; parity synced
---

# cleanup-zombies.sh kills only with an explicit confirm flag

**Goal:** Bare invocation previews (deny-by-default); killing requires --yes — graduating the skill's "run --dry-run first, then re-run" prose ritual into the script itself

**Why:** #773 graduate-then-trim, rung 4: the two-step safety ritual lives only in SKILL.md/command prose, so an agent that skips the guide goes straight to kill -9; inverting the default makes the safe path the only unmarked path

## Work Log

- 2026-07-07T17:59:01.912Z Started: Created ticket 2KG1JW
- Scouted: no code callers of cleanup-zombies.sh (grep: prose sites + pre-tool-quality deny message only); existing tests/scripts/cleanup-zombies.test.ts runs every case with --dry-run so the inversion is low-blast-radius; #938 (boundary gate) touches neither the script nor its prose
