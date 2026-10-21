# Test quality review for issue 6004

Update: M1 was repaired in task `4RGYMY-prove-legacy-protection-executes` after
this assessment. M2 was repaired in `117CBF-prove-same-session-plugin-handover`.
M3 is repaired by the coexistence example and inclusive read-only snapshots,
with evidence in `m3-verification.md`. All three must-fix findings are resolved.
Their verification reports record real execution and targeted fault probes.
The eight non-blocking suggestions remain outside this issue's scope.

**Findings:** 3 must-fix BDD proof gaps, 8 should-strengthen findings, 3 looks-good findings.

The new regression tests discriminate between correct and broken behavior.
The existing Claude-plugin BDD examples need work before their passing results
can support all the claims in their names. These are assessment findings, not
changes to implementation, tests, or accepted product behavior.

## Scope and evidence

Reviewed all 46 scenario definitions in `features/native-claude-plugin.feature`
(including outlines, live, and WIP definitions), their bindings in
`steps/native-claude-plugin.steps.ts`, and the damaged-cache proof mapping in
`packages/cli/features/self-contained-agent-plugins.bdd-proof.json`.
This is the Claude-plugin area relevant to #6004, not a semantic audit of all
597 scenarios in the repository-wide acceptance run.

Two independent Claude Opus scenario reviews ran. The final receipt is
`5c18357c-74b9-493d-a47c-36fddf5635e3`, with cross-agent independence and a
`request_changes` verdict. The second packet included the newer unified-install
and automatic-migration specifications, the current status implementation,
the scenario ledger, package version, and project knowledge. Findings below
are triaged against those current contracts rather than applied mechanically
from the old ticket's contradictory requirements.

The new integrity unit suite passed 24/24 in an isolated temporary project.
Four deliberately broken replacements for `claudeAssetMatches` were then run
against those same tests without editing the repository:

| Replacement | Failing tests | Result |
| --- | --- | --- |
| Accept every asset | 23 | Detected |
| Reject every asset | 13 | Detected |
| Check raw bytes only | 12 | Detected |
| Accept the unchanged reference body while ignoring metadata | 18 | Detected |

These are four targeted fault probes, not a comprehensive mutation score.
The original generated-dispatcher regression also failed before the fix and
passed afterward, as recorded in `verify.md`.

Six expanded BDD cases were rerun: three damaged-cache cases, declined cleanup,
plugin/legacy coexistence, and post-cleanup handover. All passed despite the
proof weaknesses below. This demonstrates why passing is not quality approval.

## Findings

### Must fix

#### M1 — Legacy execution claims are satisfied by setup data

**Affected:** "Coexisting plugin hooks prove identity but suppress duplicate work
per legacy event"; "A failed sibling hook blocks the prompt without event-level
plugin proof"; "Damaged plugin runtime remains non-blocking and writes no plugin proof".

**Current:** The coexistence Given writes **`legacy\n` into the effect log**
before the When (`steps/native-claude-plugin.steps.ts`, around 1717). The Then
reads that same value (around 1740); the action invokes only the plugin dispatcher.
The damaged-cache and failed-sibling fixtures instead write a sentinel saying
"legacy protection remains authoritative"; their shared Then merely rereads it
(around 672). Neither mechanism proves that a viable legacy hook executes.

**Why:** A failure to execute any legacy protection is compatible with these
assertions. The coexistence case does usefully prove plugin suppression and
preservation of prior proof, but its legacy-execution assertion adds no proof.

**Proposed pattern:** Start with an empty effect log and a viable, recognized
legacy hook. Execute the protected event through the host-order simulation.
Then require exactly one legacy effect, no duplicate plugin effect, and the
appropriate proof outcome. For damaged caches, require the actual legacy
protection effect rather than preservation of a fixture sentinel.

#### M2 — The post-cleanup scenario never creates a handover

**Current:** Given "the current task has exact plugin proof and is in
**post-cleanup state**" calls only `createAuthorityFixture` (around 1815).
It creates no proof, legacy authority, cleanup transaction, or plugin-mode
marker. "No plugin reload or task restart is required" checks only exit 0.

**Why:** This proves a fresh plugin can run. It cannot detect a defect where
legacy authority remains cached after cleanup until a session reload.

**Proposed:** Establish a viable legacy hook and exact proof for session S;
complete cleanup; invoke the next matching event in the same session and
plugin-data directory. Require one plugin effect and no legacy effect without
any reload/restart operation.

#### M3 — The current coexistence status partition has no named oracle

**Current:** The status outline has a mixed recognized/unknown row expecting
`cleanup-ready`, but no row expecting **`coexistence`**. No assertion containing
that classification was found in the Vitest test sources either.

**Why:** Current `statusForInstallation` deliberately returns `cleanup-ready`
when recognized legacy remains, and `coexistence` when only unresolved legacy
remains (`packages/cli/src/claude-plugin/status.ts`). The second user-visible
status and its safe recovery action lack an explicit scenario assertion.

**Proposed:** Add a representative status example with current plugin proof,
unknown legacy content, and no recognized removable legacy. Assert
`coexistence`, exit 2, and `resolve reported legacy conflicts`, with unchanged
profile/project bytes. Keep the mixed-content row's current partial-contraction
semantics rather than restoring the obsolete specification.

### Should strengthen

#### S1 — No lifecycle calls is inferred from unchanged fake state

**Current:** "No Claude lifecycle command is invoked" compares the fake state
file with its snapshot (around 1534), not the call log.
**Why:** A non-mutating or failed forbidden call could pass.
**Proposed:** Inspect the recorded invocation log using the existing
`assertNoClaudeMutationCalls` helper or an explicit allowed-read-call filter.

#### S2 — Project-state containment is an absence-only assertion

**Current:** "Ticket, configuration, and runtime project state remain beneath
the project root" only requires that `plugin/.safeword` is absent (around 433).
**Why:** Missing state, or state written to another wrong directory, passes.
**Proposed:** Exercise an operation that writes the relevant state, assert its
expected project-relative location, and snapshot the other documented roots.

#### S3 — Idempotence starts from already-converged or empty inputs

**Current:** The install row starts with an exact enabled installation; recover
starts with no transaction (around 1838–1883).
**Why:** This covers repeated no-ops, not repeating a previously effective
install or recovery.
**Proposed:** Run a real first convergence from missing/outdated state, and a
real recovery from an interrupted transaction, before asserting repeat safety.

#### S4 — A status row names a digest partition it never constructs

**Current:** "Proven with a stale version or digest" triggers only the
`includes('stale version')` branch. The digest mutation requires the separate
text `wrong hook-manifest digest` (around 1095–1098).
**Why:** The row overstates its input coverage. Cleanup's separate digest case
does not itself establish the public status result.
**Proposed:** Rename the row accurately and add or reference a status-level
digest mismatch proof.

#### S5 — Completed ledger entries do not identify the skipped proof lanes

**Current:** NTB1.R4 and SWM1.R2/R3/R4 are under `@wip`; the refused-reload case
is also WIP, while the historical ledger marks their work complete.
**Why:** Some obligations have real lower-level coverage—for example cleanup's
concurrent-edit and symlink cases—but the current scenarios do not provide a
machine-auditable map to it. This is a traceability gap, not evidence that those
protections are absent.
**Proposed:** Name the existing tests/smokes through proof mappings or explicit
skip reasons; leave genuinely unimplemented host checks visibly pending.

#### S6 — Byte-preservation assertions only compare a parsed field

**Current:** "Unrelated profile state is byte-identical" and "profile files
outside the observed Claude command write set are byte-identical" compare only
the fake state's `unrelated` property (around 3462 and 3577).
**Why:** Other files or byte-level serialization changes are outside the oracle.
**Proposed:** Snapshot the fixture profile tree with only the observed write
set excluded, or narrow the claimed behavior to the actual modeled field.

#### S7 — The live status assertion never invokes status

**Current:** "Status observes current-task plugin proof without requiring a
restart" only checks whether the proof file exists (around 3682).
**Why:** A broken public status reader could pass this assertion.
**Proposed:** Run public status against the authenticated isolated profile and
assert its proof-derived classification. Keep the live evidence opt-in.

#### S8 — The original feature contract was not reconciled after redesign

**Current:** The old ticket excludes default project installation and forbids
ordinary setup installing a profile plugin. Its old status prose requires
mixed content to be `coexistence`. Current scenarios and newer unified-install
and automatic-migration contracts intentionally differ.
**Why:** The independent reviewer flags three contradictions as errors when
grading against that original ticket. Reverting current behavior from those
findings would regress later accepted work.
**Proposed:** Mark the superseded clauses and link the owning current contracts
(`ZE5RRG`, `GZZEY7`, and the project/user scope contract). Reconcile the active
scenario ownership before treating the old ticket's gate as current approval.

### Looks good

1. The new integrity tests reject all four targeted faults and exercise
   meaningful metadata/body distinctions rather than private helper calls.
2. The dispatcher regression uses the real generated bundle, and the public
   profile observation test fakes the external Claude process boundary while
   retaining real integrity validation.
3. Invalid-proof cleanup examples use multiple proof partitions, snapshots,
   and call-log checks. The damaged-cache outline has a coherent failure shape
   and genuine dispatcher execution; its legacy-authority clause needs repair.

## Scope limits and disposition

The #6004 task intentionally places normalization and tampering permutations
in lower-level regression tests; absence of a new Gherkin file is not itself a
defect. A representative normalized-desktop acceptance example would improve
the release story but should not duplicate the parser matrix.

The entire 597-scenario corpus has not received a scenario-by-scenario quality
audit. No production source, BDD scenario, or regression assertion was changed
in this assessment. The independent scenario verdict remains request changes;
the old feature ticket was not reopened or stamped as approved.

**Next:** Start with M1: replace prewritten legacy effects with observed legacy
execution, then prove the scenario fails when that execution is removed.
