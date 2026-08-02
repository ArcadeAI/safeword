# Impl Plan: Prevent stale Safe Word guidance from blocking Codex users

**Status:** implemented

## Approach

The riskiest assumption is that Safe Word can distinguish a historical whole-file revision from user-edited guidance strongly enough to offer cleanup. Prove that first with pure classification tests over absent, unrelated, exact registered-hash, and edited-signature content.

Build in this order:

1. Add a pure Codex-profile guidance observer that follows Codex's active global-file rule (`AGENTS.override.md` first, otherwise `AGENTS.md`), computes a SHA-256 digest, and classifies exact registered revisions separately from suspected edited legacy guidance.
2. Add unit tests for active-file selection, exact versus suspected classification, false-positive rejection, unreadable/absent profiles, and fixed backup collision behavior.
3. Add `safeword codex clean-guidance` as a plan-confirmed mutation. Preview binds the active path and digest into a 64-character plan identity. Apply re-observes the file, refuses stale plans, edited content, and occupied backup paths, then renames the source to the backup and hashes the bytes at the backup path. If the moved artifact does not match the confirmed digest, cleanup restores it to the active path and reports a race instead of claiming success. A restore-path collision is preserved under a distinct recovery name so neither concurrent version is lost.
4. Surface the observation from both project status/doctor and Codex status. Exact legacy content gets the preview command; suspected legacy content gets manual-review guidance and no mutation action.
5. Prefix SessionStart context with a compact authority block naming `.project/` and `.safeword/guides/`. Header-first ordering keeps the authority contract within Codex's default context limit without enlarging the hook payload.
6. Update CLI help/README documentation and the executable feature steps or integration coverage that proves the public entry points.
7. Prove the complete diagnosis and cleanup flow against an isolated temporary `CODEX_HOME`, then dogfood the same explicit cleanup against this Codex profile after confirming it is an exact registered historical revision.

Primary proof is Vitest integration coverage through public handlers plus unit coverage for dense classification boundaries. The existing Cucumber lane proves the actor-facing scenarios.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Runtime conflict handling | Explicit current-path authority block in SessionStart developer context | Rely on merge order; mutate global AGENTS | Merge order does not erase contradictory prose; mutation violates user ownership |
| Exact ownership proof | Full-file SHA-256 registry | Marker-only deletion; fuzzy similarity | Only a full registered revision justifies whole-file cleanup |
| Cleanup safety | Preview/confirm plan plus move–verify–restore transaction | Immediate delete; silent startup repair; pre-rename hash check alone | The moved artifact itself must match the confirmed digest; a pre-rename check leaves a TOCTOU window |
| Edited legacy handling | Warning-only manual review | Strip known paragraphs | Partial edits may contain user-authored policy that Safe Word cannot safely separate |
| Command placement | `codex clean-guidance` | Fold into project setup; fold into migration finalization | The conflict is profile-scoped and can exist without project-local legacy hook state |

Sources: [OpenAI AGENTS.md discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [OpenAI hook context behavior](https://learn.chatgpt.com/docs/hooks).

## Arch alignment

- Reconciliation Over Copy — observe and plan before mutation; never blind-copy over user content.
- Schema as Single Source of Truth — register the public command and its options in the command catalogue.
- Agent Parity — this is intentionally Codex-profile-specific; shared project context remains unchanged for Claude and Cursor.

## Known deviations

- Dogfood remediation was added after isolated proof because the repository is itself a Safe Word consumer and the user explicitly requested both customer and dogfood repair. The same preview/confirmation path moved the exact historical file to a recoverable backup; no special-case mutation was introduced.

## Doc impact

- `README.md`: document the diagnostic and cleanup command.
- Codex command catalogue/help: expose the new command and plan confirmation flags.

## Assessment triggers

- Codex changes global instruction discovery away from `$CODEX_HOME/AGENTS{.override}.md`.
- Safe Word ships another historical global-guidance revision that warrants cleanup registration.
- A future Codex API provides first-class instruction-source provenance or conflict diagnostics.
