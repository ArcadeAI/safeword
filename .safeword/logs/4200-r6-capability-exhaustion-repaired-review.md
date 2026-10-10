# R6 qualification refusal and permitted fallback repair

Review the bounded explicit-selector preflight correction against accepted R6.
The exact current ordered-pair catalogue is the authority. Requested model and
predicted provider can refuse a route before launch; they cannot authorize
approval. Actual runtime identity remains checked after eligible invocation.
Runtime-default selectors, unknown-author hosts, nonplanning and unverified
OpenCode provider handling retain their existing behaviour.

Prior source review 63405f79-daef-4a4b-a69c-cb05751e21e4 requested changes:
qualification skips prevented permitted fallback and lost capability recovery.
The repair treats only attempted independent failures or explicit typed
unknown/weaker qualification skips as exhaustion. Unattempted, unavailable,
and unrelated skipped candidates do not satisfy that condition. Both the
coordinator and persisted authenticated-job validator enforce this distinction.
No skipped route is reported as a producer invocation or network effect.
Prefer can advance to headless, then host fresh-context fallback; require remains
blocked with capability diagnostic and exact-model recovery. Other route ordering,
sealed packet/current-source identity, and host continuation controls remain.

Executable RED receipt de810605-97d7-448e-aae4-52fb8aaafa2a approved the actual
attested one-pass/one-failure command. RED commit 77b816af3 preserves the initial
non-probe launch and requested-model discrimination. The real installed CLI,
actual project config, registry and catalogue are exercised; only producer
processes are mocked. The weaker integration fixture deliberately mocks its
catalogue to test that branch; it does not complete real-catalogue root proof.

Current verification: /tmp/4200-r6-preflight-refactored-green.log reports 93/93
package tests in route-order, weaker-route and persisted job suites. Root selected
regression /tmp/4200-r6-preflight-sealed-root-selected.json reports eleven passed
scenarios, 627 passed steps. A prior incorrect row filter also selected two
unbound weaker cases: /tmp/4200-r6-preflight-sealed-root.json reports six passed,
two undefined; retain it as incomplete evidence, not a passing run. Broader
fallback controls are running and have no claimed result in this packet.
Lint and all three package typechecks pass. All five generated surfaces were
refreshed and verified in /tmp/4200-r6-preflight-sealed-generated.log. Generated
runtime bundles are deterministic carriers; full raw-bundle review is not claimed.
The earlier full normal suite was interrupted after the real regression was
found, exit 130, and is not passing evidence. Full normal verification must rerun
against this final repair. Historical acceptance failures, unbound scenarios,
RGR and named deferrals remain open. No Ready/merge authority is inferred.

Review angles: exact catalogue authority vs requested identity; bounded fallback
exhaustion in coordinator and persisted validator; producer/network effects;
require-mode diagnostic; default/nonplanning and host-authentication regressions;
actor-facing test discrimination and scope. Current principles/persona/surface
claims are those in the accepted Implementation Plan: authority before claims,
honest reduced fallback, bounded user-controlled workflow. Report actual errors;
optional new qualification or host mechanisms are outside this correction.
