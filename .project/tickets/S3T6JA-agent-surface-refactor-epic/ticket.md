---
id: S3T6JA
slug: agent-surface-refactor-epic
type: feature
phase: intake
status: in_progress
epic: agent-surface-refactor
children:
  - Y06KJS
  - F1HTQ4
  - 88QCHJ
  - 1833FW
  - W0E292
  - 6SE3MR
  - 2YZDKQ
created: 2026-06-14T01:38:54.925Z
last_modified: 2026-06-14T03:24:46Z
---

# Epic: Reduce agent surface drift for Safeword maintainers

**Goal:** Make Claude, Cursor, and Codex agent surfaces easier to keep aligned without collapsing the separate files each tool expects.

**Why:** Safeword now ships across Claude Code, Cursor, and Codex. The parity work proved the behavior, but the maintenance surface still has repeated schema entries, wrapper files, logging snippets, and dogfood mirrors that can drift.

**See:** [spec.md](./spec.md) for jobs, outcomes, and the second-pass decision record.

## Second-pass figure-it-out summary

**Evidence checked:** Claude Code skills and hooks docs, Cursor rules and skills docs, Codex AGENTS/config/skills/hooks/rules docs, plus local schema/templates/dogfood files.

**Decision:** Keep all platform-native surfaces, but make their repeated content derive from smaller shared sources where the generated output remains byte-for-byte equivalent.

| Child  | Decision                                                                                        | Priority |
| ------ | ----------------------------------------------------------------------------------------------- | -------- |
| Y06KJS | Generate Claude and Codex skill registrations from one manifest; do not delete dogfood mirrors. | High     |
| F1HTQ4 | Generate Cursor command/rule wrappers from metadata while preserving physical wrapper files.    | High     |
| 88QCHJ | Replace repeated skill-log shell injections with one installed helper command.                  | High     |
| 1833FW | Reconcile or explicitly document the dogfood `.cursor/commands/verify.md` drift.                | Resolved; close blocked by #469 |
| W0E292 | Extract pure Codex hook translation helpers behind the current executable adapter.              | Medium   |
| 6SE3MR | Share only the fake Codex binary writer; keep Cucumber/Vitest harness setup separate.           | Low      |
| 2YZDKQ | Keep `versioning` as a Claude-local maintainer-only skill; exclude it from shared manifests.    | Medium   |

## Quality-review guardrails

- Run 2YZDKQ before Y06KJS so manifest generation does not silently promote or drop the dogfood-only `versioning` skill.
- 1833FW is resolved for F1HTQ4: Cursor verify content is aligned to the shipped template; final ticket close is blocked only by #469.
- Run Y06KJS before F1HTQ4 if F1HTQ4 consumes the shared skill metadata.
- Do not assume Claude, Cursor, and Codex all execute the same skill-body shell syntax. 88QCHJ must verify helper invocation behavior per surface before replacing any snippet.
- Keep a platform-current-docs check at pickup. Cursor and Codex both now expose skills/plugin concepts, but safeword still needs physical command/rule/config files where setup/upgrade installs them today.

## Child tickets

| ID                                                              | Title                                                | Notes                                                          |
| --------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| [Y06KJS](../Y06KJS-agent-skill-manifest-generation/ticket.md)   | Reduce duplicated skill registration for maintainers | Shared skill manifest feeding Claude and Codex schema entries. |
| [F1HTQ4](../F1HTQ4-cursor-wrapper-generation/ticket.md)         | Keep Cursor wrappers aligned from shared metadata    | Generate `.cursor/commands` and `.cursor/rules` wrappers.      |
| [88QCHJ](../88QCHJ-skill-invocation-log-helper/ticket.md)       | Make required skill logging reusable                 | Installed helper for `verify` and `audit` logging.             |
| [1833FW](../1833FW-cursor-verify-template-drift/ticket.md)      | Keep Cursor verify evidence aligned                  | Dogfood/template drift on Gherkin evidence.                    |
| [W0E292](../W0E292-codex-hook-adapter-helpers/ticket.md)        | Make Codex hook adapter behavior easier to test      | Extract pure translation/denial helpers.                       |
| [6SE3MR](../6SE3MR-fake-codex-cli-fixture/ticket.md)            | Share fake Codex CLI fixtures where it pays off      | Narrow fixture extraction only.                                |
| [2YZDKQ](../2YZDKQ-versioning-skill-surface-decision/ticket.md) | Clarify versioning skill ownership                   | Decision-first ticket for Claude-only skill.                   |

## Out of scope

- Changing Claude, Cursor, or Codex public behavior as part of this epic's planning.
- Removing tracked dogfood surfaces; dogfooding remains a safeword design constraint.
- Reworking the Codex parity epic itself. This epic is follow-up maintenance, not parity proof.

## Work Log

- 2026-06-27T14:20:00Z Revalidated 1833FW: dogfood Cursor verify content is aligned with the shipped verify template, including Gherkin evidence. F1HTQ4 can proceed from the current verify content; the child ticket's final done flip is blocked by GitHub issue #469.
- 2026-06-14T03:24:46Z Decided: 2YZDKQ keeps `versioning` Claude-local maintainer-only (`audience: maintainer`), so Y06KJS must exclude maintainer-only dogfood skills from shared customer-facing manifests.
- 2026-06-14T02:05:00Z Reviewed: Quality-review pass approved the epic direction and added sequencing/runtime guardrails.
- 2026-06-14T01:46:00Z Updated: Added second-pass figure-it-out decisions and seven child tickets.
- 2026-06-14T01:39:00Z Created: Minted child tickets for the seven refactor candidates from the read-only pass.
- 2026-06-14T01:38:54.925Z Started: Created ticket S3T6JA.
