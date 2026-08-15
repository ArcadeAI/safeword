---
name: self-review
description: Use when finishing spec.md before writing test-definitions.md, or
  when the review gate asks for a spec review — self-reviews the just-authored
  spec inline and earns its Tier 1 review stamp. Your own inline pass; do not
  spawn a sub-agent.
allowed-tools: '*'
---

# Self-Review

Review the artifact you just authored, then earn its review stamp so the next
step is unblocked. This is **Tier 1** — a fast, built-in first pass: you review
your own work, no sub-agent involved. Tier 2 (the phase-exit review) is the
independent check; that happens separately.

**Stakes set depth.** Tier 2 may never run — review as if your stamp is the last
word before code gets built on this spec, because often it is. Cheap floor means
fast, not shallow.

## Earn the stamp

The line below runs the stamp-earning step at render time. It binds a
`review:<scope>` stamp to the active ticket's `spec.md` **at its current
content** and appends it to `skill-invocations.log` under the project namespace root, where the
per-asset gate reads it back. Invoking this skill is what writes the stamp —
hand-editing the log would let you fake this, a known gap this tier accepts to
stay cheap.

!`PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" && CLAUDE_PROJECT_DIR="$PROJECT_DIR" bun "$PROJECT_DIR/.safeword/hooks/write-review-stamp.ts" spec`

If no `[skill-invocation-log] ... ✓` line appears above, run this fallback before stopping:

```bash
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2> /dev/null || pwd)}"
CLAUDE_PROJECT_DIR="$PROJECT_DIR" bun "$PROJECT_DIR/.safeword/hooks/write-review-stamp.ts" spec
```

The stamp is tied to the spec's exact current content — edit the spec, and the stamp goes stale automatically.

**If the automatic line and fallback both print `[skill-invocation-log] FAILED`, or still do not print `✓`**: STOP.
The stamp was not written and the gate will keep blocking. Most likely the bash
injection was denied, no in_progress ticket was found, or Bun could not run the
installed helper — report it to the user and resolve before retrying.

## Review the spec (do this now, with the stamp written)

The stamp records that a review was invoked; the actual scrutiny is yours. At
review time, run `bun .safeword/hooks/resolve-project-knowledge.ts` and use its
current `principles`, `personas`, and `surfaces` source paths and content—not
labels remembered from intake. These resolve from `paths.principles`,
`paths.personas`, and `paths.surfaces` when configured. Read those sources with the active ticket's
`spec.md` and `scope` / `out_of_scope` frontmatter:

- **Every JTBD resolves to a real persona** and reads as a genuine job (`When
I…, I want…, so I can…`), not a restated feature.
- **Each JTBD carries ≥1 numbered Rule** (or legacy Acceptance Criterion)
  stating an observable, product-level invariant — not an implementation detail.
- **The criteria cover the ticket's scope** and stop at its `out_of_scope` line —
  no silent scope creep, no orphan capability.
- **Every affected surface resolves against the configured surfaces inventory**
  or is explicitly marked spec-local; no invented reusable context and no
  configured surface silently renamed in `spec.md`.
- **Nothing leaks implementation** (file names, function names, libraries) into
  spec-level prose.

If the review surfaces a fix, **edit `spec.md` and re-invoke `/self-review`** — the
content-bound stamp goes stale on any edit, so the gate correctly re-blocks
until the corrected spec is re-reviewed. That is the point: a review that
changes the artifact must be re-earned.

## Skip valve

If the artifact is genuinely trivial to review (boilerplate, a docs-only
change), log a skip with a reason instead of a review — it clears the same gate
and records why:

```bash
bun .safeword/hooks/write-review-stamp.ts spec --skip "<why this spec needs no review>"
```

To skip, pass `--skip "<reason>"` as one quoted argument. A reason is required — an empty one won't clear the gate.
