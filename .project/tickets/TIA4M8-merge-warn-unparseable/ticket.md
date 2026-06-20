---
id: TIA4M8
slug: merge-warn-unparseable
type: task
phase: done
status: done
created: 2026-06-20T07:48:00.000Z
last_modified: 2026-06-20T11:55:00.000Z
---

> **Follow-up hardening (2026-06-20, from quality-review):** `readJson` performed
> its `readFileSafe` read _outside_ its `try`, so a directory at a config path
> (`EISDIR`) or an unreadable file (`EACCES`) threw uncaught and crashed reconcile
> (empirically reproduced). `/figure-it-out` chose **option A** — wrap the read
> inside `readJson`'s existing `try/catch` — over hardening `readFileSafe` (25-caller
> blast radius, masks real read errors) or an `isDirectory` guard in
> `executeJsonMerge` (partial: misses `EACCES`, leaves the other 8 `readJson`
> callers crashable). All 9 `readJson` callers already handle `undefined`. Now a
> directory/unreadable merge target degrades to the same actionable warning (message
> generalized beyond "JSONC comments"). Added `tests/utils/fs.test.ts` (valid /
> missing / JSONC-comment / directory-EISDIR) and made the valid-target reconcile
> test assert per-file rather than global-empty warnings.

> **Done (2026-06-20):** Added a `warnings: string[]` channel to `ReconcileResult`,
> threaded through `executePlan` → `executeJsonMerge`. A merge target that exists
> but fails to parse now pushes one actionable warning (file + cause + the keys
> safeword wanted to add) instead of silently skipping; a genuinely-absent
> `skipIfMissing` target stays silent. `setup`/`upgrade` print the warnings. Tests:
> exists+unparseable → warning, absent → silent, valid → no warning. Full command
> suites (279) + reconcile (58) green.

# Merge engine: warn when a JSON-merge target exists but won't parse

**Goal:** When `safeword setup`/`upgrade` reconciles a `jsonMerge` target that
exists on disk but fails to parse (e.g. a `.markdownlint-cli2.jsonc` with
comments, or a malformed `package.json`), surface an actionable warning instead
of silently skipping the merge. The skip itself stays — fail-safe, no churn — but
it stops being invisible.

**Origin:** Follow-up from issue #262 (markdownlint-cli2 `ignores` merge) and the
`/figure-it-out` decision recorded there. `executeJsonMerge` calls `readJson`
(plain `JSON.parse`), which returns `undefined` on parse failure; combined with
`skipIfMissing`, "file absent" and "file present-but-unparseable" collapse into
one silent no-op. The defect is the silence, and it spans all jsonMerge targets,
not just markdownlint.

## Decision (from #262 figure-it-out)

Chose **Option A — keep the safe no-op, make it loud** over:

- **B (strip-and-rewrite):** destroys the user's JSONC comments on upgrade —
  violates the EYRK34 no-churn ethos. Rejected.
- **C (comment-preserving surgical edit via jsonc-parser `modify`/`applyEdits`):**
  the elegant ideal, but a second, text-based write path used by only one merge
  family makes the engine inconsistent (the single `writeJson` reformatting path
  is shared by ~156 merge targets) and is speculative without real-world signal.
  Deferred, gated on evidence that commented configs are common in the wild.

## Scope

- Thread a `warnings: string[]` channel through `executePlan` → `executeJsonMerge`
  and expose it on `ReconcileResult` (backward-compatible, optional/empty default).
- In `executeJsonMerge`: when the target **exists** but `readJson` returns
  `undefined`, push one actionable warning (name the file, name the likely cause —
  invalid JSON / JSONC comments — and the keys safeword wanted to add). Keep the
  early-return skip.
- Print collected warnings from the `setup`/`upgrade` commands.

## Out of scope

- Comment-preserving JSONC editing (Option C) — separate, evidence-gated.
- Changing any merge OUTCOME — this only adds observability.

## Done when

- A jsonMerge target that exists but doesn't parse yields a `ReconcileResult`
  warning naming the file and cause; an absent target stays silent (no warning).
- A valid target merges exactly as before (no behavior change).
- `setup`/`upgrade` print the warnings.
- Unit tests cover: exists+unparseable → warning; absent → no warning; valid →
  no warning + correct merge.
- Full suite + lint + typecheck green.
