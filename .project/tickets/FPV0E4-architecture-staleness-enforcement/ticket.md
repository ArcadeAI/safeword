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

## Resolved design (/figure-it-out, 2026-06-23)

**Tier line = structural fact vs. prose.** Structure is machine-derivable → we
enforce it. Prose is human/LLM work (out of scope) → stays advisory.

**Threshold — map of `selfHeal` action → behavior:**

| Action                               | Local (commit)                    | CI (backstop) |
| ------------------------------------ | --------------------------------- | ------------- |
| `created` / `healed` / `regenerated` | auto-write + `git add` (no block) | **fail**      |
| `unchanged` / `noop`                 | pass                              | pass          |
| `skipped` (foreign doc)              | pass (advisory)                   | pass          |

So CI fails **iff** the action ∈ `{created, healed, regenerated}` — i.e. running
the heal _would_ change the tree. `--check` is `selfHeal` in dry-run: compute
`decideAction`, write nothing, map to an exit code.

**No commit-time hard-fail** — auto-fix-and-stage makes blocking unnecessary
(the "auto-fix not hard-fail" decision). The hard-fail lives **only in CI** and
fires for one reason: the doc is stale and the local hook was bypassed
(`--no-verify`, opted-out locally, or an out-of-band human edit). Human action
to clear it: `safeword architecture`, then commit.

**Foreign doc (`skipped`) is pass-only, never a hard-fail** — a doc with no
`generator:` marker is the user hand-authoring by choice; the Slice-1 contract
is to never touch it and we can't compute freshness for prose we don't own.
**Unresolved prose markers** (`stale`/`orphaned`/`placeholder`) likewise do not
fail — writing prose is out of scope; they remain visible warnings (Slice-1
"incomplete-but-never-silently-wrong" contract).

**Config:** `architectureDocEnforcement` — flat top-level boolean,
**default `true`**; set `false` to opt out. The `Doc` token keeps it distinct
from `architectureReviewGate` (the dev-workflow design-review gate). (Rejected
nesting under `architecture: {}` — visually collides with `paths.architecture`.)

**Wiring:**

- **Local auto-fix:** new dedicated PreToolUse hook
  `pre-tool-architecture-stage.ts` (matcher reuses the existing `Bash` →
  `git commit` pattern from `pre-tool-quality.ts`). Runs `selfHeal`; if the doc
  was mutated, `git add`s it and lets the commit proceed — never blocks. Not
  folded into `pre-tool-quality.ts` (that gates REFACTOR test-files only).
- **CI backstop:** new `safeword architecture --check` flag (dry-run → exit 1 on
  `{created, healed, regenerated}`), dogfooded as a CI `lint`-job step and
  documented as the recommended customer CI step.

**Auto-fix safety:** the doc is `.generated.` machine-owned; the
ownership-marker guard already makes `selfHeal` skip foreign content, so the only
file ever staged is one we just regenerated from live structure — no user
content to lose. A BDD scenario pins "commit-time stage never discards unrelated
staged changes". Idempotent / same render path as the SessionStart heal, so the
two never fight.

## Work Log

- 2026-06-22T23:37:04.081Z Started: Created ticket FPV0E4.
- 2026-06-22T23:40:00Z Intake written. Slice 2 = enforcement, converged design:
  opt-out/default-on, auto-fix-and-stage at commit, CI hard-fail backstop,
  tiered, noop-aware. Created after #316 (Slice 1) + #331 (rename) merged.
  Next: /figure-it-out on the "stale enough to act" threshold + config surface,
  then BDD.
- 2026-06-23T00:50:00Z /figure-it-out resolved the threshold, hard-fail set,
  config key, and wiring (see "Resolved design"). Config key
  `architectureDocEnforcement` (default-on) and foreign-doc pass-only both
  confirmed by user ("/figure-it-out" = my call). Advancing to define-behavior /
  BDD.
