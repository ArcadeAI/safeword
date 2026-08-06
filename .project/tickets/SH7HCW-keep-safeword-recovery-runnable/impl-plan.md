# Impl Plan: Keep Safeword recovery runnable when dependencies are broken

**Status:** implemented

## Approach

The riskiest assumption is that shell classification can recognize an exact,
optionally tagged or versioned `safeword` package plus one of four recovery subcommands
without allowing a lookalike package, another Safeword subcommand, or shell
evaluation hidden in its arguments. The cheapest proof is the table-driven
`isDependencyBackedCommand` contract for all positive and negative examples.

Primary proof is integration-level Vitest coverage through the exported command
classifier and the real PreToolUse script. The classifier table covers every
feature example and parsing boundary; the hook process test proves a missing
project actually permits setup while continuing to deny Vitest. The release
contract test directly checks the parity recovery wording. These tests cover
the affected Safeword CLI surface with real template code and only the process
boundary supplied by the existing hook harness.

Build order:

1. Add recovery/denial classifier cases for package identity, valid Bun flags,
   and every shell-composition boundary, plus the parity wording assertion;
   run them red.
2. Add a small exact-package and recovery-subcommand classifier to the canonical
   dependency-readiness template; sync the managed dogfood copy.
3. Replace the obsolete parity instruction and make the focused tests green.
4. Run Gherkin lint, template parity, typecheck, and the focused hook/release
   tests.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Recovery boundary | Strict positive shape: environment prefixes already handled by the shared tokenizer; documented boolean Bun flags; exact `safeword` or `safeword@<tag-or-version>` package; exact recovery verb; ordinary CLI arguments containing no shell-evaluation metacharacters. Missing/unknown verbs, package overrides, unknown pre-package flags, and any `$`, backtick, `<`, `>`, or `&` in the segment remain guarded. | Exempt all `bunx`; exempt every Safeword command; enumerate known substitution forms; remove the readiness gate | Broad exemptions lose the safety boundary; enumerating shell forms misses process substitution and future syntax; removing the gate loses existing protection. Figure-it-out evidence: the shared tokenizer handles environment prefixes and standard command-list operators, installed Bun help shows boolean flags plus the value-taking package override, and the CLI catalog defines the four recovery verbs. |
| Proof layer | Table-driven classifier tests plus a real PreToolUse process test | Unit test only; full external agent E2E | The hook process test proves installed wiring at acceptable speed, while the table isolates parsing boundaries without duplicating expensive process fixtures. |

The exported classifier remains the sole predicate consulted by the PreToolUse
hook, so the table-driven parsing contract transfers directly to enforcement.
`npx safeword setup` and package-manager equivalents are already unguarded by
the current known-binary classifier; this change targets the uniquely broad
`bunx` branch that guards every package.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Recovery works without asking a builder to disable a guard; unrelated tooling remains protected. | `features/safeword-recovery-through-dependency-readiness.feature` | |
| 1. Structure enforces; instructions suggest | The exception is enforced by the PreToolUse classifier and proven through the real hook process, not left as recovery prose. | `packages/cli/tests/hooks/dependency-readiness.test.ts` | |
| 5. Clarity before correctness | An explicit four-command allowlist makes the security boundary readable and reviewable. | `packages/cli/templates/hooks/lib/dependency-readiness.ts` | |

Architecture alignment: honors the accepted explicit-project-enrollment
decision by changing behavior only inside the already-enrolled project hook.
No new architectural record is warranted for this local, reversible classifier
policy.

## Known deviations

skip: no deviations planned.

## Doc impact

skip: README and website sources do not currently document the internal
dependency-readiness hook; the feature file and corrected parity recovery text
are the maintained user-facing contract for this slice.

## Assessment triggers

Revisit the allowlist if setup/status/doctor/plan are renamed, if a new
dependency-repair command is added, or if Bun changes `bunx` package/version
argument syntax. Reconsider the classifier boundary if recovery moves to a
non-`bunx` entry point.
