---
id: YTHG23
slug: add-time-version-guard
parent: VKNF1T-platform-uplift-epic
type: patch
phase: intake
status: in_progress
created: 2026-06-13T01:07:16.403Z
last_modified: 2026-06-13T01:07:16.403Z
---

# Verify current dependency versions at add-time, never from memory

**Goal:** Add an "Authority" rule to SAFEWORD.md (template + dogfood): when adding a dependency, verify its current version from the registry/docs — never pin a version recalled from training data.

**Why:** Stale-deps-from-memory is a frequent agent failure mode — the model confidently pins a version that was current at training time but is months behind. The Authority section already covers reading docs for the _installed_ version; it doesn't cover the _add-time_ moment, which is exactly when there is no installed version to look up. Carved out of the larger 263422 (audit-deps-vs-dependabot) as the small guidance patch that doesn't need the audit machinery.

## Scope sketch

- SAFEWORD.md "Authority" section: add the add-time rule (verify current version before pinning; `npm view <pkg> version` / registry lookup / official docs).
- Both copies byte-identical: `packages/cli/templates/SAFEWORD.md` + `.safeword/SAFEWORD.md`.
- Out of scope: any `safeword check`/audit machinery comparing installed deps to latest (that stays in 263422).

## Work Log

- 2026-06-13T01:07:16.403Z Started: Created ticket YTHG23
