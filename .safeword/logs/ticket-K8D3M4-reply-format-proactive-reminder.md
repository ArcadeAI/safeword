# Work Log: Surface reply format before Claude responds

**Anchored to:** `.project/tickets/K8D3M4-reply-format-proactive-reminder/ticket.md`

---

## Session: 2026-07-27

- [16:11] Revalidated GitHub issue #1524 against fresh `origin/main`.
- [16:11] Found the full verdict template in `hooks/lib/quality.ts`; it is
  delivered by the Stop hook after the response.
- [16:11] Confirmed the existing `prompt-questions.ts` hook runs at
  `UserPromptSubmit`, before Claude processes the user's prompt.
- [16:11] Researched current Claude hook semantics: UserPromptSubmit context is
  injected beside the user prompt; static project instructions should stay
  concise and a per-prompt hook is appropriate for timing-sensitive reminders.
- [16:11] Decision: add one compact factual reminder to the existing prompt
  hook, retain the Stop hook as the detailed safety net, and keep non-Claude
  adapters out of scope for this issue.
- [16:43] RED: added the real-installed-hook contract and confirmed the
  reminder was absent before changing the template.
- [16:43] GREEN: added the concise outcome/decision-brief reminder and synced
  the dogfood mirror with `bun run parity:fix`.
- [16:43] Verification: focused 58/58 integration tests, complete Vitest
  (5,549 passed; 5 skipped), Gherkin (505 passed; 3 skipped), lint, typecheck,
  Knip, and diff hygiene passed. Independent quality review: APPROVE.
- [16:45] Full audit: config sync, dependency-cruiser, Knip, and Go checks
  passed. `jscpd` reported the existing repository baseline (506 clones);
  `bun outdated` found only the out-of-scope, low-risk dev patch for
  `markdownlint-cli2`.
- [17:26] Dedicated refactor: replaced the inline reply-format literal with
  `REPLY_FORMAT_REMINDER`. The real installed-hook test remains 58/58; lint,
  typecheck, parity, and the follow-up audit pass. No second cleanup is
  justified; the refactor cannot be committed separately from the uncommitted
  #1524 change.
