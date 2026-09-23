---
id: KFJ9K2
slug: verify-cursor-data-guidance-delivery
type: task
phase: intake
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/4766
created: 2026-09-22T17:21:41.554Z
last_modified: 2026-09-22T17:22:30.000Z
---

# Verify data guidance through real shipped Cursor assets

**Goal:** Make delivery verification inspect the real Cursor and OpenCode artifacts users receive.

**Why:** Synthetic Cursor fixtures and mutable ticket prose leave avoidable delivery-test blind spots and false-failure coupling.

**Type:** Improvement

**Scope:** Build data-architecture delivery verification from the real generated or reconciled Cursor asset set, prove OpenCode's unaffected state from shipped inventory, and remove exact completed-ticket prose from the product-test boundary.

**Out of Scope:** Changing Cursor or OpenCode delivery ownership, adding a new guide copy, or changing generator output unrelated to verification.

**Done When:**

- [ ] Cursor delivery verification consumes the real generated or reconciled Cursor assets.
- [ ] A seeded bad Cursor planning reference fails through that real asset boundary.
- [ ] OpenCode's unaffected state is proven from shipped catalogue or inventory data without reading ticket prose.
- [ ] Existing guide-copy, missing-target, cross-surface, lifecycle, and release checks remain green.

**Tests:**

- [ ] RED: a bad reference present only in generated Cursor output escapes the current two-file fixture.
- [ ] GREEN: the same mutation fails when delivery verification consumes the real Cursor asset set.
- [ ] REFACTOR: Cursor and OpenCode verification share shipped-artifact helpers without introducing another inventory.

## Work Log

- 2026-09-22T17:21:41.554Z Started: Created ticket KFJ9K2
- 2026-09-22T17:22:30.000Z Validated: Independent review warning reproduced by inspecting the two-file Cursor fixture; combined the related ticket-prose coupling because both are failures to test shipped artifacts directly.
