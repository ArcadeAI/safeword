---
id: EBCDJA
slug: release-reviewed-retrospective-proof
type: task
phase: done
status: done
scope:
  - prepare the reviewed retrospective claim and append-only proof renewal guard for Safeword 1.1.0 release
  - keep CLI, Claude plugin, Codex plugin, generated runtimes, and installed version aligned
out_of_scope:
  - completing or relabeling historical #2121 scenario evidence
  - changing the existing historical proof ledger row
done_when:
  - focused guard tests, full suite, release contract, lint, typecheck, and generated surfaces pass
  - CLI package, source installer, Claude and Codex manifests, generated runtimes, and project version identify Safeword 1.1.0 consistently
  - independent review approves the authored guard, focused tests, and version manifests; generators and release contracts verify bundled output and the lockfile version change
  - the full local suite and release lane pass before ticket closure; required CI checks pass on the closure commit before merge
created: 2026-10-07T19:57:35.859Z
last_modified: 2026-10-07T22:04:00Z
---

# Release reviewed retrospective proof for Safeword users

**Goal:** Prepare a verified Safeword 1.1.0 release candidate with the reviewed retrospective proof and renewal guard so the already implemented #2121 scenarios can later be verified honestly.

**Why:** The installed 1.0.0 guard cannot validate multiple historical claims or renew a checked proof after support-file drift.

## Work Log

- 2026-10-07T19:57:35.859Z Started: Created ticket EBCDJA
- 2026-10-07T19:59:00Z Split the release prerequisite from #2121: copied only the reviewed runtime, release artifacts, generated plugin output, and focused tests from codex/review-generated-targets. Historical proof packets, scenario ledger, and original tickets remain on their branch.
- 2026-10-07T20:07:00Z Reframed ticket closure as a verified release candidate. The Ready-only advisory review runs after this ticket closes and must pass before merge, tag, and publication; requiring it before closure would recreate the Ready gate cycle.
- 2026-10-07T20:34:00Z Exact-head CI run 37680551488 passed on Node 22 and 24, including the full suites, BDD lane, 13-file release suite, lint, typecheck, generated surfaces, CLI contract, and parity. Independent review 0e733d02-6cf6-46fb-9273-758af1545ede approved the authored guard, tests, ticket, and version manifests. The full-diff phase review hit the 262144-byte bun.lock target limit; recorded the supported explicit phase skip while preserving the partial independent review and CI evidence. Advanced to verify; Ready-only advisory review remains pending.
- 2026-10-07T20:38:00Z Verified the release candidate in verify.md, independently reviewed that record as 804d5e3c-d121-4618-8476-5060310aae96, and closed EBCDJA with the user's authorization. The closure-only commit still needs CI before Ready; publication and installed-profile smoke remain subsequent release steps.
- 2026-10-07T22:00:00Z Reopened EBCDJA after Ready advisory review of f6e74c6c0 found an out-of-project eligibility target could reach the row gate through retrospective_claims. Changed row-gate JSON reads to the existing contained regular-file reader and added an outside-project regression. The focused row/close suites pass 34/34 locally. The new source head needs independent review and CI before this ticket can close again; PR #5612 remains Ready but blocked for merge.
- 2026-10-07T22:15:00Z The final containment packet received independent review with no blocking findings. Local full suite passed 610/610 files and 10490 tests (14 skipped); the 13-file release lane passed 81/81 tests after the pinned Bun dependency refresh. Lint, typecheck, and all five generated-surface checks passed. The closure commit still needs exact-head CI and a new Ready-only advisory pass before merge.
- 2026-10-07T22:21:00Z Updated verify.md to distinguish completed local checks from pending exact-head CI and Ready advisory review. Independent verify review b9d7a461-a86e-4823-b95b-162545a80879 found no errors; the supported phase review stamp recorded it. Closed this release-candidate ticket under the user's authorization. PR #5612 remains blocked for merge until its current head passes CI and Ready advisory review.
