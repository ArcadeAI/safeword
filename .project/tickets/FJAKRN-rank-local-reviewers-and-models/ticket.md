---
id: FJAKRN
slug: rank-local-reviewers-and-models
type: feature
phase: verify
status: in_progress
scope:
  - configure an ordered reviewer/model route list per supported author runtime
  - preserve reviewer independence and classify every same-author route as degraded
  - validate model identifiers and report local runtime/model evidence without paid probes
  - compile legacy primary/alternate settings into current behavior when no route list exists
out_of_scope:
  - automatically ranking model quality or maintaining a model-strength database
  - proving credentials or inference readiness without a bounded review attempt
  - reordering or suppressing configured routes from cached observations
  - adding Cursor or unknown authors to review routing
done_when:
  - review attempts follow configured reviewer/model order exactly
  - invalid routes fail configuration instead of selecting a runtime default
  - same-author routes stay degraded and cannot satisfy independent-review policy
  - absent route configuration preserves existing routing and model behavior
  - local status distinguishes inspection evidence from successful review proof
inspiration_contract: v1
inspiration_contract_scaffold: v1
created: 2026-09-01T23:21:41.787Z
last_modified: 2026-09-01T23:21:41.787Z
---

# Let users rank local reviewers and models

**Goal:** Detect usable local review routes and follow a user-defined reviewer/model fallback order.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-09-01T23:21:41.787Z Started: Created ticket FJAKRN
- 2026-09-01T23:24:00.000Z Intake: User approved the independently reviewed ordered-route proposal. Model-strength ranking, paid readiness probes, cache-driven ordering, and new author runtimes remain out of scope.
- 2026-09-01T23:30:00.000Z Define behavior: Derived six dimensions and seven atomic scenarios covering happy path, invalid input, degraded independence, deadline exhaustion, honest evidence, and legacy compatibility.
- 2026-09-01T23:37:00.000Z Scenario gate: Independent review requested discriminating cache order, concrete legacy oracles, and public-command launch proof. Expanded to twelve scenarios and applied all boundary, evidence, and surface-tag strengthening notes.
- 2026-09-01T23:43:00.000Z Scenario gate: Second review found three constant implementations. Added reverse order, last-position degradation, absent-catalogue evidence, split legacy author rows, and separated runtime-wide failure into R4.
- 2026-09-01T23:48:00.000Z Scenario gate: Third review bound runtime-wide route evidence and the known-failure state, and tightened public command and ordering preconditions.
- 2026-09-01T23:53:00.000Z Scenario gate: Fourth review added positive independent success, attempt-only retry, and installed-but-incompatible discriminators; aligned all status and review paths to public commands.
- 2026-09-01T23:58:00.000Z Scenario gate: Fifth review bound new-route precedence over legacy settings and moved configuration rejection proof through the public command with zero launches.
- 2026-09-02T00:03:00.000Z Scenario gate: Sixth review repaired Rule lineage, paired rejection paths with a funded launch, added missing-runtime status, and made R3/R4 public-command proof explicit.
- 2026-09-02T00:08:00.000Z Scenario gate: Seventh review replaced the last planner-state assertion with the observable independent follow-on and recorded success.
- 2026-09-02T00:13:00.000Z Scenario gate: Eighth review resolved the final open contract by requiring the chain to skip an unfunded route and attempt the next fundable route.
- 2026-09-02T00:18:00.000Z Scenario gate: Ninth independent Claude review approved all 22 scenarios with no blocking findings. Review ID 14eb04ec-29e4-4700-89e8-345b6b7bc5c8; cross-agent stamp recorded.
- 2026-09-02T00:23:00.000Z Plan implementation: Independent review required policy-independent same-author continuation and explicit supersession of the fixed-route architecture clause; both are now load-bearing plan decisions.
- 2026-09-02T00:28:00.000Z Plan implementation: Second review required inspection failures to remain unknown rather than become false negative evidence; added explicit timeout/parse states, offline behavior, unknown-key rejection, and zero-launch public proof.
- 2026-09-02T00:33:00.000Z Plan implementation: Third review exposed an unfunded-route scenario that required nonexistent per-route cost estimates. Returned to scenario-gate to use the shared deadline's existing stop-and-report semantics.
- 2026-09-02T00:38:00.000Z Scenario gate: Independent re-review approved the simplified shared-deadline contract with no blocking findings. Review ID 92674fec-20c7-4538-ad15-c9bb387c1ecc; cross-agent stamp refreshed.
- 2026-09-02T00:43:00.000Z Plan implementation: Verified the pinned OpenCode 1.18.23 binary exposes `models --pure` with provider-qualified identifiers; added exact-version conformance, failure taxonomy, exact route evidence, shared funding rule, and status latency/offline bounds.
- 2026-09-02T00:48:00.000Z Plan implementation: Fourth review closed pre-change evidence ambiguity: records without exact model/default identity prove no route. Also preserved earlier degraded success for prefer-policy exhaustion and named the cache-order discriminator.
- 2026-09-02T00:53:00.000Z Plan implementation: Fifth review elevated legacy compatibility to three public-command process-boundary tests, defined runtime-default and invalid-config status output, and cited the existing minimum-route funding gate.
- 2026-09-02T00:58:00.000Z Plan implementation: Independent Claude review approved the final plan with no blocking findings. Review ID 2360c307-0dfa-4572-911b-44d14c7df9ac; cross-agent stamp recorded. Advanced to implementation.
