# Impl Plan: Add spike workflow

**Status:** planned

## Approach

The riskiest assumption is that one canonical manual action can preserve the
same spike contract across Claude Code, Cursor, and the generated Codex plugin.
The cheapest load-bearing proof is the distribution scenario: run the real CLI
against a temporary project for project-scoped Claude/Cursor delivery, generate
the profile-scoped Codex catalogue, and inspect all three host surfaces.

Primary proof is the Cucumber feature source at integration scope. Because a
skill is guidance interpreted by a host rather than executable application
logic, charter/routing/manual-selection scenarios are honestly tested as
artifact contract assertions. Delivery and git lifecycle use real CLI and git
entry points. Focused Vitest schema/parity contracts support generated assets.
No external process boundary is mocked; filesystems and repositories use
temporary directories.

| Scenario | Entry point and fixture | Observable proof | Test file |
| --- | --- | --- | --- |
| Complete and incomplete charters | Canonical installed skill text; each missing-field example | Required five-field charter and explicit pre-execution stop contract | `steps/add-spike-workflow.steps.ts` |
| Non-executable uncertainty routes | Canonical installed skill text; three eligibility partitions | Named route and prohibition on experimental code | `steps/add-spike-workflow.steps.ts` |
| Question-sized execution | Canonical installed skill text; three work shapes | One-slice default, bounded comparison exception, feature-wide rejection | `steps/add-spike-workflow.steps.ts` |
| Every result feeds the plan | Canonical installed skill text; three result states | `impl-plan.md` distillation fields for every status | `steps/add-spike-workflow.steps.ts` |
| Experimental code stays disposable | Real temporary git repository, spike branch, and worktrees | production branch starts at pre-spike base, has no spike commits, spike remains unmerged | `steps/add-spike-workflow.steps.ts` |
| Project-host distribution | Real setup in a temporary project | installed Claude/Cursor actions share charter, isolation, and distillation clauses | `steps/add-spike-workflow.steps.ts`; schema/parity Vitest |
| Codex distribution | Real catalogue generator against a temporary output root | generated Codex action carries canonical charter, isolation, and distillation clauses | `steps/add-spike-workflow.steps.ts`; generator/parity Vitest |
| Explicit-invocation contracts | Generated host metadata and guidance catalogue | Claude carries manual-only metadata; Cursor has a command and no spike rule; Codex's generated description and body instruct the agent to require an explicit user request | `steps/add-spike-workflow.steps.ts`; schema/parity Vitest |
| Planning seam and pre-validation rejection | BDD guidance contract with phase fixtures | exact post-validation offer and canonical pre-validation transitions | `steps/add-spike-workflow.steps.ts` |
| Routine feature | BDD guidance contract with no-risk fixture | direct transition to `plan-implementation` | `steps/add-spike-workflow.steps.ts` |

Build order:

1. Make the distribution-parity scenario executable, then add the canonical manual
   `spike` skill, schema registration, Cursor action wrapper, generated Cursor
   command, generated Codex skill, and byte-identical dogfood copy.
2. Make the charter, incomplete-charter, routing, and question-sized scenarios
   executable, then complete the skill's eligibility and bounding contract.
3. Make the outcome-distillation and disposable-code scenarios executable,
   then complete the skill's result report and branch/worktree lifecycle.
4. Make the planning-seam, pre-validation, and routine-feature scenarios
   executable, then add the optional checkpoint to BDD scenario-gate and make
   implementation planning consume spike evidence without adding a phase.
5. Document `/spike` in `README.md` and the website skills reference; regenerate
   host adapters; run targeted behavior, schema, parity, and generator checks.

Surface proof:

- Claude Code: real setup assertion on `.claude/skills/spike/SKILL.md`, whose
  `disable-model-invocation: true` metadata makes invocation explicit.
- Cursor: real setup assertion on `.cursor/commands/spike.md` plus absence of a
  spike rule, making `/spike` the only exposure.
- OpenAI Codex: generated-plugin assertion on
  `packages/cli/codex-plugin/skills/spike/SKILL.md`. Codex generation does not
  preserve Claude-only invocation metadata, so the description and body carry
  the explicit-invocation guard. This is soft host guidance, not a hard hook.
- Safeword CLI: real setup invocation plus schema/parity tests.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Workflow shape | Claude uses `disable-model-invocation: true`; Cursor ships `/spike` as a command and no spike rule; Codex receives an explicit-invocation guard in generated guidance [1] | Automatic skill/rule; canonical BDD phase; new enforcement hook | A spike spends an explicit experiment budget; Codex has no equivalent preserved metadata, and a new hook would add disproportionate machinery to an optional checkpoint. |
| Placement | Offer after scenario validation and before `plan-implementation`; do not invoke automatically [2] | Intake; define-behavior; inside implementation | Earlier phases have not fixed behavior; implementation is too late for evidence meant to shape its plan. |
| Delivery | Canonical template plus schema-owned Cursor command and generated profile-scoped Codex plugin [3] | Project-local Codex setup artifact; hand-maintained per-host copies | Codex delivery is profile-scoped, while existing generators and parity contracts prevent content drift. |
| Evidence lifecycle | Structured result is distilled into existing `impl-plan.md`; significant choices may become ADRs | Permanent spike-specific plan/decision artifacts | Existing planning and ADR lanes already own durable production decisions; another artifact kind would duplicate them. |
| Code lifecycle | Isolated branch/worktree retained unmerged until evidence is distilled; production starts at the pre-spike base | Merge, cherry-pick, or copy spike code | The experiment optimizes for learning speed, not production quality, so reusing it would erase that boundary. |

[1]: `.project/guides/skill-authoring-guide.md` action-skill contract.
[2]: `packages/cli/templates/skills/bdd/SCENARIOS.md` and
`packages/cli/templates/skills/bdd/PLAN_IMPLEMENTATION.md` phase boundary.
[3]: `ARCHITECTURE.md` sections “Schema” and “Profile-Scoped Generated Codex
Plugin and Staged Hook Migration.”

## Arch alignment

- Schema as Single Source of Truth: every installed skill/command is registered
  in `packages/cli/src/schema.ts`.
- Profile-Scoped Generated Codex Plugin and Staged Hook Migration: Codex content
  is generated from canonical templates rather than maintained independently.
- Plan Implementation Phase: spike evidence enters the existing implementation
  design record and does not create a competing planning phase.

No new ADR: these choices extend existing delivery and BDD decisions without a
new structural, difficult-to-reverse architecture commitment.

## Known deviations

skip: no deviations planned

## Doc impact

- Add `/spike` to the action list in `README.md`.
- Add `/spike` to `packages/website/src/content/docs/reference/hooks-and-skills.mdx`.

## Assessment triggers

- A supported host gains a native isolated-experiment primitive that can replace
  the portable git worktree guidance.
- Spike execution becomes common enough to justify hard lifecycle enforcement
  or a canonical BDD phase.
- Evidence loss in real sessions shows that direct distillation into
  `impl-plan.md` needs a durable intermediate artifact.
- A host cannot represent manual-only invocation or equivalent action content.
