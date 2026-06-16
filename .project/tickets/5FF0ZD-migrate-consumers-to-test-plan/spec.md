# Spec: Route the stop hook and /verify through safeword test-plan

## Intent

Make `test-runner.ts` and `/verify` consume the `safeword test-plan` resolver so per-language test/build command knowledge lives in exactly one place — removing the duplication 2FVZ26 introduced and keeping the gates from drifting.

## References

- Epic [Q4FX8Y](../Q4FX8Y-extract-shared-test-runner/ticket.md); sibling [BKTTZA](../BKTTZA-test-plan-resolver/ticket.md) (the resolver, done).

## Personas

- Safeword Maintainer (SM) — owns the gates; needs one definition of how a language is tested.
- Agent-Driven Developer (DEV) — relies on the done-gate to run the right suite for their language.

## Jobs To Be Done

### migrate-consumers.SM1 — one place to define how a language is tested

**Persona:** Safeword Maintainer (SM)

> When I change a language's test/build command, I want to edit one place, so the stop hook and /verify can't drift apart.

#### migrate-consumers.SM1.AC1 — test-runner has no per-language command strings

`test-runner.ts` resolves its suite by calling `safeword test-plan`; `nativeTestCommand`/`getJsTestCommands` are gone.

#### migrate-consumers.SM1.AC2 — /verify has no inline per-language test/build bash

`/verify` section 2 obtains its commands from `safeword test-plan --format sh` (eval), not hand-written language branches.

#### migrate-consumers.SM1.AC3 — `--format sh` emits an eval-able plan

`safeword test-plan --kind <k> --format sh` prints a runnable script: `( cd <cwd> && <command> )` per available entry, `echo "⏭️ Skipped — <runner> not installed"` for unavailable ones.

### migrate-consumers.DEV1 — the done-gate runs my real suite (preserved/upgraded)

**Persona:** Agent-Driven Developer (DEV)

> When my agent hits the done-gate in a Go/Rust/polyglot repo, I want my actual suite(s) run — no regression from the migration.

#### migrate-consumers.DEV1.AC1 — stop-hook behavior preserved, plus polyglot/go.work/nextest

A JS project still runs its `test`/`test:done` + `test:bdd`; non-JS and polyglot repos run the resolver's (more capable) suite. Per-command timeout + truncation + done-gate phrases intact.

## Outcomes

- No language command string appears in both `test-runner.ts` and `/verify`.
- Full suite + cucumber lane stay green; dogfood parity preserved.

## Open Questions

- **Implementation risk (resolve at implement):** in the dogfood test env, how does `test-runner.ts` locate the CLI for `test-plan`? `safewordCliCommand()` resolves `node_modules/safeword/dist/cli.js` → else `bunx safeword` (network). The runTests unit tests must drive a local CLI deterministically (likely a `SAFEWORD_CLI`/path injection or the installed dist), not hit the network. defer: confirm the seam during TDD.
