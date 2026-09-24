# Work Log: Make agent handoffs decision-complete in real replies

**Anchored to:** `.project/tickets/ASG60P-make-agent-handoffs-decision-complete/ticket.md`

---

## Session: 2026-09-12

- [20:03] Investigation plan: decide among terminal-boundary correction, focused semantic evaluation, and stronger prompt-only proof. Research host terminal hooks and response-transform capabilities, semantic evaluation reliability and cost, deterministic parsing bounds, and false-positive/recovery ergonomics before surveying the current implementation.
- [20:03] Baseline: issue #4500 supplies two real-session failures and identifies the previous task's deliberate semantic-enforcement exclusion as the gap to close.
- [20:08] Host evidence: Claude Stop receives the final assistant message and can continue once with corrective context; Cursor Stop can auto-submit one bounded follow-up and exposes a transcript path; the installed Codex Stop payload already carries the final assistant message and supports a blocking continuation.
- [20:08] Evaluation evidence: prompt-only structure does not imply semantic compliance, while LLM judges remain instruction-sensitive. Pick a deterministic contract with explicit semantic roles and keep corpus evaluation as test evidence rather than a runtime dependency.
- [20:08] Recommendation: one shared `terminal-handoff/v1` contract, a pure bounded evaluator, and thin host adapters. Premortem: a broad classifier nags routine replies; mitigate by defining terminal-handoff eligibility explicitly and proving short conversational/no-decision cases remain quiet and concise.
