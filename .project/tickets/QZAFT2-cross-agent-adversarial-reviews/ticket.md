---
id: QZAFT2
slug: cross-agent-adversarial-reviews
type: feature
phase: done
status: done
created: 2026-08-02T17:01:05.002Z
last_modified: 2026-08-02T21:20:00.000Z
scope:
  - opposite-agent headless execution for class-1 quality, phase, and architecture reviews
  - bounded read-only review packets with vendor-scoped credentials
  - loud classified fallback, exhaustion, and NTB recovery messages
  - author and reviewer agent provenance in backward-compatible review evidence
  - Claude and Codex desktop/cloud parity with staged activation and a default-on end state
  - an explicit opt-out that retains the existing route without claiming cross-agent independence
out_of_scope:
  - Cursor reviewer selection
  - agent installation or credential provisioning
  - direct vendor APIs or a remote review service
  - class-2 checks, class-3 fan-out, and internal per-step TDD self-checks
done_when:
  - Claude-authored class-1 work prefers Codex and Codex-authored class-1 work prefers Claude
  - reviewer isolation and validated output prevent judged-work mutation or false evidence
  - each failure class yields a plain explanation, a concrete next action, and an honest fallback level
  - exhausted routes block loudly and degraded reviews never satisfy hard cross-agent enforcement
  - desktop/cloud parity and unchanged out-of-scope routing are covered without real secrets
  - an explicit opt-out preserves the existing route and clearly states that cross-agent review was not requested, without satisfying hard enforcement
phase_anchors:
  - define-behavior: .project/tickets/QZAFT2-cross-agent-adversarial-reviews/spec.md
  - scenario-gate: packages/cli/features/cross-agent-adversarial-reviews.feature
  - implement: .project/tickets/QZAFT2-cross-agent-adversarial-reviews/impl-plan.md
---

# Catch agent blind spots with cross-agent reviews

**Goal:** Run every class-1 adversarial review in a headless session of the opposite agent runtime when available.

**Why:** Same-runtime reviewers preserve correlated blind spots; desktop and cloud sessions should automatically use the installed alternate CLI and explain any fallback.

**See:** [spec.md](./spec.md) for personas, jobs, rules, and outcomes.

## Work Log

- 2026-08-02T17:01:05.002Z Started: Created ticket QZAFT2
- 2026-08-02T17:10:00.000Z Investigated: Existing class taxonomy limits this to class-1 judgment reviews. Local Claude 2.1.170 and Codex 0.141.0 both expose read-only noninteractive modes and authenticated status checks; no API-key environment variables are required when their profile login is available.
- 2026-08-02T17:10:00.000Z Decided: Build one CLI command that tries the opposite vendor first, warns and falls back to the remaining headless agent, then fails with an actionable native-subagent instruction if neither route works. Rejected host-native-only delegation (not deterministic across runtimes) and direct SDK calls (duplicate auth/config and add dependencies).
- 2026-08-02T17:20:00.000Z Reclassified: User required the full BDD workflow. Removed the uncommitted implementation spike and promoted the task to a feature before production code landed.
- 2026-08-02T17:25:00.000Z Reuse audit: NMSD94 already specifies fresh independent phase reviews; 7A0B2K and MR5M3A already prove different-model stamp enforcement; invisible-retro-claude and codex-retro-parity already prove safe synchronous headless invocation and cloud-auth constraints. New behavior is limited to cross-agent selection, loud fallback, exhaustion, and reviewer-identity propagation.
- 2026-08-02T17:30:00.000Z Intake amendment: Added NTB as a first-class persona. The independent review is their primary assurance because they cannot audit the diff; any degraded fallback must be explained in plain language with a concrete next action.
- 2026-08-02T17:35:00.000Z Gate: User approved the revised JTBD set with “proceed.” Drafted invariant-level Rules for opposite-agent selection, reviewer provenance, read-only isolation, loud fallback, NTB actionability, shared class-1 policy, surface parity, and unchanged class-2/class-3 routing.
- 2026-08-02T17:45:00.000Z Gate: User approved the Rules after clarifying the NTB recovery contract. Figure-it-out selected a shared Safe Word CLI coordinator over host-native-only delegation and direct APIs: it is the only option that deterministically chooses the opposite vendor while reusing installed desktop/cloud authentication. Drafted Scope, Out of Scope, and Done When for engineering-scope signoff.
- 2026-08-02T18:00:00.000Z Quality review: Fresh headless Claude pass requested changes. Corrected the false “subprocess-backed today” framing: current class-1 flows are host-subagent-backed, and this feature adds a new synchronous fail-closed path borrowing only retro's spawn/isolation primitives. Refreshed vendor sources, made coordinator-assigned provenance explicit, strengthened neutral-workspace isolation, and added a staged rollout guard without weakening the requested default end state.
- 2026-08-02T18:10:00.000Z Quality re-review: A second fresh headless Claude pass approved the revised intake with no critical issues. Deferred two non-blocking design notes: cite the canonical live Codex noninteractive page, and forward only the selected reviewer vendor's credential environment rather than inheriting unrelated author-vendor secrets.
- 2026-08-02T18:20:00.000Z Gate: User approved the independently reviewed engineering scope with “Go.” Cold-start executability check returned SUFFICIENT with no intent gaps; exact packet shape, timeout values, and config names remain builder-choice details. Advanced intake → define-behavior and derived the coverage dimensions before scenario authoring.
- 2026-08-02T18:30:00.000Z Gate: User approved the 11-rule, 17-scenario-group behavior set with “Go.” Gherkin lint is healthy and Safeword status reports no QZAFT2 lineage or surface gaps; advanced define-behavior → scenario-gate for independent review-spec validation.
- 2026-08-02T18:40:00.000Z Scenario review: Fresh headless Claude found 1 must-fix and 4 should-strengthen items. Split missing vs. contradictory provenance, split write vs. credential isolation, added timeout/malformed-output recovery rows, made the shared-coordinator outcome observable, and added the already-scoped non-Claude/non-Codex author boundary. Returned to define-behavior because the adversarial pass added one scenario group.
- 2026-08-02T18:45:00.000Z Gate: User approved the strengthened 19-scenario-group set. Re-entered scenario-gate for a fresh independent re-review.
- 2026-08-02T18:55:00.000Z Scenario gate: Fresh headless Claude re-review returned PASS with 0 must-fix and 1 non-blocking rollout note; all five prior findings are resolved. Recorded the content-bound scenario-gate stamp with reviewer model provenance. The rollout guard's transition mechanics move to implementation planning; the end-state opposite-agent default remains scenario-bound. One eligible build-only kill-risk remains for the optional spike checkpoint: real nested Claude→Codex headless execution/auth/isolation (the reverse direction was proven while running the gate from Codex through Claude).
- 2026-08-02T19:05:00.000Z Spike preparation: User requested catch-up plus spike. Fast-forwarded the new `codex/cross-agent-adversarial-reviews` branch to `origin/main` at `a59eb35086cad0ce55bacebfbfa9c874d44bb25e`; QZAFT2 artifacts had no overlap and Gherkin lint remained healthy. Recorded the bounded Claude→Codex spike charter in `spike.md`; cloud credential parity remains an explicit non-emulated constraint.
- 2026-08-02T19:20:00.000Z Spike result — PARTIAL: Created isolated `spike/claude-launches-codex` worktree from baseline `ca9c56d3b6e9f41a651e981db30d57c8ae11dbc5`. The installed Claude CLI rejected `--tools`; the single permitted correction exposed variadic `--allowedTools` prompt consumption. Both attempts exited before a model turn or nested Codex launch, and the worktree remained clean. Retained the coordinator direction but withheld live-nesting validation; implementation must use structured argv/stdin, contract-test the Claude-hosted route, and keep live desktop/cloud smoke plus loud fallback as acceptance requirements.
- 2026-08-02T20:00:00.000Z Spike follow-up — VALIDATED with constraint: Figure-it-out traced the failures to stale executable selection (`/usr/local/bin/claude` 1.0.43 ahead of Claude Code 2.1.170) and variadic prompt parsing. Explicit binaries plus stdin produced successful Claude→Codex and Codex→Claude markers with vendor credential variables removed. A nested read-only Codex process could not access Claude's desktop profile, while a host-boundary run could; implementation must resolve and capability-check binaries, keep the coordinator at an auth-capable host boundary, preserve reviewer isolation independently, and classify inaccessible credentials rather than silently weakening permissions.
- 2026-08-02T20:10:00.000Z Phase: Advanced scenario-gate → plan-implementation after the independently reviewed scenario stamp and validated bidirectional spike. Planning will map every approved scenario to a proof and keep application code untouched until the plan passes its own independent review.
- 2026-08-02T20:55:00.000Z Plan rework: The first independent plan review passed; after precision edits, a fresh re-review correctly found that spec.md's explicit opt-out had no scenario and was absent from condensed ticket scope. Returned to define-behavior to bind that approved requirement before implementation. Also expanding the implementation proof map from rule-level rows to one row per scenario group.
- 2026-08-02T21:05:00.000Z Scenario re-review: Fresh headless Claude returned 0 must-fix, 2 should-strengthen, and 3 looks-good findings. Strengthened write isolation so a real snapshot mutation must remain confined and invalidates evidence; added a rejection sibling proving explicit opt-out cannot satisfy hard cross-agent enforcement.
- 2026-08-02T21:10:00.000Z Gate: Re-entered scenario-gate with 21 scenario groups after applying both strengthening findings and passing Gherkin lint.
- 2026-08-02T21:15:00.000Z Scenario gate: Fresh headless Claude returned 0 must-fix and 0 should-strengthen findings across all 21 scenario groups, explicitly confirming the write-isolation and hard-enforcement opt-out gaps are resolved. Recorded a fresh content-bound scenario-gate stamp and advanced to plan-implementation.
- 2026-08-02T21:20:00.000Z Plan gate: Fresh headless Claude returned PASS with all 21 scenario groups mapped and no blockers. Folded in its two non-blocking precision notes, recorded the content-bound plan-implementation stamp, and advanced to implement with seven coupled vertical slices and one architecture decision.
- 2026-08-02T23:00:00.000Z Final quality gate: Live public-command smoke passed in both directions using existing desktop authentication. The final Codex-authored delta reached headless Claude under `require` policy and returned `approve` with dispatch `6ed64e69-aade-41e6-a2ba-87b37c0edb19`, validated Claude provenance, and no blocking findings.
- 2026-08-02T23:10:00.000Z Mainline reconciliation: Rebased onto `origin/main` at `e22a2f96b`, preserved the new project-principles review contract alongside cross-agent coordinator routing and actual-model provenance, regenerated Codex plugin assets, and confirmed architecture state is current.
- 2026-08-02T23:18:20.000Z Verification: 417 Vitest files passed (6296 tests, 5 skipped), all 771 Cucumber scenarios passed or were intentionally skipped (768 passed, 3 skipped), TypeScript/build/lint/dependency checks passed, 64/64 BDD ledger rows are complete, and the diff-scoped audit passed. Marked the feature done.
