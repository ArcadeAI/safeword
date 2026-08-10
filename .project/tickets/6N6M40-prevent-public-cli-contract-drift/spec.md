# Spec: Prevent public CLI contracts from drifting again

## Intent

Make the shipped CLI and its exhaustive catalog change together. A maintainer gets one deterministic pre-merge answer about every invocable route, option, alias, compatibility rewrite, help surface, machine surface, and generated mirror.

## Intake Brief

- **Requested by:** The Safeword maintainer after GitHub issue #2251 and PR #2278 repaired current CLI inconsistencies.
- **Cost of inaction:** Commands, aliases, inherited options, compatibility rewrites, or operative documentation can bypass the catalog and silently recreate inconsistent behavior.
- **Reversibility:** Two-way door through a staged rollout; the factory, catalog, tests, workflow job, and ruleset requirement can be reverted independently before duplicate coverage is removed.

## References

- GitHub issue #2283 — approved requirements and rollout sequence
- GitHub issue #2251 and PR #2278 — originating repair and regression baseline
- Commander 15 command, option, argument, help, `exitOverride`, and `parseAsync` APIs
- GitHub Actions and repository-ruleset documentation

## Personas

- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Safeword CLI
- GitHub Actions Execution Sandbox

Unaffected:

- Claude Code — the CLI contract is harness-independent.
- OpenAI Codex — the CLI contract is harness-independent.
- Cursor — the CLI contract is harness-independent.

## Vocabulary

- **Invocation:** One accepted route or spelling: canonical command, retained alias, internal route, Commander alias, bare default, or argv compatibility rewrite.
- **Runtime inventory:** Commands, aliases, syntax, arguments, options, and visibility recursively observed on the fully assembled production Commander program.
- **Catalog classification:** Exactly one of `public`, `retained-alias`, or `internal`, with visibility recorded separately.
- **Contract gate:** The focused comparison of catalog, runtime inventory, shipped subprocess surfaces, terminology, and generated outputs.
- **Compatibility region:** Text between literal, unnested `safeword:compatibility:start` and `safeword:compatibility:end` comment delimiters, using HTML or MDX comment syntax as required by the document renderer, where deprecated names are intentionally historical or describe retained compatibility.

## Jobs To Be Done

### cli-contract-drift.SWM1 — Change one CLI contract without creating hidden inconsistencies

**Persona:** Safeword Maintainer (SWM)

> When I add or change a CLI invocation, I want one deterministic gate to reconcile the real shipped program and every declared surface, so I can merge without leaving users or agents with a different command model.

#### cli-contract-drift.SWM1.R1 — Every production invocation has exactly one public, retained-alias, or internal catalog entry

#### cli-contract-drift.SWM1.R2 — One side-effect-free factory assembles the exact production Commander program and runCli remains the only argv boundary

#### cli-contract-drift.SWM1.R3 — Retained aliases preserve supported behavior and reject options their handlers do not consume

#### cli-contract-drift.SWM1.R4 — Shipped help, capabilities, subprocess fixtures, generated artifacts, and operative lifecycle terminology fail one focused gate when stale

#### cli-contract-drift.SWM1.R5 — Ordinary pull requests cannot merge unless the stable CLI contract context passes against current main

## Rave Moment

skip: internal enforcement; preventing drift before review is table stakes for maintainers.

## Outcomes

- `createCliProgram()` returns the fully assembled program without parsing, invoking handlers, or mutating process state.
- `runCli(argv)` owns catalog-declared argv normalization, Commander parsing, machine parse errors, and exit status; `cli.ts` only calls it with `process.argv`.
- The catalog owns every canonical, retained, internal, Commander-alias, bare-default, and argv-rewrite invocation, including exact syntax, visibility, options, and applicable policy metadata.
- Recursive runtime reconciliation detects registered-only routes, catalog-only routes, alias loss, visibility drift, syntax drift, and normalized option drift. Commander-owned help/version exceptions are derived from the assembled program by exact route and flags.
- Every public command and argv rewrite crosses the built CLI subprocess boundary. Help, capabilities, generated plugin/reference freshness, and canonical terminology are checked by the same focused command.
- The dedicated `CLI contract` job is unconditional, has no retry, times out at five minutes, targets under ninety seconds, and is required on `main` with strict-current-main behavior after a staged rollout.
- Live ruleset mutation runs only as an explicit trusted maintainer rollout. A continuous ruleset-audit bot, merge-queue support, and removal of retained aliases remain out of scope.

## Open Questions

None.
