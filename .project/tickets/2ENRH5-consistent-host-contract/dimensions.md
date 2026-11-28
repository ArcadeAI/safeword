# Dimensions: Reduce duplicated maintenance and agent drift

Prepared from the accepted scope after the requested fresh-reader check found
no missing intent or compatibility decisions. This is the scenario-authoring
coverage model, not an accepted scenario set or implementation plan.
Rule IDs below have the `consistent-host-contract.` prefix.

| Dimension                               | Material partitions and boundaries                                                                                                                                                                                                                                           | Rules            |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| Authoritative change                    | Existing shared skill changes; existing policy changes; a change needs a genuinely new host capability                                                                                                                                                                       | SWM1.R1, SWM1.R2 |
| Delivery mechanism                      | Host loads bundled assets directly; host requires generated format/path translation; compatibility bridge would duplicate native registration                                                                                                                                | SWM1.R1, TBU2.R1 |
| Supported inventory coverage            | Every host lane and shipped component accounted for; OpenCode V2 CLI and TUI require separate dispositions; retired V1 cannot be selected or required; one disposition missing; newly added skill or handler omitted; session-end, asynchronous, and shell handlers included | SWM1.R2          |
| Maintenance reduction                   | Parallel authored policy removed; generated output replaces manual edits; new interface leaves equivalent per-host policy intact                                                                                                                                             | SWM1.R1, SWM1.R3 |
| Drift checks                            | Fresh derived output; stale content; canonical input changes without regenerated required output; repair restores agreement                                                                                                                                                  | SWM1.R3          |
| Policy boundary                         | Shared decision governs host dispatch; host bypasses decision; adapter owns an independent copy of shared policy                                                                                                                                                             | SWM1.R3          |
| Available mechanism                     | Verified required guarantee; multiple satisfying mechanisms; weaker centrally permitted alternative; weaker unpermitted alternative; no satisfying mechanism                                                                                                                 | TBU1.R1, NTB1.R2 |
| Completion outcome                      | Ticket transition rejection; conversation continuation; observational event only; continuation limit reached                                                                                                                                                                 | TBU1.R1, TBU1.R2 |
| Activation and trust                    | Active verified integration; disabled or untrusted hook; missing plugin; runtime failure                                                                                                                                                                                     | TBU1.R2          |
| Evidence applicability                  | Exact recorded host/package/configuration; changed host version; changed delivery; changed trust/configuration; unknown proof                                                                                                                                                | TBU1.R2, SWM1.R2 |
| Registration failure                    | Host accepts expected payload; changed host schema rejects required registration; optional registration fails while required behavior survives                                                                                                                               | TBU1.R2, TBU2.R1 |
| User coordination                       | Routine adaptation succeeds without questions; actionable guarantee limitation; real authorization or product decision required                                                                                                                                              | NTB1.R1, NTB1.R2 |
| Native packaging                        | Existing Claude/Codex delivery; new Cursor plugin; OpenCode V2 package; V1 active delivery retired; portable skills/resources on supporting hosts                                                                                                                            | TBU2.R1          |
| Asset ownership                         | Proven Safeword-owned legacy asset; modified user-owned configuration; ownership cannot be proven; unrelated host asset; current asset collides with cleanup inventory                                                                                                       | TBU2.R2          |
| Lifecycle operation                     | Fresh install; legacy upgrade; repair; repeat operation; uninstall one of several hosts; interrupted migration recovery                                                                                                                                                      | TBU2.R2          |
| Host selection                          | Selected host; unselected host with existing assets; unselected executable must not be probed                                                                                                                                                                                | TBU2.R2          |
| Canonical native Codex invocation       | User flag absent/true/false crossed with model-disable flag absent/true/false; internal automatic/nonautomatic; public automatic/manual                                                                                                                                      | TBU2.R3          |
| Native session discovery                | Fresh process; new process resumes an existing thread after canonical procedure/essential-rule refresh; earlier history cannot replace current essential delivery and actual requested testing behavior                                                                      | TBU2.R3          |
| Workflow entry                          | Ordinary description-triggered request; public/manual explicit invocation; permitted public-to-internal reference explicitly followed by the builder; internal selector unavailable                                                                                          | TBU2.R3          |
| Internal resource authority and closure | Same installed package from a different CWD/custom marketplace; nested sibling/guide/helper; missing/stale/escaping reference; readable body cannot authorize a denied action                                                                                                | TBU2.R3, SWM1.R3 |
| Public review judgment                  | Concrete collaborator wiring defect concealed by green isolated tests; correctly wired entrypoint with real-collaborator coverage; actionable coverage finding versus load-only, always-warn or always-approve                                                               | TBU2.R3          |

## Partitioning and proof boundaries

- Cover every supported host for shared propagation. Do not multiply every
  failure partition by every host when the shared obligation is identical;
  host-specific payload and lifecycle semantics still need their own proof.
- Positive and rejection cases must discriminate a broken implementation that
  always allows, always denies, always reports healthy, or always reports a
  limitation. Successful delivery alone cannot prove enforcement.
- Use real public entrypoints and installed-host boundaries for the claims
  that require them. A mocked registration editor proves adapter output only.
  Exact host versions and package identity accompany runtime evidence.
- Record failure and recovery at the affected guarantee. A missing optional
  skill need not disable unrelated protection; a required registration failure
  cannot retain that protection's healthy claim.
- No elapsed-time thresholds, arbitrary performance targets, new upstream APIs,
  universal runtime, new cloud guarantees, or unsolicited host enrollment are
  introduced by these partitions.
- OpenCode V2 2.4.1 CLI and TUI are the only supported OpenCode lanes.
  Each must independently prove denied effects, allowed effects, and native
  catalogue and helper loading in the three native scenario outlines.
  The 2.2.6 results and retired V1 records are historical. Missing or mismatched
  proof leaves the affected lane unavailable. Existing Cursor observations do
  not prove native plugin registration.
- OpenCode status distinguishes the current version without applicable proof
  from an unlisted version on the same selected package. The named public
  status contract matrix exercises both through the real status command with
  only the external version probe simulated. Both withhold active protection
  and preserve the package facts. The unlisted version directs the builder to
  update Safeword and restart OpenCode. This refines the existing TBU1.R2
  activation and NTB1.R2 actionable-recovery examples. Neither control supplies
  native runtime proof or creates an older-version compatibility lane.
- Host execution targets are one verified current release per surface under
  the explicit 2026-11-07 authority as amended for OpenCode 2.4.1. The
  independent target fixture will capture the amended identities. Older-host compatibility and upgrade matrices are
  retired. Missing current proof is unavailable; historical results cannot fill it.
- Current Cursor IDE native and project-hook delivery are separate ownership
  variants on the same current version. Retain catalogue/helper, allow/deny,
  supported bounded completion and status proof for each applicable variant;
  remove only the older-version lane. CLI and IDE cannot certify each other.
  OpenCode CLI/TUI cannot establish Desktop protection; Desktop stays advisory.
- Before/after maintenance evidence identifies authoritative edit paths and
  remaining necessary translations. File counts and claimed percentage savings
  are not substitutes for the single-change propagation demonstration.

The named `cursor-project-hooks` installed-host proof retains catalogue/helper,
allowed/denied effects, its actual bounded completion and status on current
Cursor IDE 3.29.9 only. It owns the project-delivery variant of TBU1.R1 and
TBU2.R2; native-plugin outline rows cannot substitute for it. Portable Cursor
resource loading must be observed separately in current CLI and IDE runs; one
runtime cannot certify the other. These are delivery/runtime proof partitions
under existing Rules, not additional business scenarios.

### Native Codex invocation amendment

TBU2.R3 examples prove the verified current native Codex release only. Existing all-host coverage,
portable/core and other-host obligations remain; this slice cannot complete them.
Compaction proof is not inferred from restart/resume.

Owner-approved option2 supersedes mandatory separate guide opens in the restart
case only; optional-public-reference choice remains resolved. Essential real-
collaborator wiring and proof-scope instructions have one owner and bounded
generated copies in every relevant workflow; examples/background stay optional.
Named lower-level matrix: tests/host-contract/testing-core-delivery.test.ts covers
one owner edit through schema reconciliation/project/Cursor, native Claude/Codex,
OpenCode and portable producers; missing/empty/stale/duplicate/oversized core,
unchanged invocation flags and optional links, and incomplete consumer coverage.
Runtime restart delivery requires exact current installed essential bytes in a
current native startup developer message before task tools plus real successful
Node tests; delivery is not understanding. This newly authorized bounded startup
experiment supersedes only this case's body-open predicate. Other discovery,
public/manual/closure/guard obligations remain. Shared knowledge does not invoke
disabled workflows or expose their bodies as automatic catalogue entries.
Named matrix: codex-startup-essential.test.ts covers real bundled normal/fallback
startup/resume, installed/bundled core validation, budgets, corrupt/missing/stale/
symlink resources and invocation flags. Caller controls reject old history,
user/model/tool echoes, partial/marker-only, late/foreign-turn or unknown context.
All historical outcomes retain their old predicates. The authorized paired public
judgment case recorded 68 definitions, 104 expanded cases and 10 Rules at that
historical checkpoint. The current feature has 70 definitions, 103 expanded
cases and 10 Rules, including the unlisted OpenCode status scenario;
other-host runtime and full-ticket migration remain unproved by this slice.

Named proof-quality matrix: actual-caller complete current procedure versus
marker-only/truncated/stale/combined output, bounded native Skill prefixes, separate
core/guide predicates; real Node lower/upper/interior/invalid-range semantic faults
with byte restoration; structurally equivalent literal parallel producer/emitter
AST bindings versus dynamic/unexecuted/foreign/effectful forms. These are lower-level
controls, not additional Gherkin scenarios. The public judgment pair uses normal
authenticated review results and the calibrated fixed-reference claim review;
loading/order remains a separate unchanged acceptance case.

Dense flag defaults/types, both-flags-disabled nonautomatic discovery, dynamically
added canonical names, all internal siblings, bare/backticked/link/slash/dollar
references at each asset depth, manual sidecars, and missing/extra/stale/escaping
assets are the named lower-level matrix in
`packages/cli/tests/host-contract/codex-internal-workflows.test.ts`. It also invokes
the actual normally generated bundled CLI SessionStart startup and resume input
from a foreign CWD/custom package origin; no injected formatter establishes that
wiring. These are supporting process/structural checks.

The `native-codex-internal-workflows` proof runs the added feature cases through
Cucumber and installed current-release actors: fresh current-body reads, restarted current
startup essential delivery, actual
selector controls, explicit manual invocation, public handoff, nested resource
loading and denied write after a read. Complete closure census and the retained
allowed-write controls complement those cases. A diagnostic startup shim,
skills/list alone, model prose or an earlier body in history cannot replace the
actual host observations. Missing native execution/controls is unavailable,
not intended product RED or success.

## Fresh-reader reconciliation

The advisory result was sufficient. Its handler-inventory observation is included
above. Event schemas, exact host testing procedures, and transport choices belong
in implementation planning; no unresolved product decision is deferred into
scenario authoring.

### V1 retirement proof partitions

The retirement outline now covers only an unadmitted current V2 package at installation. It must report missing admission with actionable recovery. The retired 1.x executable case is not a required actor or compatibility proof. Lower-level retirement controls still reject any active V1 registration, generated delivery or required-runtime selection, without running an older binary. Current V2 conformance without matching enrollment stays unavailable. An explicitly enrolled internal candidate may run the originating controller, but that proof grants neither customer admission nor native activation. Separate current Cursor CLI/IDE and current project-hook delivery proofs remain required.
