# Choose sufficient, maintainable test boundaries

## Investigation plan

- [x] Phase 1: Frame the decision.
- [x] Phase 2: Generate concrete options.
- [x] Phase 3a: Enumerate research domains.
- [x] Phase 3b: Research each domain.
- [x] Phase 4: Debate and commit to one design.

Decision: how to repair the assessed TDD and BDD proof gaps without replacing
semantic evidence with fake verdicts or duplicating the same CLI fixtures.
A choice is wrong if a promised outcome can fail while its admitted proof stays
green, or if the suite becomes costly and opaque without added confidence.

## Options

1. Expand direct Cucumber step definitions for every example. Smallest form:
   dedicated state/action/assertion glue for the identified checklist and slicing
   cases, using real CLI invocations and an external-process reviewer fixture.
2. Reuse the existing Vitest proof mechanism with strict actor-boundary tests,
   and separate opt-in live semantic evidence. Smallest form: reuse real CLI
   fixture builders, repair each mapping to the precise observable outcome,
   and route genuinely semantic scenarios to the existing real-reviewer matrix.
3. Replace the adapters and proof manifests with a new shared scenario runner.
   Smallest form: one case registry drives Gherkin rows, setup, CLI invocations,
   assertions, and evidence. This has the broadest migration/ownership cost.

## Research questions

- Behavior specification: what makes an example discriminating, and when may
  lower-level proof support a scenario without proving its actor-facing claim?
- CLI integration: how can fixture reuse preserve argv, process exits, artifact
  changes and authenticated receipt behavior while faking only the external edge?
- Semantic evaluation: what needs a real reviewer, which acceptance partitions
  must run, and how should opt-in results distinguish absence from failure?
- Assertion and mutation quality: how should independent expected snapshots,
  positive controls and targeted mutations expose a false pass?

The current repository owners and pinned Cucumber/Vitest versions constrain
implementation. No new dependency or blanket scenario weakening is intended.

## Evidence and choice

Cucumber's [Gherkin reference](https://cucumber.io/docs/gherkin/reference/)
defines Then as an observable output and substitutes each Examples row before
step matching. Its [dry-run documentation](https://github.com/cucumber/cucumber-js/blob/main/docs/dry_run.md)
explicitly excludes hook/step execution, so binding checks cannot supply proof.
Vitest [5.0.3 assertions](https://github.com/vitest-dev/vitest/blob/v5.0.3/docs/api/expect.md)
compare object structure at assertion time: preservation requires an independent
pre-call expected snapshot, not the input reference after a call.
[Stryker](https://stryker-mutator.io/docs/) tests test discrimination by changing
implementation and observing failing tests. Use focused deliberate faults with
actual tests; do not call standalone probes a full mutation score.
Anthropic's [agent evaluation guidance](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
separates outcomes/transcripts from graders, supporting deterministic command
proof alongside real reviewer evidence for semantic judgments.

Option 1 makes each Gherkin action visible but duplicates existing receipt,
process, cleanup and CLI setup; deterministic reviewer fixtures still cannot
prove semantic judgment. Option 3 centralizes data but requires migrating a
working framework and creates another abstraction to maintain.

Choose option 2: strengthen actual CLI tests with existing fixture machinery,
bind each deterministic example to its observable assertion, and run semantic
examples through the existing opt-in live reviewer matrix instead of corpus
metadata. Keep parser matrices low-level and add one real-collaborator
Markdown-to-definition-to-validator round trip. Preserve accepted scenario
outcomes; do not rewrite them merely to fit current code.

**Premortem:** shared proofs drift from Examples rows; mitigate with explicit
case identities, row-aligned outcomes, and deliberate-fault checks.

**Next:** strengthen the TDD preservation snapshot and round-trip tests, then
repair CLI evidence and semantic scenario routing.

## Independent challenge and implementation

The user authorized implementing the assessment's suggested improvements.
Independent scenario review of the first repair found confounded semantic
fixtures: missing slice fields also lacked unrelated obligation proof. Repair
the conformance data using single omissions from an approvable baseline, and
require the same reviewer finding to identify the slice and missing field.
An unresolved authorization design must return to Implementation Planning;
the fixture now makes that unresolved approach explicit.

An initial attempt to edit the production corpus invalidated its admission
digest. The CLI correctly refused all 63 cases before dispatch. A headless
qualification attempt then exposed inherited incomplete approval fixtures.
That would turn test hardening into a change to production route admission.

Keep the strengthened acceptance variants in test fixtures instead. The live
adapter explicitly opts into those variants, and their result IDs use an
`acceptance:` prefix that the admission builder rejects. Production corpus,
admission evidence and route policy remain unchanged. The original lane retains
its own fixtures and result IDs. This keeps test improvements surgical without
silently treating previous qualification as evidence for new fixtures.

Two new CLI table declarations are shared across related checklist scenarios.
The proof-registration ratchet changes from 73 to 75 shared declarations,
with the maximum fan-in unchanged at 14. Each selected row still owns distinct
setup and assertions. Splitting duplicate tests merely to satisfy a declaration
counter would obscure the common boundary without increasing discrimination.
Independent review must assess this intentional baseline change.

Acceptance variants also replace evaluator descriptions with ordinary accepted
product scenarios, keeping expected verdicts and defect labels out of reviewer
context. A guard checks that separation. The first live preflight exposed a
fixture mistake: deleting only a `Proof:` label still left complete proof
procedures in the slice. The missing-proof variant now genuinely omits the
slice's verification procedure; the rejection expectation was not relaxed.
The next live run demonstrated the same distinction for four other fields:
removing a label left its meaning inferable from the tasks. Those variants now
retain the approvable baseline and mark exactly one field `Not specified.`
The expectation remains a named semantic denial, rather than invalid output.
Live selectors require a boundary before the case ID, preventing a
`missing-completion-signal` selection from also running
`migration-missing-completion-signal`.

The second checklist scenario review requested explicit missing-detail
rejections. Add two real CLI cases (blank not-applicable reason and unnamed
human dependency), preserve plan/ledger bytes, and name the required repair.
The existing parser already rejects them; only its diagnostic needed detail.

The acceptance bank contains only its 27 owned cases, not transformed copies of
unrelated qualification cases. The namespace rejection test uses the complete
original 63-case ID set with a passing positive control, so an extra acceptance
case cannot accidentally satisfy the rejection assertion.

**Next:** verify the final deterministic and live proofs, collect fresh
independent judgments, and push the existing Draft PR without promotion.
