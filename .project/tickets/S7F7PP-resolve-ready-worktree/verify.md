# Verification: explain readiness checkout mismatches (#5511)

## Main catch-up and impact

Fast-forwarded this branch from `d5885e587` to current main `ca452a9cc`
(PR #5881). This is one first-parent merge containing 1,112 additional reachable
commits. The uncommitted mitigation was saved and restored. Canonical source
merged cleanly; only generated bundles, catalogue, and fixture metadata conflicted,
and were regenerated from current main plus the diagnostic patch.

No functional rework is needed: main leaves the readiness evaluator, namespace
resolver, Codex adapter/translation, readiness workflow, and delivery-gate tests
unchanged. Its new execution-planning/coding-authorization gates affect later
edit handling in the shared hook; the mitigation remains at the existing Bash
readiness-denial boundary.

Post-sync validation: 141/141 tests pass across six suites, including readiness,
installation, skill delivery, translation, and the new coding-authorization hook
tests. Root ESLint, all three package typechecks, and generation/parity checks
pass (276 pairs, 11 contracts). CLI builds successfully on the new base. Used
the new `scripts/dev` launcher with pinned Bun/Node. `bun ci` completed with
no dependency changes after the package-script change invalidated the bootstrap
fingerprint. The older broad-suite results below are historical, not a claim
that the entire updated-main suite was rerun.

Refreshed independent Claude/Opus approval:
`eae857ed-55a3-433f-b02b-1d015aa332de`, author `codex`, reviewer `claude`,
independence `cross-agent`. The upstream host limitation remains unchanged.

## Historical diagnostic checklist — before main catch-up (d5885e587)

**Test Suite:** ⚠️ Focused readiness checks: 114/114 pass. Full root run: relay 198 pass (1 skipped), collector 153 pass, CLI 10,524 pass (14 skipped), 1 review-routing deadline failure. That test passes unchanged in isolation (1.33 seconds).
**Gherkin:** ⚠️ Acceptance lane: 1,618 passed, 3 skipped, 4 failed. Three failures reproduce unchanged on clean origin/main; hook responsiveness passes in isolation on both trees.
**Build:** ✅ Success — root build completed for all three packages.
**Lint:** ✅ Clean — root ESLint, changed Markdown checks, and formatting checks passed.
**Typecheck:** ✅ Clean — all three package typechecks passed.
**Scenarios:** All 3 added regression cases pass in the full CLI run; task uses inline test definitions.
**Refactor:** ✅ No change warranted — one conditional diagnostic at the existing readiness boundary.
**PR Scope:** ✅ Diff matches ticket scope — hook diagnostic, recovery guidance, regression cases, and required generated/dogfood surfaces.
**Dep Drift:** ✅ Clean — no dependency manifests or lockfile changed. Supply-chain audit separately reports 8 existing advisories (2 high, 3 moderate, 3 low).
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation — existing source hook and adapters remain authoritative.
**Experience:** ⚠️ Automated checks prove the recovery wording and mechanics; no user walkthrough was performed.
**Surface Evidence:** ✅ Adapter JSON, native CLI JSON, and native CLI exit-code boundaries tested. All 5 generated surfaces current; 269 parity pairs and 11 contracts pass.
**Evidence limits:** ⚠️ Simulated host payloads through real Safeword entrypoints, plus inspection of pinned Codex 0.160.0 source; no live Codex tool-to-hook capture. Full automatic routing remains dependent on upstream exposing the effective command directory.

## Root-cause and regression proof

The new cases failed before the change because the denial named launch-checkout
ticket `OTHER` without the `Readiness checkout` label. Each case now checks the
exact evaluated checkout, a distinct subdirectory hook cwd, ticket identity,
and session-rooted recovery. Reporting the verified delivery worktree as cwd
allows Ready through the same entrypoint without copying ticket state or receipts.

Independent Claude/Opus review approved all changed work; implementation receipt:
`d883b3dd-f352-4709-a65f-df03415caa21`, author `codex`, reviewer `claude`,
independence `cross-agent`. Generated runtime bundles were excluded by review
attributes and verified by the generation/parity checks.

## Broader-suite findings

Before the main catch-up, exact-name acceptance reruns on this patch and clean
main at `d5885e587` both reported
the same 3 failures:

- Evidence over budget cannot look complete or ready: actual state is `complete`.
- Plugin hook commands never point at repo-local hook scripts: old regex omits
  the existing `--no-env-file --cwd` Bun flags.
- Release check proves the packed package contains the plugin and hook entrypoints:
  same existing regex mismatch.

Hook responsiveness passes on both isolated runs. The full Vitest deadline test
took an extra fallback route under load and passes in isolation. These findings
are recorded separately; neither the tests nor unrelated production logic were
changed to make this patch appear green.

The dependency audit findings also predate this patch because the dependency
manifests and lockfile are byte-identical to HEAD.

## Result and next action

The diagnostic mitigation is implemented and independently reviewed. Keep
GitHub #5511 open: Codex can still omit the command workdir, including the inverse
case where evidence from the session checkout incorrectly allows an unseen
unfinished worktree. This patch explains blocked mismatches; it does not solve
that upstream information loss or provide a readiness bypass.

At this diagnostic-only checkpoint, the ticket remained in verification and no
commit, push, PR, or issue closure had been performed. The later execution-time
fix is tracked in sibling task 0VN2X5, whose verify.md records the current combined
evidence. The local implementation now includes `project pr-ready`; the upstream
raw-hook metadata limitation remains explicit.

The managed clean baseline worktree created for this investigation was retained
because the app refused archive with "This worktree is protected by a pinned
task or workspace." Its temporary dependency symlinks were removed; the calling
chat's worktree attachments retain its exact recovery identity.
