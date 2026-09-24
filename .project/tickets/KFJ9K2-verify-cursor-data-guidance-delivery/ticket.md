---
id: KFJ9K2
slug: verify-cursor-data-guidance-delivery
type: task
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/4766
created: 2026-09-22T17:21:41.554Z
last_modified: 2026-09-23T02:08:53.000Z
---

# Verify data guidance through real shipped Cursor assets

**Goal:** Make delivery verification inspect the real Cursor and OpenCode artifacts users receive.

**Why:** Synthetic Cursor fixtures and mutable ticket prose leave avoidable delivery-test blind spots and false-failure coupling.

**Type:** Improvement

**Scope:** Verify freshly generated Cursor assets against the reconciled assets users receive, prove OpenCode's unaffected state from shipped inventory, and remove exact completed-ticket prose from the product-test boundary.

**Out of Scope:** Changing Cursor or OpenCode delivery ownership, adding a new guide copy, or changing generator output unrelated to verification.

**Done When:**

- [ ] Cursor generation occurs away from reconciled output; delivery verification rejects an empty set on either side, inspects the real union of generated and reconciled assets, rejects missing, extra, or differing content, and validates planning references against the managed target path and guide copy against `packages/cli/templates/guides/data-architecture-guide.md` across both sets even when their bytes match. Comparison may normalize line endings only and must retain all guide-copy bytes.
- [ ] Each of the generated and reconciled Cursor/project asset sets contains the managed `.safeword/guides/data-architecture-guide.md` and exactly one textual occurrence of its planning target across that set; verification fails if either disappears from both sets.
- [ ] A bad planning reference seeded upstream of Cursor generation fails even when the reconciled copy is still clean.
- [ ] OpenCode assets discovered from shipped files contain neither a data-architecture guide asset nor a planning reference to `data-architecture-guide.md`, and match a generator-declared asset set obtained independently from the shipped-file enumeration, without reading ticket prose.
- [ ] `packages/cli/tests/data-architecture-delivery.test.ts` no longer reads completed-ticket prose; a standing source check rejects literal ticket-file reads in that test (a regression diagnostic, not a security boundary), while shipped OpenCode inventory assertions replace its unaffected-profile coverage.
- [ ] Existing guide-copy, missing-target, cross-surface, lifecycle, and release checks remain green.

**Tests:**

- [ ] RED: a bad reference seeded upstream of generation and present only in generated Cursor output escapes the current two-file fixture.
- [ ] GREEN: the same mutation fails when delivery verification consumes the real Cursor asset set.
- [ ] GREEN: a reconciled-only stale Cursor asset with drift outside planning references fails delivery verification.
- [ ] GREEN: one generated-only path and one reconciled-only path each fail the Cursor set comparison.
- [ ] GREEN: guide-copy trailing-space-only drift fails the Cursor content comparison.
- [ ] GREEN: a bad planning reference present identically in generated and reconciled Cursor assets still fails content validation.
- [ ] GREEN: guide-copy drift present identically in both Cursor sets still fails against the canonical guide.
- [ ] GREEN: an empty generated set or empty reconciled set fails Cursor delivery verification.
- [ ] GREEN: removal of the managed guide or Cursor planning reference from both generated and reconciled delivery still fails the positive-presence check.
- [ ] GREEN: a second Cursor planning reference seeded upstream of generation and present in both deliveries fails the exactly-one check.
- [ ] GREEN: a seeded OpenCode guide reference fails the shipped-inventory assertion that replaces the ticket-prose check.
- [ ] GREEN: a data-architecture guide asset both declared and shipped for OpenCode fails its guide-asset absence assertion.
- [ ] GREEN: one declared-only and one discovered-only OpenCode asset each fail the independent inventory comparison.
- [ ] GREEN: a seeded ticket-file read in `packages/cli/tests/data-architecture-delivery.test.ts` fails the standing check.
- [ ] REFACTOR: Cursor and OpenCode verification share shipped-artifact helpers without introducing another inventory.

## Work Log

- 2026-09-22T17:21:41.554Z Started: Created ticket KFJ9K2
- 2026-09-22T17:22:30.000Z Validated: Independent review warning reproduced by inspecting the two-file Cursor fixture; combined the related ticket-prose coupling because both are failures to test shipped artifacts directly.
- 2026-09-23T02:08:53.000Z Clarified: A seeded generator-only defect must fail even when the reconciled copy remains clean; OpenCode absence and ticket-prose independence are explicit completion checks.
