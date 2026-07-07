---
id: J555B9
slug: track-decompress-critical-audit-regression
type: task
phase: intake
status: in_progress
created: 2026-07-07T05:34:36.978Z
last_modified: 2026-07-07T05:34:43Z
external_issue: https://github.com/advisories/GHSA-mp2f-45pm-3cg9
---

# Track decompress critical audit regression

**Goal:** Track and resolve the new critical bun audit advisory in the root shellcheck dependency chain.

**Why:** The July 2026 quality review found GHSA-mp2f-45pm-3cg9 through shellcheck -> decompress@4.2.1 after the earlier audit advisory ticket had been closed as clean.

## Work Log

- 2026-07-07T05:34:36.978Z Started: Created ticket J555B9
- 2026-07-07T05:34:43Z Found: `bun audit --json` reports critical `decompress <=4.2.1` via `shellcheck@4.1.0`.
- 2026-07-07T05:34:43Z Found: `bun pm why decompress` resolves the chain as `safeword -> shellcheck@4.1.0 -> decompress@4.2.1`.
- 2026-07-07T05:34:43Z Found: `bun pm view shellcheck version` reports `4.1.0`, and `bun pm view decompress version` reports `4.2.1`; neither package currently has a newer npm release that clears the advisory.
- 2026-07-07T05:34:43Z Decided: Track as follow-up remediation, not part of the #586 docs patch, because replacing the shellcheck npm wrapper or changing audit policy is a separate dependency decision.

## Scope

**In:**

- Decide whether to replace the `shellcheck` npm wrapper, vendor/use a system binary, or accept a narrowed dev-only advisory.
- Verify any remediation with `bun audit --json`, `bun run lint`, and the relevant shell-hook tests.
- Update the earlier audit-advisory documentation if the accepted posture changes.

**Out of Scope:**

- General dependency refreshes unrelated to `shellcheck`, `decompress`, or the audit result.
- Changing the #586 TDD guidance.

**Done When:**

- `bun audit --json` is clean for this advisory, or the remaining risk has an explicit accepted-risk note with rationale and owner.
- The selected path is verified with the repo lint/typecheck flow.
