# Impl Plan: Suppress repeated stop-quality prompts in a session

**Status:** implemented

## Approach

The riskiest assumption is that recognition can distinguish a genuinely complete final response from ordinary prose without weakening existing done-phase gates. Prove it first through the real Claude Stop-hook entry point: a non-done, edit-bearing transcript with `stop_hook_active: false` and a full CONFIDENT brief must exit silently. This fails before the recognizer exists.

| Scenario | Owner | Primary proof | Supporting proof | Why this scope is sufficient |
| --- | --- | --- | --- | --- |
| Complete CONFIDENT brief | `stop-quality.ts` entry point | Integration | Unit contract for brief recognition | Spawns the installed dogfood hook with real JSON stdin, transcript, and stdout. |
| Complete BLOCKED brief | `stop-quality.ts` entry point | Integration | Unit contract for its field set | Exercises the second public verdict family through the same runtime wiring. |
| Done gate takes precedence | `stop-quality.ts` branch ordering | Integration characterization | Existing done-gate fixture | The observable JSON block proves recognition cannot short-circuit a missing `verify.md`. |
| Incomplete brief remains corrected | `stop-quality.ts` entry point | Integration characterization | Unit negative contract | The existing JSON soft block proves no blanket allow was introduced. |

Build order: (1) add the failing CONFIDENT integration assertion and its pure recognition contract; (2) add the smallest ordered, line-oriented recognizer to `packages/cli/templates/hooks/lib/quality.ts`; (3) call it only after done-state, immediate-loop, and typecheck gates have run but before the ordinary quality soft block in `packages/cli/templates/hooks/stop-quality.ts`; (4) add the BLOCKED, incomplete, and done-phase integration fixtures; (5) regenerate `.safeword/` using the local CLI, then run focused and package-level checks. The sole affected surface is Claude Code; the integration tests drive that surface. Cursor and Codex have explicit out-of-scope adapters and require no proof changes.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Duplicate suppression signal | Assess the current `last_assistant_message` for a complete terminal brief | Session-wide acknowledgement state; shortening the prompt; removing the reminder | State can hide later drift; shorter text still repeats; removal weakens long-session recency. [Figure-it-out sources: W3C clear content](https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/), [NN/g heuristics](https://media.nngroup.com/media/articles/attachments/Heuristic_Summary1_Letter-compressed.pdf), `.project/learnings/long-session-style-drift.md` |
| Recognition grammar | Ordered, line-oriented bold verdict/field labels with non-empty values | Loose keyword search; full Markdown parser | Keyword search accepts incidental prose; a parser is disproportionate to a fixed, hook-owned response contract. |
| Gate placement | After done-state, immediate-loop, and typecheck checks, immediately before the ordinary quality soft block | Earlier global early return; persistent session marker | Earlier placement could bypass hard evidence enforcement; a marker adds lifecycle state without improving response correctness. |
| Test layers | Real hook integration plus pure helper tests | Unit-only; full Cucumber execution | The entry point needs stdin/stdout wiring proof; `@manual` feature source intentionally routes to the deterministic Vitest hook lane. |

## Arch alignment

Honors the `ARCHITECTURE.md` decisions for schema-owned template sources, reconciliation before dogfood copies, and the Claude Code stop hook retaining hard done-gate enforcement. It also follows the documented quality-review cadence: only the generic ordinary-stop backstop changes; phase and done gates keep their existing precedence.

## Known deviations

skip: no deviations planned; this is a local extension of the existing shared quality-message contract and the canonical Claude hook.

## Doc impact

skip: internal hook behavior only; configured README and website sources do not describe this stop-prompt cadence.

## Assessment triggers

Revisit if Claude Code changes the `last_assistant_message` payload contract, if the quality response template renames required labels, or if another runtime adopts this same shared recognition path.

## Implementation reconciliation

Implemented as planned in the Claude Code hook only. Quality review required one tightening that is consistent with the plan's terminal-response assumption: a marker sequence must consume the entire remaining response and only one CONFIDENT/BLOCKED verdict may appear. The additional typecheck and disqualification integration assertions characterize existing gate precedence; no new adapter, state, dependency, or documentation surface was introduced.
