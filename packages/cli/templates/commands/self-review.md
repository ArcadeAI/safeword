---
description: Self-review the spec inline and earn its Tier 1 review stamp (project)
---

# Self-Review

Review the artifact you just authored, then earn its review stamp so the next
step is unblocked. This is Tier 1 — a fast, built-in first pass: you review
your own work, no sub-agent involved. Tier 2 (the phase-exit review) is the
independent check; that happens separately.

## Earn the stamp

The line below binds a `review:<scope>` stamp to the active ticket's `spec.md`
at its **current content** and appends it to the skill-invocation-log, where the
per-asset gate reads it back.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && CLAUDE_PROJECT_DIR="$PROJECT_DIR" bun "$PROJECT_DIR/.safeword/hooks/write-review-stamp.ts" spec`

If no `[skill-invocation-log] ... ✓` line appears above, run this fallback before stopping:

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
CLAUDE_PROJECT_DIR="$PROJECT_DIR" bun "$PROJECT_DIR/.safeword/hooks/write-review-stamp.ts" spec
```

The stamp is tied to the spec's exact current content — edit the spec, and the stamp goes stale automatically.

If the automatic line and fallback both print `[skill-invocation-log] FAILED`,
or still do not print `✓`, the stamp was not written and the gate will keep
blocking — resolve before retrying.

## Review the spec

At review time, run `bun .safeword/hooks/resolve-project-knowledge.ts` and read
the current configured principles, personas, and surfaces it returns. Do not
rely on paths or content remembered from intake.

Read the active ticket's `spec.md` and check, against `personas.md` and the
ticket's `scope` / `out_of_scope`: every JTBD resolves to a real persona and
reads as a genuine job; each JTBD has ≥1 observable, product-level numbered Rule
(or legacy Acceptance Criterion); the criteria cover scope and stop at
`out_of_scope`; no implementation detail leaks into spec prose. If the review surfaces a fix, edit `spec.md` and
re-run — the content-bound stamp goes stale on any edit, so the gate correctly
re-blocks until the corrected spec is re-reviewed.

## Skip valve

Trivial or docs-only? Log a skip with a reason instead — it clears the same gate
and records why. To skip, pass `--skip "<reason>"` as one quoted argument. A
reason is required — an empty one won't clear the gate:

```bash
bun .safeword/hooks/write-review-stamp.ts spec --skip "<why this spec needs no review>"
```
