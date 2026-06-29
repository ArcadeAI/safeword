---
id: SFGCR1
slug: resolve-current-dependency-advisory-baseline
type: task
phase: intake
status: in_progress
relates_to:
  - Q7FN5X
created: 2026-06-27T20:38:17.268Z
last_modified: 2026-06-27T20:39:00Z
---

# Resolve current dependency advisory baseline

**Goal:** Resolve or explicitly triage the dependency security advisories currently reported by `bun audit`.

**Why:** Quality-review should be able to distinguish PR-specific security risk from known dependency baseline risk.

## Context

`Q7FN5X-audit-dependency-security-advisories` resolved the June 15 advisory set and is closed. The June 27 audit baseline differs and needs a current owner.

Current `bun audit --json` findings:

- `linkify-it` — high — GHSA-22p9-wv53-3rq4
- `markdown-it` — moderate — GHSA-6v5v-wf23-fmfq
- `dompurify` — low/moderate — GHSA-vxr8-fq34-vvx9, GHSA-gvmj-g25r-r7wr, GHSA-cmwh-pvxp-8882
- `js-yaml` — moderate — GHSA-h67p-54hq-rp68
- `@babel/core` — low — GHSA-4x5r-pxfx-6jf8

## Scope

- Identify which top-level packages pull in the advisory packages.
- Prefer normal dependency bumps over long-lived root overrides.
- Document non-runtime exposure when an immediate upgrade is not practical.

## Done When

- `bun audit --audit-level high` is clean, or remaining high advisories have a named upgrade blocker.
- Every remaining low/moderate advisory has an owner, exposure note, and follow-up path.
- Required dependency changes pass build, typecheck, lint, and targeted tests.

## Work Log

- 2026-06-27T20:38:17.268Z Started: Created ticket SFGCR1
- 2026-06-27T20:39:00Z Scoped from quality-review follow-up on `DBF1FW-feature-surfaces-bdd`: current audit baseline is not fully owned by closed `Q7FN5X`; created this ticket as separate dependency-security debt so feature work remains unblocked.
