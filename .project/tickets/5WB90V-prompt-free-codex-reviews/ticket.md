---
id: 5WB90V
slug: prompt-free-codex-reviews
type: feature
phase: define-behavior
phase_anchors:
  - "define-behavior: .project/tickets/5WB90V-prompt-free-codex-reviews/spec.md"
status: in_progress
scope: Plugin-provided bounded Codex review tools, signed coordinator receipts, generated plugin packaging and skill guidance, and terminal live verification under built-in workspace permissions.
out_of_scope: Executable RED through MCP, Codex profile or rule changes, hook trust, cloud-only local subprocesses.
done_when: A fresh plugin install completes an ordinary independent review without a prompt or Codex permissions change; the signed receipt verifies through the normal gate; reviewed source remains unchanged; blocked or inconclusive results never report independent completion.
product_plan_contract: v1
created: 2026-09-24T14:49:35.859Z
last_modified: 2026-09-24T14:49:35.859Z
---

# Run independent reviews without repeated Codex approvals

**Goal:** Let Codex users run bounded Safeword reviews without repeated prompts while keeping the sandbox active.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-24T14:49:35.859Z Started: Created ticket 5WB90V
- 2026-09-24T14:53:00Z Intake: Accepted the explicit choice and narrow-rule direction from the user's earlier decision and proceed instruction. Drafted bounded product plan and dimension table. The intake exit requires an independent review stamp.
- 2026-09-24T14:54:08Z Rule check: The installed 0.85.0 review command matched no Codex allow rule. A separate normal-sandbox review attempt was blocked by the active network allowlist before reaching a reviewer; a kind-scoped out-of-sandbox rule addresses that route. No review result or stamp existed at that time.
- 2026-09-24T14:57:00Z Independent intake review 7167328b-2ba1-476e-9a6a-fa8ce6c07a48 by Claude Opus requested changes: upgrades could recreate a deleted permission grant or overwrite an unowned rule. Clarified revocation, ownership, rule-checker proof, and live dispatch evidence before re-review.
- 2026-09-24T15:00:00Z Independent intake review 9cb8a07a-bf97-4c75-9951-4cb7ce320bcc by Claude Opus requested changes: verification could pass in a different Codex permission context than users' sessions. Pinned verification to the resolved user setup, specified user-profile rule scope, upgrade triggers, atomic replacement, and honest recovery before re-review.
- 2026-09-24T15:04:00Z Independent intake review b7742b18-4206-48f2-8f46-4974e958d8c6 by Claude Opus requested changes: a live dispatch could still succeed after a prompt, ownership state was incomplete, the out-of-sandbox grant was undisclosed, and the acceptance gate omitted the coordinator's option guard. Specified non-interactive proof, ownership record semantics, exact grant disclosure, and coordinator rejection evidence before re-review.
- 2026-09-24T15:08:00Z Independent intake review 1a8465d4-f9ad-44f7-8847-f73079481b6b by Claude Opus requested changes: the prefix rule was insufficiently bounded for trailing positional arguments. Replaced the two-file ownership design with exact canonical-file matching, specified complete argv and operand validation, and removed unsupported secret-screening language before re-review.
- 2026-09-24T15:12:00Z Independent intake review 5e9f291f-94ac-4aff-8a1c-0d6d68ac54eb by Claude Opus requested changes: upgrade ownership matching needed explicit variable fields, and target operands needed repository confinement. Specified fixed-template matching around extracted runtime/Bun paths, canonical target resolution and escape rejection, absent-file behavior, and file modes before re-review.
- 2026-09-24T21:54:00Z Pivot: A kind-scoped allow rule would execute Bun outside the sandbox before argument validation. A live review from the source CLI returned a terminal independent Claude result under the existing `safeword-review` profile with no approval prompt after the Claude reviewer process disabled nonessential traffic. The unchanged installed runtime timed out under that same profile. Replaced the rule-install plan with sandboxed dispatch and optional reviewer-domain profile setup. The profile and scenario specifications need fresh independent review before implementation advances.
- 2026-09-25T00:45:00Z Architecture pivot: A disposable plugin MCP probe showed read-only tool calls run without approval under built-in workspace permissions while shell network is denied. Bundled a narrow review MCP server that uses the existing coordinator without project job-state writes. A fresh disposable Codex home installed the plugin and completed a real cross-agent Claude quality review of a synthetic defect without a prompt. Updated the product plan and scenarios; independent scenario and plan reviews are still required before closing this ticket.
- 2026-09-25T04:54:00Z Current-main live verification: A fresh Codex home installed the bundled plugin and ran `codex exec --sandbox workspace-write` against a disposable project. With no tool approval override, Codex discovered `start_review` but refused it: `MCP tool call requires approval, but approval policy is never`. The earlier no-prompt probe relied on a read-only annotation that was inaccurate because `start_review` launches a reviewer and writes a signed receipt; the current annotation correctly says it changes state. A temporary plugin-scoped `approval_mode = "approve"` let the same installed tool run without a prompt and return a signed terminal `changes_requested` result. That review reported `independence: degraded` after Claude failed and Codex took the fallback. No customer settings were changed. The no-config, independent-completion criterion remains unmet, so this branch is not ready for a pull request.
