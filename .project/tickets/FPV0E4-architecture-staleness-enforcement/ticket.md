---
id: FPV0E4
slug: architecture-staleness-enforcement
type: feature
phase: intake
status: in_progress
created: 2026-06-22T23:37:04.081Z
last_modified: 2026-06-22T23:37:04.081Z
---

# Architecture doc staleness enforcement (Slice 2 — auto-fix on commit, fail CI, opt-out)

**Goal:** Make the generated architecture doc's freshness _enforced_, not just
suggested — on by default, satisfied automatically at commit time (regenerate +
stage), with CI as the hard backstop. This is the "block later on the same
thing" half of inform-early/block-later.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Why

Slice 1 (QD5DTT) and the rename (CTAZT5) only _warn_: the SessionStart self-heal
refreshes structural facts and flags stale prose, but nothing stops a commit
from landing with a stale `architecture.generated.md`. Warnings get blindness;
blindness becomes drift; drift misleads the agents the doc exists to inform. The
inform-early/block-later contract needs its block-later half.

## Scope (Slice 2, single-repo)

1. **Staleness check** — compare the live shape-fingerprint (and unresolved
   reconcile markers: `stale`, `orphaned`, `placeholder`) against the doc's
   recorded state. Tiered: act on real structural drift, never on noise.
2. **Commit-time auto-fix** — on a stale doc at commit, regenerate and stage it
   (same deterministic `selfHeal` path), so the commit lands fresh instead of
   being rejected. No human in the loop for the common case.
3. **Hard-fail only when a human is required** — the narrow set the auto-fix
   can't satisfy (e.g. a foreign/unowned doc → `skipped`, or a placeholder whose
   prose a human must write). Fail with a clear, actionable message.
4. **CI backstop** — a hard, non-auto-fixing check in CI that fails the build on
   any stale/unresolved state. The guarantee that local opt-out or a bypassed
   hook can't let drift reach `main`.
5. **Default-on with opt-out** — enforcement is enabled by default; a single
   config switch disables it. Opt-out (not opt-in) because freshness is the
   point of the feature.
6. **noop-aware** — a monorepo root (no top-level `src/`, empty skeleton, no doc
   written) is `noop`, never a failure.

## Out of scope

- Monorepo / multi-package architecture (Slice 3).
- LLM prose generation — Slice 2 stays deterministic & LLM-free.
- Touching `paths.architecture` (the hand-curated ADR/decision record);
  enforcement governs only `architecture.generated.md`.

## Key decisions (converged with user)

1. **Opt-out / default-on**, not opt-in. Freshness is the feature.
2. **Commit = auto-fix-and-stage**, not hard-fail. Regenerate + `git add` the
   generated doc so the commit lands fresh.
3. **CI = hard-fail backstop.** CI never auto-fixes; it fails on drift.
4. **Tiered + noop-aware.** Only structural change acts; monorepo-root noop and
   unchanged docs never fire.

## Open questions for /figure-it-out

- **"Stale enough to act" threshold** — exactly which `selfHeal` actions /
  reconcile statuses trigger auto-fix vs. hard-fail vs. pass. (`healed`,
  `regenerated`, `created` → auto-fix+stage? `skipped` → fail? `unchanged`,
  `noop` → pass? unresolved `placeholder` prose → fail-for-human?)
- **What counts as "human required"** — the precise hard-fail set and its
  message. Foreign doc (`skipped`) is the clear case; are there others?
- **Config surface** — key name and shape alongside the existing
  `architectureReviewGate` (note: that gate is a dev-workflow design-review gate,
  _not_ doc-freshness — naming must not conflate them). Likely
  `architectureDocEnforcement` / `architecture.enforce` or similar.
- **Wiring** — which local hook carries the auto-fix (pre-commit vs. the
  existing stop hook), and how CI invokes the hard check (a `safeword`
  subcommand / flag, e.g. `safeword architecture --check`).
- **Auto-fix safety** — must not clobber a user's staged changes to the doc, and
  must not fight the SessionStart self-heal (idempotent, same render path).

## Work Log

- 2026-06-22T23:37:04.081Z Started: Created ticket FPV0E4.
- 2026-06-22T23:40:00Z Intake written. Slice 2 = enforcement, converged design:
  opt-out/default-on, auto-fix-and-stage at commit, CI hard-fail backstop,
  tiered, noop-aware. Created after #316 (Slice 1) + #331 (rename) merged.
  Next: /figure-it-out on the "stale enough to act" threshold + config surface,
  then BDD.
