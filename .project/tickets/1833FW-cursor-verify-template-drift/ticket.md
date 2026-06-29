---
id: 1833FW
slug: cursor-verify-template-drift
type: task
phase: intake
status: in_progress
parent: S3T6JA
epic: agent-surface-refactor
relates_to: VAX3Z2
scope:
  - Resolve the difference between `packages/cli/templates/commands/verify.md` and `.cursor/commands/verify.md`.
  - Decide whether dogfood Cursor verify should include Gherkin acceptance evidence.
  - Add a drift check or rationale so the difference does not silently recur.
out_of_scope:
  - Broader Cursor wrapper generation; child F1HTQ4 owns that.
  - Changing the Gherkin lane itself.
done_when:
  - The dogfood Cursor verify command is either aligned to the template or carries an explicit intentional-drift rationale.
  - F1HTQ4 can use the chosen verify content as generator input without preserving accidental drift.
  - The epic records the chosen outcome.
created: 2026-06-14T01:39:31.130Z
last_modified: 2026-06-14T02:05:00Z
---

# Keep Cursor verify evidence aligned

**Goal:** Make the installed Cursor verify command agree with the shipped verify template or document why it does not.

**Why:** The template includes `bun run test:bdd` and the `**Gherkin:**` done-gate evidence pattern, while the installed dogfood `.cursor/commands/verify.md` currently omits both.

## Figure-it-out pass

**Frame:** Decide whether the dogfood `.cursor/commands/verify.md` difference is acceptable customization or unintentional stale output.

**Research domains:** dogfooding as an upgrade signal; verify done-gate evidence; Gherkin acceptance lane requirements; template/install drift.

**Options considered:** Reconcile to template; document as intentional local customization; add a drift check and decide later.

**Recommend:** Reconcile or document immediately. This is a concrete evidence-path difference, not just cosmetic wrapper text.

**Next:** Compare the dogfood command to the template, apply the chosen alignment or rationale, and verify the done-gate evidence language.

## Notes

- This should probably run before F1HTQ4 so wrapper generation captures the intended state.
- If intentional, record why safeword's own dogfood should skip the Gherkin evidence line.
- Quality-review guardrail: treat this as a blocker for wrapper generation, not as generic cleanup.

## Resolution

The dogfood Cursor verify command now matches the shipped verify template for the Gherkin acceptance lane and `**Gherkin:**` evidence pattern. F1HTQ4 can treat the current verify content as the intended generator input.

Final `status: done` is still blocked by GitHub issue #469: local verify evidence needs to be reliable across agents before this ticket can close cleanly.

## Work Log

- 2026-06-27T14:20:00Z Revalidated on current `origin/main`: `.cursor/commands/verify.md` and `packages/cli/templates/commands/verify.md` both include the Gherkin acceptance lane and `**Gherkin:**` evidence. This resolves the ticket criteria except for the mechanical done flip, which is blocked by #469.
- 2026-06-14T02:05:00Z Reviewed: Marked the chosen verify content as generator input for F1HTQ4.
- 2026-06-14T01:46:00Z Scoped: Figure-it-out marked the drift as a high-priority concrete follow-up.
- 2026-06-14T01:39:31.130Z Started: Created ticket 1833FW.
