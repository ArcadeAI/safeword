---
id: FZTWG0
slug: opencode-independent-review-fallback
type: feature
phase: done
status: done
phase_anchors:
  - "define-behavior: .project/tickets/FZTWG0-opencode-independent-review-fallback/spec.md"
  - "scenario-gate: packages/cli/features/opencode-independent-review-fallback.feature"
  - "plan-implementation: packages/cli/features/opencode-independent-review-fallback.feature"
  - "implement: .project/tickets/FZTWG0-opencode-independent-review-fallback/impl-plan.md"
  - "verify: .project/tickets/FZTWG0-opencode-independent-review-fallback/verify.md"
  - "done: .project/tickets/FZTWG0-opencode-independent-review-fallback/verify.md"
scope:
  - recognize OpenCode as both a review-capable agent and an author runtime
  - preserve the Claude-to-Codex and Codex-to-Claude preferred independent routes
  - try OpenCode as an independent fallback before any same-author degraded review
  - route OpenCode-authored work to Claude and then Codex without counting OpenCode self-review as independent
  - run OpenCode headlessly with denied tool permissions, bounded output, typed provenance, and the shared review deadline
out_of_scope:
  - changing the preferred Claude-to-Codex or Codex-to-Claude reviewer pairing
  - treating Cursor-authored or unknown-author work as newly supported review routes
  - counting a same-runtime review as independent
  - relying on OpenCode Desktop or a long-lived OpenCode server
  - choosing or provisioning a user's OpenCode model or provider credentials
done_when:
  - a Claude- or Codex-authored review falls back to an available OpenCode CLI when its preferred independent reviewer routes cannot complete
  - OpenCode-authored work receives an independent Claude review with Codex as its next independent fallback
  - OpenCode review output is accepted only when its closed result and dispatch provenance validate
  - OpenCode review runs cannot use tools or mutate the source or disposable packet and share the existing timeout and output bounds
  - exhausted routes still report that no independent check was recorded and preserve the existing policy behavior
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-09-01T04:03:17.898Z
last_modified: 2026-09-01T04:03:17.898Z
---

# Keep independent review available through OpenCode

**Goal:** Use OpenCode as an independent review option and fallback without weakening review provenance or read-only guarantees.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-01T04:03:17.898Z Started: Created ticket FZTWG0
- 2026-09-01T04:03:00.298Z Intake: Confirmed OpenCode as a third independent reviewer and fallback while preserving the existing preferred pairings, independence rule, and bounded read-only contract.
- 2026-09-01T04:03:00.298Z Define behavior: Accepted the bounded job and four routing/trust rules with no open product questions.
- 2026-09-01T04:07:30.065Z Scenario gate: Alex confirmed the 14-scenario set covering preferred routes, independent fallbacks, degraded policy behavior, provenance, side effects, and execution bounds.
- 2026-09-01T04:10:30.000Z Scenario gate: Independent Claude review requested one policy-binding fix and five proof-strength improvements; revised the OpenCode-author policy outline, real-command wiring case, funded-route precondition, failure partitions, evidence assertion, and timeout wording.
- 2026-09-01T04:14:00.000Z Scenario gate: Second independent review exposed an uncovered preferred-route retry boundary; added retry, require-policy success, unsupported-author, and OpenCode-author command-wiring scenarios and strengthened provenance reporting.
- 2026-09-01T04:17:00.000Z Scenario gate: Third independent review found duplicate Rule lineage; promoted unsupported authors to R5, moved deadline ownership to R2, and made fallback suppression, blocked status, and tool-denial evidence explicit.
- 2026-09-01T04:21:00.000Z Scenario gate: Fourth independent review tightened the unfunded-route precondition and real OpenCode permission proof; added failed-process coverage and deterministic mutation/timeout setup.
- 2026-09-01T04:24:00.000Z Scenario gate: Independent Claude/Opus review approved all 18 scenarios with cross-agent provenance; recorded the phase stamp and carried four non-blocking proof notes into planning.
- 2026-09-01T04:24:00.000Z Plan implementation: Kept one cohesive feature despite the 18-scenario split prompt because runtime parsing, identity, routing, and public result projection form one atomic review route.
- 2026-09-01T04:31:00.000Z Scenario gate: Returned for independent review because proof-oriented scenario wording changed after the prior approval stamp.
- 2026-09-01T04:36:00.000Z Scenario gate: Independent Claude/Opus review approved the 18 scenarios with no blocking issue; applied all six strengthening notes by adding the exact minimum-budget boundary and oversized-output case, tightening command-level blocked proof, runtime tags, author context, and self-route suppression.
- 2026-09-01T04:40:00.000Z Scenario gate: Follow-up independent review approved all 20 scenarios; resolved its four strengthening notes by separating tool denial from evidence validity, making the tool request deterministic, binding preferred-route reviewer metadata, and adding a real-command mismatched-dispatch rejection.
- 2026-09-01T04:44:00.000Z Scenario gate: Third follow-up review approved all 21 scenarios; resolved the final strengthening notes by making unsupported-author reporting positive, aligning surface tags, recording the real-runtime denial proof boundary, and specifying prefer/require outcomes when no route budget remains.
- 2026-09-01T04:47:00.000Z Scenario gate: Fourth follow-up review approved all 21 scenarios; resolved its three remaining notes by making the exhausted-clock precondition apply to every further route, narrowing the controlled tool scenario to the invocation contract, and separating source-staleness from packet-integrity failure.
- 2026-09-01T04:50:00.000Z Scenario gate: Fifth review caught one command-wiring gap; moved required-policy success and both deadline boundaries through the real command, made degraded feedback/provenance observable, and simplified the deny-tools scenario to its honest invocation boundary.
- 2026-09-01T04:54:00.000Z Scenario gate: Sixth review approved all 22 scenarios; applied its strengthening notes by covering terminal preferred failure, making denied-tool output handling explicit, completing route preconditions, and forbidding simultaneous OpenCode self-review on the Codex fallback path.
- 2026-09-01T04:58:00.000Z Scenario gate: Final independent Claude/Opus pass approved all 23 synchronized scenarios with no blocking findings; recorded the cross-agent stamp and advanced to implementation planning.
- 2026-09-01T05:00:00.000Z Plan implementation: Independent review found a load-bearing command-proof downgrade; reassigned all five command-scoped scenarios to public `review run` tests and tightened unsupported-author, exact-budget, terminal-failure, live-CI, read-only, and architecture-record evidence.
- 2026-09-01T05:04:00.000Z Plan implementation: Second review found route-level timeout/failure proof was still too low; added coordinator evidence, explicit stamp-ledger parity proof, distinct invalid-output/provenance classifications, the observed routes-exhausted exit baseline, both author directions, and the applicable best-available-review principle.
- 2026-09-01T05:08:00.000Z Plan implementation: Third review found the new stamp proof lacked its negative independence case; added same-runtime rejection in both ledger copies, route-level denied-tool evidence, distinct discovery/capability failures, explicit no-self-review on Codex fallback, resolved website paths, and clarified inherited degraded provenance versus usable completion.
- 2026-09-01T05:12:00.000Z Plan implementation: Fourth review exposed the cross-model ambiguity for user-selected OpenCode models; specified verified-model-or-absent stamping with fail-closed cross-model behavior, a single non-retried OpenCode attempt, a dated in-place architecture amendment, exact healthy/approved prefer semantics, and a fail-closed `--pure` proof contingency.
- 2026-09-01T05:16:00.000Z Plan implementation: Fifth review found non-launch assertions were still implicit; added invocation-count proofs for preferred success/retry and unfunded routes, named the release-contract lane, and added both plugin-generation commands.
- 2026-09-01T05:20:00.000Z Plan implementation: Final independent Claude/Opus review approved the parse-valid planned design; stamped the plan and advanced to implement with the real pinned-process proof first.
- 2026-09-01T07:18:00.000Z Quality review: Independent Claude/Opus review approved the implementation after preserving complete attempted-route evidence, naming OpenCode in exhausted-route feedback, correcting deadline documentation, and strengthening public-command required-policy coverage. Review IDs: c202ba1e-364d-4dad-803b-a19c61781d62, 2e2db343-231b-4f10-925f-c9b3e13ac7ca.
- 2026-09-01T07:22:00.000Z Refactor: No change warranted; explicit preferred, alternate-model, and OpenCode route state is load-bearing provenance rather than accidental duplication.
- 2026-09-01T07:24:00.000Z Verify: Red. Full verification recorded 12 test failures, the Gherkin lane has 30 undefined OpenCode scenarios plus stale envelope-schema expectations, and the R/G/R ledger remains 0/69. Builds and JS/TS/Astro checks passed.
- 2026-09-01T07:27:00.000Z Audit: Red. Dependency boundaries and diff hygiene passed; six implementation-plan principle traces have dead or unresolved evidence, and executable Gherkin coverage is missing.
- 2026-09-01T08:50:00.000Z Implement reconciliation: Tagged the approved scenario source as Vitest-backed per the proof plan, added command-level mismatched-dispatch coverage, refreshed lifecycle fixtures, stabilized profile setup, repaired principle evidence references, and reconciled 23/23 scenario rows. No recorded decision changed and no design deviation was introduced.
- 2026-09-01T12:00:00.000Z Verify: Passed. The combined monorepo run recorded 9,045 passing tests and 14 skips; two contention-sensitive failures from the broad run passed through focused authoritative reruns (51/51 review/lock tests). BDD proof provenance, builds, TypeScript/Astro checks, formatting, and diff hygiene are green.
- 2026-09-01T12:03:00.000Z Audit: Passed for FZTWG0. Dependency-cruiser found no violations across 138 modules and 276 dependencies; documentation and Gherkin lint were clean; the ticket's principle trace passed. E010 findings emitted for CKWE2D and 3F5Z6P are unrelated active-ticket debt.
- 2026-09-01T12:04:00.000Z Done: OpenCode is available as the bounded independent fallback, OpenCode-authored work routes to other runtimes, and invalid provenance, mutation, timeout, and exhausted-route outcomes fail closed.
