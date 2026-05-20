---
id: 65TVGM
slug: safeword-sizing-calibration
type: patch
phase: done
status: done
created: 2026-05-20T14:30:28.071Z
last_modified: 2026-05-20T14:30:28.071Z
---

# Add mechanical-multi-file calibration example

**Goal:** Add one calibration example to SAFEWORD.md's sizing-rule section that closes the apparent contradiction between "3+ files → feature" and the BDD skill's "Do NOT use for bug fixes / small isolated changes."

**Why:** Reconciles the only doc contradiction I hit this session. The BDD literature (Dan North, Cucumber's BDD history doc) backs the intent: BDD is for behavior-discovering work, not behavior-restating. Mechanical multi-file cleanups have no behavior to discover, so the file-count heuristic is a noise signal. One bullet, matches the existing calibration-example style.

## Work Log

- 2026-05-20T14:30:28.071Z Started: Created ticket 65TVGM
