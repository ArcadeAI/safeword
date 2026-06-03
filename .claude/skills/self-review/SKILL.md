---
name: self-review
description: Self-review a just-authored workflow artifact (the spec) inline and
  earn its Tier 1 review stamp, so the next step's gate passes. Use after
  authoring spec.md and before writing test-definitions.md, or whenever the
  review gate blocks asking for a spec review. The review is your own inline
  pass — do not spawn a sub-agent.
allowed-tools: '*'
---

# Self-Review

Review the artifact you just authored, then earn its review stamp so the next
step is unblocked. This is **Tier 1** — a cheap, inline floor. You review your
own work; no sub-agent is spawned. The independent check is Tier 2 (the fork
review at each phase exit), not this.

## Earn the stamp

The line below runs the stamp-earning step at render time. It binds a
`review:<scope>` stamp to the active ticket's `spec.md` **at its current
content** and appends it to `.safeword-project/skill-invocations.log`, where the
per-asset gate reads it back. Invoking this skill is what writes the stamp —
hand-editing the log is the gameable floor this tier deliberately accepts.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && CLAUDE_PROJECT_DIR="$PROJECT_DIR" bun "$PROJECT_DIR/.safeword/hooks/write-review-stamp.ts" spec`

**If you see `[skill-invocation-log] FAILED` above, or no `✓` line at all**: STOP.
The stamp was not written and the gate will keep blocking. Most likely the bash
injection was denied or no in_progress ticket was found — report it to the user
and resolve before retrying.

## Review the spec (do this now, with the stamp written)

The stamp records that a review was invoked; the actual scrutiny is yours. Read
the active ticket's `spec.md` and check, against `personas.md` and the ticket's
`scope` / `out_of_scope` frontmatter:

- **Every JTBD resolves to a real persona** and reads as a genuine job (`When
I…, I want…, so I can…`), not a restated feature.
- **Each JTBD carries ≥1 Acceptance Criterion** stating an observable, product-
  level guarantee — not an implementation detail.
- **The ACs cover the ticket's scope** and stop at its `out_of_scope` line — no
  silent scope creep, no orphan capability.
- **Nothing leaks implementation** (file names, function names, libraries) into
  spec-level prose.

If the review surfaces a fix, **edit `spec.md` and re-invoke `/review`** — the
content-bound stamp goes stale on any edit, so the gate correctly re-blocks
until the corrected spec is re-reviewed. That is the point: a review that
changes the artifact must be re-earned.

## Skip valve

If the artifact is genuinely trivial to review (boilerplate, a docs-only
change), log a skip with a reason instead of a review — it clears the same gate
and records why:

```bash
bun .safeword/hooks/write-review-stamp.ts spec "<why this spec needs no review>"
```

An empty reason does not clear the gate.
