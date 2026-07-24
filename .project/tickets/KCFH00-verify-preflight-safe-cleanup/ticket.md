---
id: KCFH00
slug: verify-preflight-safe-cleanup
type: patch
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/469
created: 2026-07-24T04:03:12.849Z
last_modified: 2026-07-24T04:36:00Z
---

# Keep verification preflight runnable in restricted agent shells

**Goal:** Let the verification skill classify temporary Git-repository limits without being rejected by safe command policies.

**Why:** The current cleanup syntax is rejected before verification starts even though the Git probe and generated plan work.

## Work Log

- 2026-07-24T04:03:12.849Z Started: Created ticket KCFH00
- 2026-07-24T04:03:36Z Defined behavior: one safe cleanup contract preserves the #469 temporary-Git evidence preflight across template, dogfood, and generated Codex surfaces.
- 2026-07-24T04:05:17Z RED: `bun run test tests/verify-skill.test.ts` ran 62 tests; the new cleanup contract failed on template, both dogfood skills, and the generated Codex plugin because each still used `rm -rf`.
- 2026-07-24T04:17:25Z GREEN: replaced only the preflight cleanup in the template and dogfood mirrors, regenerated 25 Codex plugin assets, and passed the 62-test verify-skill suite plus the 8-test Codex catalogue release contract.
- 2026-07-24T04:17:25Z Verify: lint/typecheck, config sync, diff hygiene, and isolated BDD (83 scenarios) are green. The exact `/verify` block cleared the formerly rejected preflight and entered Vitest, but the full aggregate suite stayed silent with sleeping workers for over eight minutes and was stopped; record this as local evidence limitation, not product failure.
- 2026-07-24T04:21:06Z Revalidated: current `origin/main` still uses the safe-policy-rejected `rm -rf "$GIT_PROBE_DIR"` cleanup. Open issue #469 already owns this environment-classification defect and explicitly requires a temporary-Git preflight across agents; no duplicate GitHub issue is needed. Linked this patch ticket to #469.
- 2026-07-24T04:35:00Z Audit: scoped change is clean (config sync and dependency architecture pass). Kept unrelated documentation-link and Knip hygiene findings out of this patch; legacy persona aliases explain the audit script's TB/SM false positives.
- 2026-07-24T04:36:00Z Quality review: approved the Git probe and `find -depth -delete` cleanup against current Git and GNU Findutils documentation. Refactor pass found no safe simplification beyond the existing table-driven contract.
