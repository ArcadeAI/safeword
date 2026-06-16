---
id: 5RPEMR
slug: clean-shipped-hook-comments
type: patch
phase: intake
status: in_progress
created: 2026-06-16T13:07:39.147Z
last_modified: 2026-06-16T13:07:39.147Z
---

# Remove safeword release-process narration from shipped hook comments

**Goal:** Comments in shipped hooks should not narrate safeword's own release/dogfood process to customer machines.

**Why:** Low-impact hygiene — the runtime behavior is correct, but the comments describe safeword-internal mechanics (canonical template source, "ahead of published npm") that mean nothing in a customer repo.

> Source: `PRODUCT-AUDIT-leakage.md` → Axis 1 (LOW). The `dogfood.ts` *detection logic* is correct and stays; only the explanatory prose needs trimming to what a consumer needs.

## Findings (file:line)

- `templates/hooks/session-auto-upgrade.ts:23` — *"deployed mirrors of the LOCAL `packages/cli/templates/` source."*
- `templates/hooks/lib/dogfood.ts:5-13` — *"canonical source at `packages/cli/templates/` — routinely ahead of the published npm package."*
- `templates/hooks/post-tool-sync-learnings.ts:42` — local-CLI dev/dogfood path check + comment.

## Acceptance criteria

- [ ] Comments reworded to describe consumer-relevant behavior (why the hook skips/branches) without safeword's monorepo/release narrative.
- [ ] No behavior change; detection logic untouched.

## Work Log

- 2026-06-16T13:07:39.147Z Started: Created ticket 5RPEMR
