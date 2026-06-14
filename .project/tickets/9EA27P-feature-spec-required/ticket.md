---
id: 9EA27P
slug: feature-spec-required
type: task
phase: done
status: done
created: 2026-06-04T05:17:12.086Z
last_modified: 2026-06-04T06:01:00.000Z
---

# Require spec.md for all features (drop the no-spec grandfather skip)

**Goal:** Make the spec.md requirement fail-closed for features — a `type: feature` ticket with no `spec.md` is denied at `test-definitions.md` creation, instead of silently skipping the JTBD/AC gates.

**Why:** The JTBD and AC gates in `pre-tool-quality.ts` only run `if (existsSync(specFile))`, so a feature with no `spec.md` bypasses them entirely — and nothing downstream re-checks (the stop/done gate only requires scenarios + `verify.md`/audit). A feature can reach `done` with zero personas, jobs, or criteria. Confirmed live: FM5EDA was in exactly that state. The skip was transitional grandfathering for tickets predating the product layer (epic DZ2NM5); the CLI now scaffolds `spec.md` for new features (`ticket-writer.test.ts:44`), so new work is already covered and the exemption is vestigial.

**Decision (from `/figure-it-out`):** no-grandfather over a date cutoff. Uniform fail-closed, no magic-date constant, and legacy compliance is a lazy two-line `## Jobs To Be Done` + `skip: <reason>` paid only when a pre-scaffold feature is next advanced — not a big-bang migration. The cutoff was rejected as strictly more code plus a permanent two-tier system (filed-before-date exempt forever) for a gentleness the existing scaffold makes unnecessary.

## Scope

- In `pre-tool-quality.ts`, at the `test-definitions.md` creation gate: for `type: feature`, **deny when no `spec.md` exists** (require it), instead of skipping the JTBD/AC gates on absence. Tasks and patches are untouched.
- Deny message names the fix and the escape valve: author a Job To Be Done, or write `skip: <reason>` under `## Jobs To Be Done`.
- Mirror the change into `templates/hooks/pre-tool-quality.ts` (byte-identical).
- Invert the two grandfather tests — `jtbd-gate.test.ts` "skips the JTBD gate when no spec.md is present" (~:93) and the AC equivalent (~:132) — to assert denial for features.
- Audit other fixtures that build a feature's `test-definitions.md` without a `spec.md`; give them a `spec.md` (real JTBD/AC or a `skip:`) so they reflect the new rule.

## Out of scope

- Date-cutoff / grandfathering — explicitly rejected (no-grandfather chosen).
- Backfilling `spec.md` into the 54 existing spec-less features — lazy migration: each pays a two-line `skip:` only when next advanced.
- The review-gate enablement (`reviewGate: true`) — separate decision.
- Scaffold-on-creation behavior — already exists for features; not touched here.

## Done when

- Creating `test-definitions.md` for a `type: feature` with no `spec.md` is denied, with a reason naming the missing `spec.md` and the `skip:` valve.
- A feature whose `spec.md` carries real JTBDs/ACs **or** a `skip:` still passes (existing gates unchanged).
- Tasks and patches are unaffected (no `spec.md` required).
- The two grandfather tests are inverted; full suite green; `templates/hooks/` ↔ `.safeword/hooks/` byte-identical; parity green.

## Related

- **Y2HCNJ** (JTBD gate), **31W8M3** (AC gate), **DZ2NM5** (product-layer epic) — this hardens their enforcement to fail-closed.
- Surfaced during the FM5EDA `/bdd` smoke test (2026-06-04); FM5EDA itself is unrelated work — just the vehicle that exposed the gap.

## Work Log

- 2026-06-04T05:17:12.086Z Started: Created ticket 9EA27P
- 2026-06-04T05:17:12.086Z Filed (backlog): No-spec.md feature bypass — JTBD/AC gates skip on `spec.md` absence, nothing re-checks downstream, so a feature reaches `done` with no product layer. Sized **task** (one gate change + template mirror + two test inversions). Approach decided via `/figure-it-out`: **no-grandfather** (require `spec.md` for all features), chosen over a date cutoff. Not started.
- 2026-06-04T06:01:00.000Z Implemented (task, TDD): RED — inverted the two grandfather tests in `jtbd-gate.test.ts` to assert denial; GREEN — made the gate fail-closed in `pre-tool-quality.ts` + byte-identical template mirror (a `type: feature` creating `test-definitions.md` with no `spec.md` is denied, naming the `skip:` valve). Fixed `quality-gates.test.ts` 9.3/9.8/9.11 fixtures (added a `spec.md` skip). Refactor — hoisted `specExists` to dedup the existsSync check. Commits `3d2ef3b0` (fix) + `c8d50181` (refactor).
- 2026-06-04T06:01:00.000Z Verified + done: full suite **2486/2486 green on fresh dist**, build ✓, lint ✓, parity identical, depcruise/jscpd/knip clean for changed files. Baseline diff confirmed **zero net regressions** — the earlier "174 failures" were stale-`dist` phantoms, not environmental. `/verify` + `/audit` invoked; `verify.md` written. Status → done.
