---
id: QQAA7R
slug: deliver-current-workflows
type: task
phase: implement
status: in_progress
created: 2026-10-17T14:36:50.140Z
last_modified: 2026-10-18T01:38:53.000Z
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
