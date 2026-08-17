---
id: X2Z8MN
slug: install-remote-test-workflows-safely
type: epic
status: in_progress
scope:
  - One managed workflow's installation, disable, identity, and customer-change preservation
  - No-clobber first publication and retry after interruption
  - A release tripwire that requires FFXB81 before the first workflow revision
out_of_scope:
  - Contributor preference parsing and GitHub dispatch or result lifecycle
  - Runtime validation of trusted workflow inputs and remote result authority (BR373S)
  - Committing, pushing or bypassing branch protection; normal project delivery publishes locally installed workflow bytes
done_when:
  - First opt-in creates the exact admitted workflow without changing the project's execution preference
  - Disable mutates only exact current Safeword bytes; every other value remains customer-owned
  - Every interrupted first setup leaves absence or the complete workflow and an explicit retry converges
  - Unsafe paths and changes observed before mutation are preserved with one safe action
  - LF and ordinary CRLF checkout bytes retain identity without executing customer filters
  - The installed workflow identity is schema-registered and binds exact manual-dispatch-only, least-privilege, fully pinned bytes without Safeword-provided secrets
  - CLI status distinguishes not installed, current, customer-owned, and unsafe paths
parent: BBNZ68
children:
  - HWZZJ8
  - H136BP
  - GRDXXA
  - FFXB81
created: 2026-08-09T21:20:30.052Z
last_modified: 2026-08-12T00:02:51Z
---

# Install remote test workflows without overwriting customer changes

**Goal:** Let projects opt in to the managed GitHub Actions workflow through safe setup, upgrade, disable, and conflict recovery.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-08-09T21:20:30.052Z Started: Created ticket X2Z8MN
- 2026-08-09T21:20:59Z Scoped: Owns only the managed workflow lifecycle required by later remote execution.
- 2026-08-10T20:53:00Z Resumed intake after S7TZF9 merged. Loaded project principles, personas, glossary, and surfaces; captured the one-way-door installation brief and separate Technical Builder and Non-Technical Builder jobs for the JTBD gate.
- 2026-08-10T20:57:00Z JTBD gate confirmed by the user. Rechecked official Kubernetes and Terraform evidence for this child: retain exact managed ownership, detect drift before mutation, and stop visibly on customer conflicts rather than forcing or importing ownership.
- 2026-08-10T21:05:00Z Quality review requested changes through an independent Claude pass. Added observable lifecycle outcomes, exact done conditions, customer-preserving conflict exits, state vocabulary, the minimum installed-workflow security contract, and explicit separation from BR373S runtime authority.
- 2026-08-10T21:14:00Z Quality re-review requested changes. Broke circular identity trust with immutable bundled historical manifests, separated local convergence from default-branch publication, defined validated journals and pending-record leases, covered Git line endings and hostile paths, and added single-writer reconciliation plus achievable conflict recovery.
- 2026-08-10T21:23:00Z Degraded fallback re-review requested changes after Claude timed out. Defined the persistent marker-owned Git-attributes prerequisite separately from the exact three-member transaction, completed historical manifest coverage, bounded open-request recovery through S2TF4J, specified the publication probe contract, and strengthened mutations to descriptor-relative no-follow operations.
- 2026-08-10T21:33:00Z Independent quality re-review requested changes. Simplified ownership to a fixed-path two-member workflow/install-state set, kept S7 preference outside the journal with explicit call ordering, required Git's effective-attribute result rather than literal-line trust, made pre-S2 disable testable, and completed journal durability ordering.
- 2026-08-10T21:39:00Z Degraded fallback re-review found one remaining durability defect and one marker lifecycle gap. Required staged-member and directory durability before journal publication, and defined canonical marker setup, interruption, upgrade, disable, re-enable and conflict behavior.
- 2026-08-10T21:44:00Z Degraded re-review found prospective-attribute and version-detection contradictions. Required no-mutation effective-attribute evaluation before patch publication, tied newer-version recovery to installed state rather than the unversioned marker, and froze the public workflow and installed-state paths.
- 2026-08-10T21:53:00Z Independent review showed the Git-attributes marker had become the main complexity source. Removed marker mutation entirely; canonical Git blob identity now tolerates ordinary text/EOL checkout conversion while rejecting filters, encodings and ident, requires a valid Git worktree, keeps historical manifests append-only, and adds real CRLF clone proof.
- 2026-08-10T22:02:00Z Independent re-review tightened canonical Git ownership: both members pass the attribute gate, descriptor-read bytes feed Git through stdin without path re-resolution, journals live only in per-worktree Git administration, half-present sets conflict explicitly, future pending support forces schema upgrade, and external-writer limits are named.
- 2026-08-10T22:08:00Z Degraded re-review corrected the final concurrency promise and journal-root contract. Guarantees now cover lock-cooperating Safeword writers without claiming an impossible portable conditional replace against external processes; the resolved per-worktree Git administration root is validated, pinned, and traversed without following links.
- 2026-08-10T22:16:00Z Degraded re-review resolved the installed-state ownership contradiction by making exact bundled canonical Git-blob identity authoritative for both members; JSON parsing validates compatibility but cannot normalize customer edits into ownership. Named the required real-repository CRLF and hostile-attribute integration test as implementation acceptance evidence.
- 2026-08-10T22:24:00Z Product Inspiration gate confirmed. Retained the Kubernetes ownership and Terraform classify-before-mutate lessons, then applied only the relevant project principles: add without replacing customer choices, make NTB outcomes plain without limiting TBU evidence, enforce safety through prerequisites, and keep the lifecycle model small. Proposed five persona-level Rules for confirmation.
- 2026-08-11T00:05:00Z Clarified the canonical BDD guidance after this intake exposed a placement ambiguity: specs no longer receive a principles summary by default; experiential consequences belong in observable Rules, technical principle-to-proof mappings belong in the implementation plan, and named principles remain only for non-obvious decisions or deviations. Removed the redundant principles checklist from this spec without changing its Rules.
- 2026-08-11T09:27:00Z Rules gate confirmed by the user: three Technical Builder invariants cover customer ownership, complete recoverable lifecycle transitions, and least authority; two Non-Technical Builder invariants cover plain actionable outcomes and safe repeat/resume behavior without CI knowledge. Advanced to engineering-scope confirmation.
- 2026-08-11T09:42:00Z Engineering scope gate confirmed. Advanced to define-behavior; derived lifecycle, ownership, transaction, Git/path, request-dependency, authority and status partitions, then drafted 18 scenario groups across all five Rules with rejection coverage and both affected surfaces.
- 2026-08-11T10:02:00Z Full quality-review pass requested changes. Made recovery deterministic: valid journals always roll forward to the request's new side, success waits for that side, and caller-owned preference publishes afterward on the repeated public command. Replaced generic lifecycle actions with the approved public CLI commands and required release validation of actual bundled workflow bytes before manifest admission. Executable wiring remains an implementation-phase proof obligation rather than a false define-behavior claim.
- 2026-08-11T10:18:00Z Quality re-review found path-attribute reevaluation could race the identity gate. Simplified classification to pinned-descriptor UTF-8 bytes, deterministic CRLF-to-LF normalization, lone-CR rejection, and `git hash-object --stdin --no-filters`; pre/post unsafe-attribute gates remain fail-closed, while non-cooperating destination and attribute/configuration ABA changes are named portability limits. The review's remaining executable-evidence finding is intentionally unsatisfied until implementation because every scenario is still at RED.
- 2026-08-11T10:31:00Z Completed the full quality-review loop for the define-behavior packet. Added positive and adversarial release-validation examples covering triggers, nested permissions, remote action and reusable-workflow pins, checkout credentials, secrets, expressions, and YAML aliases. Remaining review concerns require implementation evidence and stay explicit RED obligations. Advanced to scenario-gate for the requested full review-spec pass.
- 2026-08-11T15:21:14Z Full review-spec passes tightened the RED contract: exhaustive pre/post-journal crash and I/O-failure matrices, invalid evidence, deterministic concurrency after success or failure, idempotent disable, complete machine/human status outcomes, exact conflict actions, and strict workflow authority/reference parsing. Claude timed out during both independent handoffs, so Codex fallback findings were applied and independence remains explicitly degraded pending a successful external re-review.
- 2026-08-11T16:07:00Z Continued the full scenario-gate review loop and applied every fallback finding: completed receipts disambiguate interrupted preference publication, public commands and release CI own observable wiring, transition keys use an independent literal manifest, JSON status has a closed schema, managed recovery and caller cleanup have separate crash/failure matrices, ordinary install cannot opt projects in, and all rejection/status I/O paths preserve the complete lifecycle snapshot. Gherkin, Markdown, and diff checks pass. Claude continued to time out, so independent approval remains the sole blocked gate.
- 2026-08-12T00:02:51Z Refactored the BDD packet for readability and determinism after a focused quality assessment. Reduced the feature from 404 lines and 183 example rows by moving exhaustive durability, recovery, Git, and workflow-admission permutations into a bounded Verification Matrix appendix in the spec. Fixed repository-relative status paths, exact recovery commands and JSON objects, real fresh-checkout evidence, explicit secret policy, immediate pre-retry snapshots, per-operation 20/24/16 transition counts, real disable boundaries, and independent 15/60/10/26 coverage-set assertions. Gherkin, Markdown, diff, and feature-ledger parity checks pass; Claude review remains unavailable by timeout.
- 2026-08-12T03:30:00Z Split at scenario-gate after the 29-scenario umbrella packet repeatedly exceeded the independent review timeout. Promoted this ticket to an epic and moved behavior, without changing scope, into HWZZJ8 (ownership and status), H136BP (durability and recovery), and GRDXXA (workflow admission and least privilege).
- 2026-08-15T00:13:13-07:00 Confirmed the plan-checkpoint boundary: HWZZJ8 delivers read-only classification, planning, and status; H136BP exclusively owns durable mutation and public mutating adapters; this epic remains the cross-child release gate without adding an integration ticket.
- 2026-08-15T01:32:00-07:00 Recombined lifecycle implementation under HWZZJ8 after review proved H136BP was not independently releasable. H136BP remains supporting recovery evidence; GRDXXA remains the independent workflow-admission child.
- 2026-08-16 Deferred historical replacement to FFXB81 until a second workflow version exists. The v1 release fixture and contract test block silent byte drift; HWZZJ8 now ships only production-reachable first setup, status, and disable behavior.
