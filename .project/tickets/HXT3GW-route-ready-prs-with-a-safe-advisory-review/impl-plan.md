# Impl Plan: Route ready PRs with a safe advisory review

**Status:** planned

## Approach

The riskiest assumption is that one base-branch workflow can inspect every
changed text artifact and publish a useful receipt while keeping model access,
GitHub write authority, and untrusted code execution structurally separate. The
cheapest proof is the fork scenario: a workflow-contract test must show no
checkout/execution step, no write permission on inspection, no model secret on
publication, and a strict JSON-only handoff before any provider integration is
built.

### Proof plan

| Behavior | Primary proof | Supporting proof |
| --- | --- | --- |
| Eligible exact-head review; ineligible/duplicate/coalesced triggers | Integration tests around trigger claim and injected ordering | Pure eligibility and claim reducer unit matrix |
| Recognized and unfamiliar text reach the same reviewer | Integration test with a fake GitHub client and fake provider | Evidence-budget/parser unit tests |
| Flux access regression routes human | Guarded live eval | Deterministic fake-provider scenario for the same finding |
| Conservative route states | Unit table over every run-state/finding/unknown/head combination | Result-schema property/boundary tests |
| Every new SHA forces fresh review; mid-run change becomes stale | Integration tests with injected head progression | Freshness reducer unit tests |
| Receipt evidence, unknown usage, and actionable findings | Renderer snapshot/semantic tests | Strict artifact parser tests |
| Fork data-only privilege separation | Workflow-contract integration test | Forbidden endpoint/action sentinel tests |
| Receipt cannot affect merge eligibility | Publisher integration test allowing only issue-comment endpoints | Guarded disposable-repository smoke |

The live GitHub smoke is opt-in because workflow files must exist on the default
branch of a disposable repository. When unavailable, verification records that
surface as skipped; deterministic workflow and endpoint tests remain required.

### Affected-surface proof

- **Safeword CLI:** a wiring test invokes the real `review-pr` command with real
  config/result parsers and fake network/provider adapters; unit-only collaborator
  mocks do not count as entry-point proof.
- **GitHub pull request conversation:** workflow-contract and publisher tests
  prove event/permissions/endpoints/marker updates; optional disposable smoke
  proves GitHub renders the ordinary comment without review/check side effects.

### Environment mapping

- TypeScript pack: strict boundary parsing, result unions, native fetch, and
  Vitest apply across every deterministic scenario.
- GitHub Actions YAML: schema registration, template/dogfood parity, permissions,
  triggers, concurrency, and forbidden-step contract tests.
- Gherkin: live-model and live-GitHub scenarios stay explicitly tagged outside
  deterministic CI.

### Build order

1. **Privilege skeleton first:** add failing workflow-contract tests for trigger,
   per-job permissions, no checkout/execution, secret separation, JSON artifact,
   concurrency, and ordinary-comment-only publication; add the template/schema
   entries only until those tests pass.
2. **Contracts and route core:** add schema-v1 types/parsers, route/freshness
   reducers, config parsing, caps, and their complete unit matrices.
3. **Evidence-to-model slice:** add read-only GitHub evidence acquisition,
   provider interface, explicit OpenAI Responses adapter, prompt, and the real
   CLI inspection wiring test; run the deterministic unfamiliar-artifact test.
4. **Publisher slice:** validate the artifact and identity again, re-check the
   head, render/update the marker-owned issue comment, and prove the endpoint
   allow-list plus stale downgrade.
5. **Workflow end to end:** wire invalidate → prerequisites → inspect → publish;
   add injected-order integration coverage for duplicate/concurrent/new-head
   behavior and converge dogfood templates through setup.
6. **Evaluation and docs:** run the selected Flux eval, optionally run the
   disposable GitHub smoke, then update README and website CLI/config docs.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| MVP scope | Full fresh advisory review and one ordinary receipt; no execution, inline comments, or reuse | Current all-in-one plan; deterministic triage only | Full plan couples three security/state clusters; deterministic-only misses #1909's unfamiliar-artifact value |
| Privileged workflow | One `pull_request_target` workflow with job-scoped capabilities and no checkout | #1917 workflow pair; one write-capable process; `workflow_run` bundle | A single process weakens capability absence; one bundle completion does not mean all repo prerequisites settled; MVP does not need a second workflow |
| Freshness | Re-review every new SHA and re-check immediately before publish | Materiality classifier and freshness bridge | Classification is an optimization with its own evidence contract, not required for safe value |
| Publication | Update one ordinary issue comment | Check run, review/approval, status | GitHub counts neutral/skipped checks as successful; review/check surfaces can affect policy |
| Model boundary | Explicit OpenAI Responses adapter, configured model, strict JSON Schema, no tools, native fetch | SDK dependency; reviewer CLI; inferred provider | One endpoint does not justify a dependency; runner CLI bootstrap/auth is not present; inference hides customer policy |
| Handoff | Strict bounded schema-v1 JSON artifact, validated by producer and publisher | Free-form markdown or executable bundle | Publisher must receive evidence only and reject identity/size/state mismatches |

Evidence: GitHub's secure-use guidance forbids untrusted checkout in privileged
triggers; workflow syntax supports job-level permissions; required-check docs
treat `neutral` and `skipped` as successful; issue comments are distinct from
review comments; OpenAI Responses supports strict JSON Schema output and no-tool
operation. See links in `design.md`.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | One plain route and next action lead; exact evidence/usage/unknowns remain in the receipt | Receipt renderer tests and `design.md` data model | |
| 1. Structure enforces; instructions suggest | Job permissions, absent checkout, strict result parser, and endpoint allow-list make forbidden authority unavailable | Workflow-contract and publisher tests | |
| 2. Fire at boundaries, not every turn | Review starts only at PR readiness/head boundaries and publishes once per terminal attempt | Trigger/concurrency integration tests | |
| 3. Add, never replace | Default-off schema-managed workflow is reconciled without replacing customer workflows/config | Schema and reconcile tests | |
| 5. Clarity before correctness | One result vocabulary and route reducer drive CLI, workflow, receipt, and tests | Route matrix and real CLI wiring test | |

Architecture decisions honored:

- Schema as single source of truth and reconciliation over copy.
- Typed CLI Execution and Discovery.
- Release privilege-separation precedent.
- Advisory PR Review as a Split-Privilege Evidence Pipeline, revised to the
  phased HXT3GW → Z7M7Y3 → 436EQW delivery.

## Known deviations

- The MVP publishes receipt findings with stable `path:line` locations rather
  than GitHub inline review comments. Z7M7Y3 adds exact-SHA inline publication
  after the result schema is proven.
- The provider boundary initially has one OpenAI adapter. Cross-vendor/model
  selection and efficacy policy remain in #1910-#1915.
- The workflow deliberately performs no customer-code execution; all displayed
  model remedies remain unverified until 436EQW.
- A real GitHub write smoke is conditional on an opt-in disposable fixture and
  must be recorded as skipped when unavailable.

## Doc impact

- `README.md`: default-off reviewer, one-receipt UX, evidence boundary, and
  explicit non-approval/non-execution language.
- `packages/website/src/content/docs/reference/cli.mdx`: `review-pr` stages,
  result states, diagnostics, and exit behavior.
- `packages/website/src/content/docs/reference/configuration.mdx`: enablement,
  provider/model, secret name, evidence caps, prerequisite behavior, fork safety,
  and the always-re-review MVP freshness policy.

These are build-order slice 6 and must match the shipped parser/workflow names.

## Assessment triggers

- GitHub changes `pull_request_target`, job permissions, required-check
  conclusions, concurrency cancellation, artifacts, or issue-comment semantics.
- Evidence caps route an unacceptable share of real PRs to incomplete.
- Repeated model cost/noise materially harms adoption; start Z7M7Y3 rather than
  weakening the MVP freshness rule in place.
- A second provider ships or #1910-#1915 selects vendor/model policy.
- Any execution or verified-remedy requirement appears; stop and route it to
  436EQW rather than expanding this workflow's authority.
