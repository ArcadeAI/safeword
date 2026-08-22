# Impl Plan: Manage the first remote-test workflow safely

**Status:** implemented
**Planned on:** 2026-08-16

## Approach

The riskiest assumption is that a complete file can be published without
clobbering a destination that appears concurrently. Before slice 1, add a
retained integration contract proving that write + sync + exclusive
same-directory link exposes only absence or complete bytes and returns EEXIST
without replacing anything. Run it on every operating-system/filesystem pair
in the supported CI matrix; an unsupported checkout path uses the specified
publication failure instead of a fallback writer.

Build in five dependency-ordered slices:

1. Add the candidate workflow template, admission manifest, and schema entry
   whose generator always omits it and has no removal contract. Contract tests
   prove ordinary reconciliation/diagnostics are observational and fail when
   public commands exist without a GRDXXA-admitted template hash. A pre-release
   mismatch directs GRDXXA to update its candidate fixture; after v1 is marked
   released, the same tripwire directs FFXB81.
2. Add the no-follow classifier and status rendering. Unit tables cover safe or
   missing parents, wrong types, symlinks, current LF/CRLF bytes, customer bytes,
   stable errors, and default-indeterminate errors. Comparison tests forbid
   subprocesses. Expose the classifier for the later uninstall advisory, but do
   not change public uninstall output in this slice.
3. Add setup publication and disable. Integration tables cover parent creation,
   private-file create/write/sync/link/cleanup faults, EEXIST reclassification,
   crash residue, retry, disable ownership classification, and preference
   invariance. Every pre-publication mutation fault except the three specified EEXIST race
   paths uses the non-retryable publication error; both error families carry
   operation/code/path detail. The fault table crosses a non-link permanent failure
   with a retryable create-EEXIST case. Cleanup after successful publication
   reports current with a warning; cleanup after another failure preserves the
   primary result and adds that warning. Disable separately proves unlink
   ENOENT convergence and its removal-failure contract.
   Resolve effective mode before mutation and carry it in setup data; one stable
   finding code renders the same guidance in JSON and human output. Invalid
   configuration uses the existing test-execution error before any write.
4. External gate owned by GRDXXA: validate the exact candidate in a real GitHub
   Actions run and record its admitted hash and v1 fixture in
   `packages/cli/src/test-execution/remote-workflow-admission.json`. The release
   contract reads that artifact and fails on a missing/unadmitted hash. Until that lands,
   slices 1–3 remain internal and public wiring cannot merge. The fixture stays
   frozen after admission; a mismatch tells maintainers to update GRDXXA
   atomically if never published, or activate FFXB81 if v1 has shipped.
5. Wire all three commands together in the catalogue and packaged CLI; add docs
   for local fallback, unsupported filesystems, and manual customer-owned
   installation on symlinked layouts, and prove the packaged disable command
   remains usable after project uninstall. Only here add the conditional
   uninstall notice/finding; unsafe, customer-owned, or indeterminate advisory
   classification is silent and cannot change uninstall's outcome.

Slices 1–3 stay on this delivery branch until GRDXXA admission; they do not
merge as unreachable production code. If GRDXXA rejects the candidate, the
ticket owner removes those slices or revises the candidate before public wiring.

`RemoteWorkflowFs` is the narrow seam around filesystem operations and private
name generation. The Node
adapter runs against real temporary directories for ordinary classification,
publication, and disable. A deterministic recording adapter injects races and
fault boundaries through the same lifecycle functions; parity tests run the
non-faulting path through both adapters.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Evidence of fit | Principle borrowed | Boundary |
| --- | --- | --- | --- | --- |
| Existing `prReviewWorkflowFile` reconciliation | 2026-08-16 | Optional workflows are schema-catalogued while customized bytes survive | Keep schema as path/template catalogue | This workflow is explicit-command-only |

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Keep preference separate | Setup reports but never changes execution mode | Couple setup with `remote-preferred` | Hidden preference mutation surprises users and creates a multi-file transaction |
| Publish without replacement | Complete private file + sync + exclusive same-directory link | Direct exclusive write; unconditional rename; persistent journal | Direct write exposes partial bytes; rename clobbers; a journal is disproportionate for one file |
| Keep reconciliation observational | Always-omitted schema generator and no removal contract | Ordinary install/uninstall ownership | Explicit opt-in must survive unrelated Safeword lifecycle commands |
| Defer historical replacement | FFXB81 activates only when a second workflow version is proposed | Ship dormant history/rename machinery now | No released predecessor exists; seam-only production code and recovery machinery are speculative |
| Preserve managed parents on disable | Remove only the workflow entry | Remove newly empty parents | A parent may gain customer content after setup; ownership cannot be proved safely |
| Preserve unknown private residue | Ignore it; never claim or delete it | Scan, report, or clean matching names | A residue-like file may belong to a concurrent invocation or customer; the inert name prevents execution |
| Keep optional workflow after uninstall | Preserve it and emit a notice directing users to remote disable | Remove it; preserve silently | Uninstall must not destroy an explicitly opted-in workflow, but silence would strand an NTB without a next action |

## Design alignment

| Principle | Consequence | Proof |
| --- | --- | --- |
| 3. Add, never replace | Customer bytes and concurrent destination creation are preserved | [Classifier and EEXIST integration cases](packages/cli/tests/test-execution/remote-workflow-lifecycle.test.ts) |
| 5. Correct and safe; then clear; then simple | One ownership table and one exclusive publication strategy | [Fault and retry table](packages/cli/tests/test-execution/remote-workflow-lifecycle.test.ts) |
| Optimize for the NTB without constraining the TBU | Human output gives one plain action while JSON keeps the closed result | [Human and JSON contract cases](packages/cli/tests/test-execution/remote-workflow-advisory.test.ts) |

Architecture alignment: schema remains the source of truth for the path and
template; the always-omitted generator makes explicit lifecycle commands the
only writers. Existing test-execution mode resolution continues to own local
fallback.

## Known deviations

- Node path-based APIs cannot exclude a hostile concurrent parent-directory
  swap. The contract protects every state observed before mutation and states
  the residual race; it does not add a platform-specific dirfd layer.
- Disable's ownership check cannot exclude a writer replacing the path between
  that check and the path-based unlink; the command assumes no hostile
  concurrent writer and removes only the single documented workflow path.
- Crash residue is intentionally undisclosed: scanning name-like files would
  claim knowledge Safeword does not have about customer or concurrent entries.

## Doc impact

- README and test-execution docs: setup/status/disable, unchanged preference,
  local fallback, inert crash-residue names, and the command that selects
  remote execution.
- Generated CLI reference: the three remote lifecycle commands.

## Assessment triggers

- A second workflow version is proposed: activate FFXB81 before changing bytes.
- A second managed file requires coordinated publication.
- A real incident demonstrates harmful concurrent parent replacement.
