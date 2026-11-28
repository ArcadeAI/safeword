---
id: XHMWSC
slug: qualify-cursor-ide-on-isolated-desktop
type: task
phase: intake
status: in_progress
created: 2026-11-22T00:46:24.387Z
last_modified: 2026-11-22T00:46:24.387Z
---

# Verify Cursor IDE protection on a separate test desktop

**Goal:** Prove both current Cursor IDE deliveries in the combined seven-delivery run and confirm that no extra turn starts after the follow-up limit.

**Why:** The native IDE tests take foreground control. Defer them from the headless closeout and use a separate test desktop or an explicitly reserved window.

## Work Log

- 2026-11-22T00:46:24.387Z Started: Created ticket XHMWSC

## Acceptance checks

- Run both current Cursor IDE deliveries on a separate desktop or during an explicitly reserved window.
- Prove that the same chat completes its automatic follow-up, records the native cap, and starts no additional turn while verification remains unmet.
- Capture the combined seven-delivery result using the same retained installations for each applicable phase. Keep incomplete evidence ineligible for admission.

Source ticket: [2ENRH5](../2ENRH5-consistent-host-contract/ticket.md).
