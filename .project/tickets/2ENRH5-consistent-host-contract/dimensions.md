# Dimensions: Reduce duplicated maintenance and agent drift

Prepared from the accepted scope after the requested fresh-reader check found
no missing intent or compatibility decisions. This is the scenario-authoring
coverage model, not an accepted scenario set or implementation plan.
Rule IDs below have the `consistent-host-contract.` prefix.

| Dimension | Material partitions and boundaries | Rules |
| --- | --- | --- |
| Authoritative change | Existing shared skill changes; existing policy changes; a change needs a genuinely new host capability | SWM1.R1, SWM1.R2 |
| Delivery mechanism | Host loads bundled assets directly; host requires generated format/path translation; compatibility bridge would duplicate native registration | SWM1.R1, TBU2.R1 |
| Supported inventory coverage | Every host lane and shipped component accounted for; OpenCode V1 and V2 require separate dispositions; one disposition missing; newly added skill or handler omitted; session-end, asynchronous, and shell handlers included | SWM1.R2 |
| Maintenance reduction | Parallel authored policy removed; generated output replaces manual edits; new interface leaves equivalent per-host policy intact | SWM1.R1, SWM1.R3 |
| Drift checks | Fresh derived output; stale content; canonical input changes without regenerated required output; repair restores agreement | SWM1.R3 |
| Policy boundary | Shared decision governs host dispatch; host bypasses decision; adapter owns an independent copy of shared policy | SWM1.R3 |
| Available mechanism | Verified required guarantee; multiple satisfying mechanisms; weaker centrally permitted alternative; weaker unpermitted alternative; no satisfying mechanism | TBU1.R1, NTB1.R2 |
| Completion outcome | Ticket transition rejection; conversation continuation; observational event only; continuation limit reached | TBU1.R1, TBU1.R2 |
| Activation and trust | Active verified integration; disabled or untrusted hook; missing plugin; runtime failure | TBU1.R2 |
| Evidence applicability | Exact recorded host/package/configuration; changed host version; changed delivery; changed trust/configuration; unknown proof | TBU1.R2, SWM1.R2 |
| Registration failure | Host accepts expected payload; changed host schema rejects required registration; optional registration fails while required behavior survives | TBU1.R2, TBU2.R1 |
| User coordination | Routine adaptation succeeds without questions; actionable guarantee limitation; real authorization or product decision required | NTB1.R1, NTB1.R2 |
| Native packaging | Existing Claude/Codex delivery; new Cursor plugin; OpenCode V2 package; OpenCode V1 compatibility; portable skills/resources on supporting hosts | TBU2.R1 |
| Asset ownership | Proven Safeword-owned legacy asset; modified user-owned configuration; ownership cannot be proven; unrelated host asset; current asset collides with cleanup inventory | TBU2.R2 |
| Lifecycle operation | Fresh install; legacy upgrade; repair; repeat operation; uninstall one of several hosts; interrupted migration recovery | TBU2.R2 |
| Host selection | Selected host; unselected host with existing assets; unselected executable must not be probed | TBU2.R2 |

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
- The existing OpenCode V1 1.18.23 lane and new V2 2.0.32 lane are distinct.
  Existing Cursor observations do not prove native plugin registration.
- Host execution targets are exact: Claude Code 2.1.170, Codex 0.160.0, Cursor
  IDE 3.24.18 native and 3.8.23 project-hook compatibility, OpenCode V1 1.18.23,
  and OpenCode V2 2.0.32. OpenCode CLI/TUI proof
  cannot establish Desktop protection; Desktop remains advisory.
- Retained Cursor 3.8.23 project-hook compatibility has its own required installed-IDE
  proof: `cursor-legacy` in execution-plan.md, including catalogue/helper loading,
  allowed and denied sentinel writes, bounded completion, and upgraded-unenrolled
  status. This proof cannot satisfy the native 3.24.18 examples.
- Before/after maintenance evidence identifies authoritative edit paths and
  remaining necessary translations. File counts and claimed percentage savings
  are not substitutes for the single-change propagation demonstration.

## Fresh-reader reconciliation

The advisory result was sufficient. Its handler-inventory observation is included
above. Event schemas, exact host testing procedures, and transport choices belong
in implementation planning; no unresolved product decision is deferred into
scenario authoring.
