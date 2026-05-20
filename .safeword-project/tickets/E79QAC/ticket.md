---
id: E79QAC
slug: quality-message-clarity
type: task
phase: implement
status: in_progress
created: 2026-05-20T14:09:07.786Z
last_modified: 2026-05-20T14:09:07.786Z
---

# Rephrase novel-claim block to prevent misreading

**Goal:** Rephrase the novel-claim disqualification message in `quality.ts:108` so it accurately describes the gate (flag-shown-to-user check) instead of the misleading "/quality-review first" phrasing.

**Why:** I just spent half a turn convinced the gate was enforcing proof-of-quality-review, ran a BLOCKED with a 3-option recommendation, then discovered on re-investigation that the flag is a one-shot nudge auto-cleared by the next user prompt. The current wording is the trap. One-line fix.

**Scope:**

- `packages/cli/templates/hooks/lib/quality.ts:108` — message names the actual condition (flag still active) and frames /quality-review as advisory.
- Mirror to `.safeword/hooks/lib/quality.ts` (template-sync pair).
- Update existing assertion in `packages/cli/tests/quality.test.ts:251`.

**Out of scope:**

- Promoting /quality-review to a true gate with log-injection.
- Touching the flag's lifecycle (post-tool-quality setter, prompt-questions consumer).
- /refactor skill changes (no gate to fix).

**Done when:**

- `getDisqualificationMessage({ novelResearchReminderUnconsumed: true })` returns a string that names the flag's actual condition (not "requires /quality-review first"), mentions the next user prompt clears the flag, and mentions /quality-review as advisory for load-bearing claims.
- Existing test updated and green.
- Lint clean.

## Work Log

- 2026-05-20T14:09:07.786Z Started: Created ticket E79QAC
