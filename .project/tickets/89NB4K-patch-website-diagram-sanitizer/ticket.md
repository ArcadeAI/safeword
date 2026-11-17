---
id: 89NB4K
slug: patch-website-diagram-sanitizer
type: patch
phase: done
status: done
created: 2026-10-23T19:09:29.520Z
last_modified: 2026-10-23T19:15:00.000Z
---

# Restore dependency audit for website maintainers

**Goal:** Resolve the website Mermaid DOMPurify advisories using the smallest compatible update and verify the audit and website build.

**Why:** Current main pins vulnerable DOMPurify 3.4.13; the user authorized making PR 6109 green and admin merging it.

## Work Log

- 2026-10-23T19:09:29.520Z Started: Created ticket 89NB4K
- Reproduced the audit failure on main at bac142eac; GHSA-cg2g-xh64-v4q7 and GHSA-mrv2-3pqr-j5jr both identify 3.4.17 as the first patched version.
- Updated only the root DOMPurify override and lockfile resolution. Mermaid remains 11.17.2 with compatible range `^3.3.3`.
- Local frozen install, CI-policy audit, website build (9 pages including workflow Mermaid transformation), formatting, and commit checks passed.
- Independent Claude Opus quality review e6e72afb-a133-4281-b362-21367976d001 approved the dependency diff without errors. Informational requests are covered by npm integrity verification, successful website build, and advisory IDs in the PR description.
- The user's follow-up authorizes green checks and admin merge of https://github.com/ArcadeAI/safeword/pull/6109, superseding the original Draft-only boundary.

## Scope

Patch the website Mermaid DOMPurify dependency with the smallest compatible update, verify audit and website build, complete repository checks and review, then admin merge PR 6109.

## Out of Scope

Unrelated upgrades, audit exceptions, website content changes, and release/version changes.

## Root Cause

The exact root override pins vulnerable DOMPurify 3.4.13. Both current advisories affect versions through 3.4.16, with fixes in 3.4.17. A lockfile-only refresh cannot escape that override.

Ruled out a required Mermaid upgrade: npm registry metadata for Mermaid 11.17.2 declares `dompurify: ^3.3.3`, which includes 3.4.17. Ruled out unrelated audit failures as part of this fix: after updating only DOMPurify, the unchanged CI-policy audit passes; the raw audit contains only the pre-existing http-cache-semantics advisory already excepted in CI.

## Acceptance Criteria

- DOMPurify resolves to the earliest compatible patched version, 3.4.17.
- No unrelated dependency or audit policy changes.
- Existing CI-policy audit and website production build pass.
- Repository CI is green before admin merge.

## Verification and Authority

- 2026-10-23 19:08 UTC: user explicitly requested, "get it green and admin merge" in this chat after receiving Draft PR 6109. This authorizes the necessary Ready transition and admin merge after checks pass.
- 2026-10-23 19:13 UTC: local completion lane passed 104 files and 2,144 tests (`scripts/dev bun run test:done`).
- 2026-10-23 19:14 UTC: collector passed 153 tests; relay passed 198 tests with one existing skip; Go checker `go test ./...` passed with no test files.
- CI run: https://github.com/ArcadeAI/safeword/actions/runs/40008949116. Merge must wait for terminal green checks at the final PR head.
