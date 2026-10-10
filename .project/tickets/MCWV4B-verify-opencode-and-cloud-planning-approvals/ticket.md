---
id: MCWV4B
slug: verify-opencode-and-cloud-planning-approvals
type: task
phase: intake
status: in_progress
created: 2026-10-10T04:15:40.122Z
last_modified: 2026-10-10T04:15:40.122Z
---

# Verify trustworthy planning approvals for OpenCode and cloud users

**Goal:** Complete real OpenCode and cloud planning-approval walkthroughs deferred from epic #4200 without overstating host proof.

**Why:** The user deferred OpenCode and cloud verification from the current epic to a follow-on ticket on 2026-10-09.

## Scope and acceptance

Follow-on to [epic #4200](https://github.com/ArcadeAI/safeword/issues/4200),
separated by the user's explicit 2026-10-09 deferral. Verify planning approvals
on OpenCode CLI, OpenCode TUI, Claude Code Cloud, and Cursor Cloud Agents.
Existing shared approval/security behavior remains in #4200; this ticket owns
the deferred host verification, not new product behavior.

For each host, exercise the actual installed lifecycle boundary with real
configuration and collaborators, mocking only the external reviewer process.
Start with an authentic current approving receipt and a successful transition,
change an accepted scenario, then prove the same boundary denies advancement
and names the required new review. Report each host separately; local adapter
simulation is not cloud proof. Retain all failures and unfinished cases.

Also verify R6's pending-review denial, current-approval advancement, and
exhausted-route fallback advancement on all four hosts (12 examples). Assert
fallback records reduced independence and the actual reviewer without falsely
calling the capability degraded. Together with the four R9 stale-receipt
examples, 16 host scenarios are explicitly deferred here. Shared fallback
selection and local Claude/Codex/Cursor checks remain in #4200.

The four deferred examples remain in
`features/keep-plan-reviews-current-and-trustworthy.feature`, under
`Installed phase gates enforce invalidated review receipts`. Keep their steps
and assertions intact. Remove the explicit manual/deferral tags only when this
ticket resumes with real host execution evidence.

Current evidence: three local Claude/Codex/Cursor hook characterizations pass
at b935f12e8; the selected seven-row outline records three passes and four
undefined cases in `/tmp/4200-r9-local-stale-final.{json,log}`. This is not
completion of these four cases. Independent review e149c26d-9a4c-4fdd-9537-6e5e42e7f283
records installation/host-fidelity limitations.

Claude Cloud setup session `session_01UipFahenAKsVUsjT8ZXpwp` matches the
ef0902846 tracked tree and runs pinned Bun 1.3.14/Node 24.18.1; no cloud
acceptance proof has run. Cursor's existing GitHub app selects 19 repositories,
excluding ArcadeAI/safeword. Verification succeeded, but repository access was
not expanded. Any later access expansion requires its own explicit approval.
No merge, PR promotion, profile changes, or unrelated host hardening belongs
to this ticket.

## Work Log

- 2026-10-10T04:15:40.122Z Started: Created ticket MCWV4B
