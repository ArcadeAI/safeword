---
id: QQAA7R
slug: deliver-current-workflows
type: task
phase: done
status: done
created: 2026-10-17T14:36:50.140Z
last_modified: 2026-10-18T22:10:11.000Z
scope:
  - Prepare synchronized 1.2.0 CLI and native plugin release artifacts.
  - Regenerate version carriers and validate release and Codex activation contracts.
out_of_scope:
  - Additional product behavior or dependency upgrades.
  - Publishing before the source and release pull requests are merged.
done_when:
  - All three version sources and generated identities agree on 1.2.0.
  - Generated freshness, release contracts and activation checks pass.
  - Release artifacts and exact-head verification are reviewable in a pull request.
---

# Deliver current workflows to plugin users

**Goal:** Prepare consistent 1.2.0 CLI and native plugin artifacts for the authorized release.

**Why:** The economical Luna retrospective fix and additive commands on main must reach installed plugin users.

## Work Log

- 2026-10-17T14:36:50.140Z Started: Created ticket QQAA7R
- 2026-10-18 Refreshed onto reviewed source 807c87b23 and current main via a
  normal merge, preserving published release history. Canonical generation
  resolved the one identity conflict; all five surfaces are current. Frozen
  install, 81 release contracts, version-sync, Claude-plugin check and parity
  pass. Normalized whole-lock equality against source passes with only the
  workspace version changed. Current-head CI and independent review remain
  required. The 343,758-byte lockfile exceeds the 262,144-byte review cap, so
  phase remains implement and the release remains Draft; no exception granted.
- 2026-10-18 Bounded current-source review
  74d87e9f-87c2-4ef5-8773-8e0ce38e76f3 approved 43 logical files with no errors;
  only bun.lock lacks non-generated coverage. No implementation stamp written.
  Fresh deterministic activation passes 5/5; the isolated live packaged-cache
  smoke passes with real pinned Codex and explicit Luna low, proving all five
  cached hook events while correctly leaving Desktop activation pending.
  The separate opt-in migration case was not requested. Current-head hosted CI
  and the existing review-coverage decision are required before promotion.
- 2026-10-18 User authorized the pending version-only bun.lock exception and
  admin merges of PRs 5924 and 5925, followed by a durable review fix. Recorded
  a deliberate implement-phase skip with the exact lock SHA-256
  9ab7cb7fb7c09bcf7d5facb84a600be57ca0abe4bdbd322331ee5b838dbecb9d and
  independent review 74d87e9f for all remaining logical files. This records an
  exception rather than claiming lockfile target coverage. Both prior-head CI
  runs passed; main has since advanced, so refreshed heads still need green CI
  before the authorized merges. No standing review policy changes.
- 2026-10-18 Advanced from implement to verify after recording the authorized
  skip. Earlier work-log entries are historical. Refreshed onto source
  22307b60d and main 1da75093f; all five generated surfaces, 81 release contracts,
  five activation checks, version sync and parity pass. Review bf02b32c approves
  with no errors; its stale-state documentation findings are being corrected.
- 2026-10-18 Completed local release preparation: refreshed live cache smoke
  passes 1/1, and the lock proof records the unchanged authorized SHA-256.
  Historical-state findings were corrected. Verification review
  27fa0b16-95a5-422c-91f0-019e9e3fc7b6 approved with no errors; its authenticated
  verify stamp succeeded through the installed unmodified 1.1.0 runtime before
  this closure. The unpublished 1.2.0 receipt route could not supply a witness
  and was not used. Added a positive version-sync exit-code log. Remaining
  wording suggestions are answered in the PR: every head, including docs,
  requires green CI; the source lockfile is unchanged across the main refresh;
  the default source probe resolves to the same Luna-low extractor configuration.
  Done denotes local preparation only. Current-head CI, source-first ordering,
  retargeting and admin merging remain external delivery gates. No publication,
  user-profile upgrade or standing review-policy change is claimed.
