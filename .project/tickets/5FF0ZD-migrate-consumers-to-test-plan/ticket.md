---

id: 5FF0ZD
slug: migrate-consumers-to-test-plan
type: feature
phase: define-behavior
status: in_progress
parent: Q4FX8Y
created: 2026-06-16T15:46:47.057Z
last_modified: 2026-06-16T15:46:47.057Z
scope:

- Add a `safeword test-plan --format sh` mode that emits an eval-able script (`( cd <cwd> && <command> )` per entry; `echo "⏭️ Skipped — <runner> not installed"` for unavailable entries)
- Migrate `templates/hooks/lib/test-runner.ts` to consume `safeword test-plan --kind test --json` (via the `safewordCliCommand()` installed→bunx pattern), executing each entry in its `cwd` with the existing timeout/truncation; still append `test:bdd`
- Migrate `/verify` (skill + command) section 2 to `eval "$(safeword test-plan --kind test --format sh)"` + build, removing the inline per-language bash; keep its existing `test:bdd` block and done-gate phrasing
- Delete the now-duplicated `nativeTestCommand`/`getJsTestCommands`/`pythonTestCommand` from `test-runner.ts`
  out_of_scope:
- "/audit" migration — its per-language blocks are dead-code/outdated TOOLING, a different domain `test-plan` does not model (revalidated). A parallel `audit-plan` is a fast-follow on the epic, not this ticket.
- The `test:bdd` gherkin lane (JS-acceptance) stays a consumer-side step; `test-plan` does not emit it
- Changing resolver behavior (BKTTZA owns it) beyond adding the `--format sh` output mode
  done_when:
- `test-runner.ts` contains zero per-language command strings; the stop-hook done-gate runs the resolver's plan (verified: a Go/Rust/polyglot fixture runs the right suites)
- `/verify` section 2 contains zero inline language bash; it evals `test-plan --format sh`
- No language command string is duplicated across `test-runner.ts` and `/verify`
- Done-gate literal phrases preserved; full suite + cucumber lane stay green; dogfood parity preserved

# Route the stop hook and /verify through safeword test-plan

**Goal:** Make `test-runner.ts` and `/verify` consume the `safeword test-plan` resolver so per-language test/build command knowledge lives in exactly one place — killing the duplication 2FVZ26 introduced.

**See:** epic [Q4FX8Y](../Q4FX8Y-extract-shared-test-runner/ticket.md). [spec.md](./spec.md) for JTBD/AC.

## /figure-it-out decision (2026-06-16)

- **TS hook** (`test-runner.ts`): shell to `safeword test-plan --kind test --json`, parse in TS, execute each `{cwd, command}` with the existing execSync+timeout+truncation. Upgrades it (gains go.work / nextest / tox / unittest from the resolver).
- **bash skill** (`/verify`): add a `--format sh` emit mode; the skill becomes `eval "$(safeword test-plan --kind test --format sh)"`. No jq (none exists in templates); deterministic; plan-only preserved (resolver formats, caller executes).
- **Rejected:** parsing `--json` in bash (no jq; inline `node -e` re-duplicates run logic); agent-reads-and-runs (non-deterministic, weakens the gate).
- **Scope correction:** /audit dropped — dead-code/outdated tooling is a different domain (revalidated). Fast-follow `audit-plan` noted on the epic.

## Work Log

- 2026-06-16T15:46:47.057Z Started: Created ticket 5FF0ZD
- 2026-06-16 Intake: revalidated consumers + /figure-it-out; scope corrected (audit out, --format sh for bash, --json for TS). → define-behavior.
