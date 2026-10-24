# Currency diagnostic correction

The complete acceptance run exercised all 17 cases: 16 passed and one failed at
the changed-source recovery diagnostic. It reached every case with no undefined
or pending steps. The complete raw message stream and failure summary remain
preserved in acceptance-diagnostic-failure.*. Original-history preservation,
scope refusal, Work Log currency and non-input audit currency passed in that run.

The first trusted single-row RED attempt timed out in the shared queue and was
rejected; it earns no RED credit. Trusted retry b7a05540 independently approved
the actual failing source-change row: exit 1, no signal or timeout, successful
observation setup, public verification exit 2/current=false, then the wrong-input
diagnostic assertion failed. Its receipt covers that row, not missing historical
RED or unrelated observer scenarios.

Commit 476641567 changes only comparison priority: raw product file/mode keys,
then project file/mode keys, then aggregate/dependency/tool identities. Every
identity remains compared. Native bundles and the reviewed reader pin were
regenerated through their normal generators.

All four accepted currency examples now pass: 4 scenarios and 24 steps, with
the original assertions unchanged. See currency-fix-green.log and its retained
message stream. The full 17-case sequence was not repeated after this diagnostic
ordering correction; the affected four cases were rerun together. Current
ordinary regression and the final clean-checkout pilot remain separate proofs.

Fresh cross-agent Claude/opus review 3a70d81c approved the correction with no
errors. Its requests for GREEN evidence and sibling scope/Work Log/audit proof
are answered by this four-case run. The refreshed reader pin and conservative
loaded-reader fallback pass the current six-control standalone run, alongside
private-copy executable-mode and external-runtime controls. Full lint, Gherkin
lint and typechecking also pass after the correction.

The trusted RED review's signal-specificity and synchronous-step timing warnings
remain limits. The attestation itself contained the actual wrong-input message;
an empty or unrelated message was not accepted as this failure. Harness Node
compatibility metadata is distinct from the observer's resolved pinned tool;
the real proof checked Node 24.18.1 and Bun 1.3.14. No timeout, environment queue,
passing binding or old characterization is relabeled as product RED.

The original 42 unchecked R/G/R entries plus cross-scenario and all 33 deferred
objects stay unchanged and uncredited. The new observer ledger also retains
unearned entries; execution and diagnostic repair do not authorize ticket
completion, certification, branch-review approval, merge or qualification.
