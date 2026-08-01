---
id: P2JDY5
slug: release-readiness-v0-70
type: task
phase: done
status: done
subtype: bug-investigated
created: 2026-07-31T01:26:54.405Z
last_modified: 2026-08-01T16:11:37.000Z
---

# Ship a clean release for safeword users

**Goal:** Audit and reconcile every change merged since v0.69.0, apply justified behavior-preserving refactors, verify release readiness, and close completed tracking items.

**Why:** The release candidate spans many merged changes and needs one evidence-backed quality gate before publishing.

**Type:** Internal / Refactor

**Scope:** Review the complete `v0.69.0..HEAD` release range and its linked GitHub
and repository tickets. Fix verified release blockers and complete worthwhile,
behavior-preserving refactors in changed code, then prove the release candidate
through the repository's full release validation lanes.

**Out of Scope:** New product features, speculative architecture rewrites,
production dependency major-version migrations, publishing the release, and
closing tracking items whose acceptance criteria are not demonstrably complete.

## Investigation Plan

1. Establish the release boundary from tags, commits, merged pull requests, and
   package versions; build a commit-to-PR-to-ticket inventory.
2. Partition changed files by product surface and trace cross-cutting contracts
   through schema, templates, installed mirrors, hooks, CLI commands, docs, and
   tests.
3. Run independent quality and semantic-refactor scouts, plus the deterministic
   audit for architecture, dead code, duplication, dependency currency, test
   quality, config drift, and documentation drift.
4. Run lint, typecheck, unit/integration/BDD/release tests, build, packaging,
   parity, and install/smoke checks; classify environmental limitations
   separately from product failures.
5. Build a complete, leaf-first refactor ledger. For each accepted entry:
   confirm behavioral coverage, make one refactoring, run its targeted tests,
   inspect the regression checklist, and commit it only if the change remains
   isolated.
6. Re-run the quality review after every material fix until no critical issues
   remain, then run the full verification and audit gates again.
7. Reconcile repository tickets and GitHub issues against shipped behavior and
   evidence. Close only completed items; record why anything remains open,
   deferred, superseded, or out of scope.

## Done When

- [x] Every commit and merged PR since `v0.69.0` is represented in the release inventory.
- [x] Every changed product surface has been reviewed for correctness, cohesion, documentation, and wiring-test coverage.
- [x] The refactor ledger is fully resolved or each deferred entry has a release-risk rationale.
- [x] Full lint, typecheck, test, BDD, build, release, package, parity, audit, and verification evidence is green or has an explicit non-product limitation.
- [x] Completed repository tickets and GitHub issues are closed with evidence; remaining open items have a documented reason.
- [x] A final independent quality review has no critical issues.

## Tests

- [x] Existing targeted behavioral tests stay green after each individual refactor.
- [x] Tracker identities reject path separators, absolute paths, dot segments, control characters, and malicious writer responses before any callback or filesystem mutation.
- [x] Hyphenated tracker IDs retain their metadata-defined ID and slug in feature-source, provenance, and health output.
- [x] A connected-provider wiring test crosses the real command/config/writer/process/sidecar/filesystem path with only `gh` replaced at the process boundary.
- [x] Keychain-only sync authentication crosses the real command/config/corpus/writer/process/sidecar path with only `gh` replaced at the process boundary.
- [x] Graph projection omits self-parent and self-blocker edges consistently in plan and live-sync paths.
- [x] `safeword test-plan` verify, BDD, build, typecheck, and dependency lanes pass.
- [x] Package release tests and package-content validation pass.
- [x] Template/schema/installed-config parity checks pass.
- [x] Architecture, dead-code, duplication, test-quality, and documentation audits have no release-blocking findings.
- [x] Tracker identities cannot produce Windows-reserved composed ticket-folder names; superficially reserved raw IDs remain accepted when the required slug suffix makes the final folder portable.
- [x] The copyable GitHub Actions workflow pins each external action to a verified immutable commit SHA and runs a security-patched Node 24 LTS release.

## Work Log

- 2026-07-31T01:26:54.405Z Started: Created ticket P2JDY5
- 2026-07-31T01:30:00.000Z Planned: Defined the release boundary, review angles, refactor discipline, verification lanes, and tracking reconciliation rules.
- 2026-07-31T02:08:00.000Z Investigated: Independent review found unsafe tracker identity path construction, delimiter-based parsing of hyphenated tracker IDs, a missing connected-provider process-boundary wiring test, a non-runnable GitHub Actions example, and live-sync credential preflight that prevents authenticated `gh` keychain use.
- 2026-07-31T03:33:16.000Z Reconciled: Closed GitHub issues #772, #773, and #1032 with implementation evidence; kept broader incomplete issues #644, #810, and #1166 open. Closed or superseded completed local tickets and recorded three non-blocking refactor follow-ups.
- 2026-07-31T03:49:00.000Z Verified: The controlled full suite passed 376 files and 5,653 tests (5 skipped); deterministic BDD passed 499 scenarios (3 skipped) and 15,444 steps (4 skipped). Lint, typecheck, formatting, release tests, build, parity, Knip, and production dependency audit passed.
- 2026-07-31T03:58:12.000Z Packaged: Regenerated the Codex plugin catalogue, corrected order-sensitive package export conditions, updated patch-level tooling dependencies, and obtained a clean publint package result.
- 2026-07-31T05:03:11.000Z Complete: Final independent review approved with no critical or high-severity findings. Updated the documented GitHub Actions example to the verified current v7 releases; website typecheck and production build passed.
- 2026-07-31T13:49:12.000Z Reopened: Fast-forwarded three reviewer commits, merged current main, fetched all PR review threads, and investigated the remaining Windows filename portability note against Microsoft and Git primary sources. RED coverage proved only reserved device names followed by an extension remain unsafe after the required slug suffix.
- 2026-07-31T14:04:45.000Z Complete: Independent re-review approved with no critical issues. Full verification passed 5,663 tests, 499 BDD scenarios, release packaging, lint, typecheck, parity, architecture, dead-code, website, and production dependency gates.
- 2026-07-31T15:35:00.000Z Reopened: Refreshed PR comments and an independent full-diff review found no blockers; accepted two non-blocking release-hardening improvements for keychain-only sync wiring proof and immutable Actions references in the copyable workflow.
- 2026-07-31T15:39:00.000Z Implemented: Extended the real `sync-tracker` command wiring proof from keychain preflight through a fake `gh` issue write and recorded sidecar reference, pinned the copyable workflow to verified Actions SHAs, and removed the verification record's diff-check whitespace error. The focused wiring suite is green.
- 2026-07-31T15:59:30.000Z Complete: Three independent review passes approved with no critical issues. Full verification passed 5,663 tests, 499 BDD scenarios, 26 release tests, lint, typecheck, package and website builds, immutable-action verification, parity, architecture, dead-code, formatting, and production dependency gates.
- 2026-07-31T23:20:50.000Z Reopened: The latest independent PR review found the generated ticket index omitted four release-review tickets and retained six obsolete states. Regenerated the index from canonical ticket files and clarified that GitHub CLI authentication may resolve from `GH_TOKEN` or stored credentials after excluding the caller's `GITHUB_TOKEN`.
- 2026-07-31T23:40:18.000Z Complete: Final independent re-review approved with no critical issues or suggestions. After merging current `main`, the canonical 467-ticket index is exact; 5,670 tests, 499 BDD scenarios, and the release, lint, typecheck, package, website, parity, architecture, dead-code, formatting, and production dependency gates passed.
- 2026-08-01T07:28:47.000Z Reopened: A current-source quality pass found the copyable workflow still pinned Node 24.16.0, predating the High- and Medium-severity fixes released in Node 24.17.0. Added a release-gate regression test and advanced the example to current LTS 24.18.0.
- 2026-08-01T07:33:33.000Z Complete: The new release gate failed on Node 24.16.0 and passes on 24.18.0. All 27 release tests, lint, typecheck, website typecheck/build, packaging, parity, formatting, dependency audit, and independent re-review are green with no critical issues remaining.
- 2026-08-01T15:40:00.000Z Reopened: Merged the latest `main` after PR #1639 landed its typed public CLI protocol and continuous Codex migration work. Conflict review found that the new public `tracker sync` handler bypassed the GitHub CLI credential resolver added by this ticket.
- 2026-08-01T15:47:09.000Z Complete: Routed GitHub CLI authentication through the new public tracker handler with a RED/GREEN Commander-boundary regression test, reconciled the exact 470-ticket index, and passed 5,916 tests, 671 acceptance scenarios, all 27 release tests, lint, typecheck, formatting, and parity.
- 2026-08-01T15:58:00.000Z Reopened: Main advanced again with honest BDD evidence/lock-wait behavior and Linear portable-sync guidance. Reconciled the tracker guide so Linear's supported path composes with GitHub keychain authentication, immutable Actions references, and the patched Node workflow.
- 2026-08-01T16:11:37.000Z Complete: The combined tracker, public-CLI, Linear, and lock-runner suite passed 50 tests; the full suite passed 5,937 tests, all 27 release tests, lint, typecheck, formatting, parity, and website validation. The exact index now contains 472 canonical tickets.

## Root Cause

The issue-first ticket path trusted a tracker/adoption identity as a safe
filesystem segment. Normalization removed only a leading GitHub `#`, while
`createIssueFirstTicket` joined the resulting value into a path and invoked its
pre-write callback before validating containment. A malicious adopted key or
writer response could therefore escape the tickets directory.

Several consumers also reconstructed ticket identity by splitting a folder name
at its first hyphen. That assumption was valid for six-character local IDs but
became false when connected trackers introduced canonical IDs such as `ENG-45`.
The authoritative `id:` and `slug:` fields already exist in `ticket.md`; the
consumers did not use them.

The existing command wiring test covered only `provider: none`, so it could not
detect gaps across connected config loading, writer selection, the `gh` process
boundary, pending-reference persistence, and local folder creation.

Finally, the documentation promised GitHub CLI/keychain authentication while
live sync required an environment credential before invoking its `gh`-backed
writer. The preflight and the actual transport therefore used different
authentication capabilities.
