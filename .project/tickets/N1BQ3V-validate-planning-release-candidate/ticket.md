---
id: N1BQ3V
slug: validate-planning-release-candidate
type: patch
phase: done
status: done
phase_skips:
  - "define-behavior: release metadata only; existing release tests define the contract"
  - "scenario-gate: no new scenarios or product behavior"
  - "plan-implementation: follow the existing versioning procedure and canonical generators"
  - "plan-execution: follow the same release procedure and preserve explicit merge authority"
  - "implement: release metadata is recorded in 1854c9f1b and fake-host preconditions were repaired during verification; no production logic or assertions changed"
created: 2026-10-21T21:58:06.007Z
last_modified: 2026-10-21T21:58:06.007Z
scope:
  - Prepare and verify release identities and generated artifacts for 2.0.0-rc.1 from main a3c216940.
out_of_scope:
  - New planning behavior, unfinished PRs, deferred OpenCode/cloud qualification, stable promotion, or completing epic 4200.
done_when:
  - Release identities agree, packed upgrade preserves authored content, required release and activation checks pass, and independent review has no blocking findings.
  - Record outstanding CI and publication state honestly; merging and promotion remain separately subject to explicit approval.
---

# Validate the planning release candidate for maintainers

**Goal:** Prepare and verify an opt-in release candidate from current main while preserving the stable channel and all unfinished epic evidence.

**Why:** Exercise real upgrades before exposing changed planning contracts and review assurance to stable users.

## Work Log

- 2026-10-21T21:58:06.007Z Started: Created ticket N1BQ3V
- Prepared candidate in 1854c9f1b and opened Draft PR #6034. Release assertions 83/83, targeted activation/migration 109/109, real packed upgrade, Claude discovery and five Codex hook proofs passed.
- Initial CI passed unit matrices but failed six package acceptance scenarios because fake Codex hosts omitted marketplace reference persistence. Corrected fixture metadata without changing assertions or production behavior; final acceptance rerun passed 601/601 scenarios and 11,821 steps.
- Full local regression passed 11,977 tests with 14 conditional skips. Independent Claude Opus review 088bfbc3-d77a-49d5-a130-30708388f41b approved the release delta and verification with no blocking findings; the normal receipt verifier recorded the verify-phase review. Pushed-head CI and explicit merge/promotion approval remain pending. No merge, tag, publication or stable promotion occurred.
- Review response: existing-marketplace refresh fixtures now explicitly model a matching release pin. Stable-to-prerelease replacement is separately covered by the passing `moves a stale stable reference to the exact prerelease tag` and `refreshes an already matching prerelease tag without replacing the marketplace` tests in `tests/commands/migrate-codex-plugin.test.ts`. The small shell fakes support the standard release command shape; custom marketplace-source overrides remain outside those acceptance fixtures, rather than adding a general parser. A real remote candidate-tag install still depends on publication; local cache/hook proof is not claimed as that install.
