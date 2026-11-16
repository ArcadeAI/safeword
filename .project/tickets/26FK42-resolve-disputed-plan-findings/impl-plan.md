# Impl Plan: Record disagreements without false approval

**Status:** planned
**Planned on:** 2026-11-14

## Approach

**Architecture at a glance:** Extend the existing review-disposition command,
ticket records and phase admission. Record the author's disagreement and cited
evidence. Send scope choices to the user and currency questions to the existing
provenance comparison. Nonblocking advice permits progress; disputed blocking
correctness or relevance remains unresolved. After material correction, admission
requires a fresh passing verdict. Only disputed optional classification needs
a fresh adjudicator; correctness disagreement does not launch arbitration.

**Riskiest assumption:** A pending question and its reviewed plan can survive a
reclaimed cloud runner without exporting private review keys. Prove “A later
session recovers the pending decision” at the actual host handoff first. A copied
ticket identifies the question; it does not authenticate an old review.

### Proof strategy

| Scenarios | Real boundary and proof | Limit |
| --- | --- | --- |
| R1 identity and optional adjudication | Installed CLI with authenticated coordinator receipts; self-adjudication refusal paired with fresh-adjudicator success | Simulated reviewers prove routing, not judgment |
| R2 disagreement, classes, evidence and currency | CLI integration using real config, finding selection, identity comparison and writer; current/stale and invalid/valid controls | Citation relevance requires semantic review |
| R2/R3 user scope and optional advice | Installed admission permits unaccepted advice and refuses accepted unfinished work or unresolved in-scope defects; real user interaction | NTB1.R4 owns the comprehension walkthrough |
| R4 pending and recovery | Separate real-process no-input exit and later-session recovery on each affected host | A shared directory does not prove reclaimed-cloud recovery |
| R5 results and retry | Installed disposition/action matrix, fresh-verdict admission and unchanged retry refusal; variable-count lower-level proof | Logging alone never proves correction or approval |

Claude Code, local Codex and Cursor need installed interactive and headless
proof. Cloud Claude and Cursor require real reclaimed-runtime proof. OpenCode
CLI, TUI and Desktop delivery/proof are excluded by the user's 2026-11-14 scope
decision, tracked in #7491; their general support status is unchanged. Codex Cloud
stays advisory.
These are obligations, not new deferrals; retain all 33 historical deferred cases.
Admission proof also pairs two tickets to prove unrelated work remains eligible,
and exercises the implementing agent proposing a narrowing at the real scope
decision boundary. TypeScript and the installed testing guide apply; add no dependency.

The Technical Builder gets evidence and one action without a third-provider
requirement for logging. The Non-Technical Builder gets a plain scope choice;
tests establish mechanics. This child supplies its pending-scope and dispute
messages to the parent NTB1.R4 walkthrough owner for the understanding check;
this child cannot claim comprehension proof before that evidence exists.
The Maintainer gets one shared writer/router and mixed-version/parity proof.

**Current truth:** Existing code supports authenticated jobs, review identity,
admission and declines of approved warning/info findings. Acceptance, durable
pending records and this router are proposed. Historical-impl-plan.md retains
the abandoned design. The scenario review was reduced, not independent; #7481
records its receipt limitation. The scope-adjusted parent Product Plan passed
installed Claude review with reduced assurance on 2026-11-14 and its authenticated
spec stamp was recorded. Changed child scenarios still require current review.
No implementation, RED, host recovery or human plan approval is claimed.

## Decisions

### Recorded Decisions

**Decision:** Extend existing disposition and admission.
**Choice:** Extend record-review-disposition with explicit class, reason and
supporting accepted requirement or plan text; preserve the existing decline
invocation. Select findings from authenticated coordinator provenance for this
ticket and review kind, including changes-requested reviews. Reject unknown
classes, absent origin, inconsistent provenance or missing evidence. Use the
coordinator's actual reviewer, not reviewer-authored identity.
**Alternative considered:** Separate arbitration service or command family.
**Rejected because:** Logging correctness disagreement needs no new review engine.
**Evidence reference:** Current review-disposition, job and phase-admission code,
shared scope contract and child R1–R5.
**Retrieval date:** 2026-11-14.
**Applicable version:** Repository base fd784a2fd; no dependency change.

| Input | Record and gate effect | Next action |
| --- | --- | --- |
| Nonblocking advice | nonblocking-disagreement; otherwise eligible review remains usable | Continue normal review |
| Blocking correctness/relevance | unresolved-blocking; plan unapproved | Material correction and fresh passing review |
| Currency | current or stale from existing provenance | Continue or refresh review |
| Scope proposal without user | pending-user-decision; scope unchanged | Ask user to accept or decline |
| Optional classification | pending-classification; retain supported gate effect | Obtain fresh eligible classification |
| User acceptance | accepted; update authoritative scope and required work | Deliver and freshly review accepted work |
| User decline | declined; boundary unchanged | Fresh review if the disposition materially changes its basis |

An originally nonblocking suggestion stays nonblocking while classification is
pending. An author's optional label cannot clear a blocking in-scope defect.
A grounded classification may remove an incorrect blocking label; adjudicator
scope expansion instead becomes a user-owned pending choice. No classification
result itself approves a plan. After correction, the normal reviewer may review
the new plan; that is not sole adjudication of the original disputed finding.

Optional adjudication excludes the origin's authenticated agent family.
Derive candidates from existing configured routes and retain their actual
independence; reduced author-family feedback is not independent adjudication.
Exhaustion retains pending classification and routes the proposed extra work to
the user's existing scope decision, rather than repeating an unavailable review.
User decline records the exclusion; a fresh review must judge the corrected basis
and still blocks any independently supported in-scope defect. Acceptance updates
scope and requires delivery and fresh review. A user scope choice is not an
independent classification verdict. Headless work preserves the exact question
and returns that human action without approval. Do not install providers,
alter qualification, add counters or impose a fixed correction-pass cap.

User decisions use the existing host-user boundary: interactive confirmation or
an actual user response authorizing the specific scope change. An agent assertion
or noninteractive supplied choice is not a user decision. Preserve earlier
explicit authorization rather than ask again. Acceptance updates the ticket or
parent and its Rules/scenarios through the existing behavior workflow; the gate
names accepted unfinished work. A decline never clears unrelated correctness.
This reuses user-owned scope across all stages, not a second dispute-only policy.

CLI outcomes: changed/0 for a new nonblocking record or confirmed choice;
healthy/0 for an identical nonblocking result or current currency;
action_required/2 for pending authority, unresolved blockers, staleness, unchanged
redispatch, contention or unavailable handoff; failed/1 for invalid input or
provenance. JSON returns disposition, finding identity, gate effect and one action.
No-input/non-TTY never prompts. Offline permits local recording and comparison,
but required network classification/handoff returns action required. Only
classification dispatch or existing host handoff has a network effect.

**Decision:** Portable question, current local authority.
**Choice:** Versioned ticket records bind ticket/review kind, review ID, finding
fingerprint, authenticated origin family, plan and boundary digests, reason,
evidence, disposition and action. Preserve exact reviewed plan bytes alongside
the ticket in the host's ordinary authorized work handoff. Keep authenticated
jobs in their existing local authority store. Display the same pending question
after recovery, but obtain current authenticated evidence before resolving it
or admitting a plan if the old evidence cannot be verified.
**Alternative considered:** Export the integrity key, automatically commit only
the ticket, or make an optional external tracker authoritative.
**Rejected because:** Keys are private; ticket-only export loses plan context;
one-way tracker sync is not an authority/recovery channel.
**Evidence reference:** [NIST MAC overview](https://csrc.nist.gov/projects/message-authentication-codes),
current job key/path binding, [Claude cloud workflow](https://code.claude.com/docs/en/claude-code-on-the-web)
and [Cursor cloud handoff](https://cursor.com/docs/cloud-agent).
**Retrieval date:** 2026-11-14.
**Applicable version:** Current receipt code and host docs checked on that date;
conceptual evidence only, no external code reuse.

The local no-input operation returns pending without reading interactive input.
The host completes its ordinary authorized branch/artifact handoff with ticket
and plan together; confirm their contents before claiming recoverability.
The host workflow's coordinating agent owns confirmation after CLI exit: inspect
the completed handoff's ticket and plan bytes and report their identity and result
in the session handoff. A later session verifies those bytes itself; a prior
success claim is not authority. No new background confirmation service is added.
No automatic ticket-only commit or unrelated-work publication is introduced.
If confirmation fails, return the limitation and one action with approval unchanged;
this is a failed recovery path, not proof of the accepted cloud scenario.
Use five seconds as the local no-input process proof budget, excluding separately
running review jobs, and 30 seconds for handoff confirmation.

On recovery, compare the saved plan/boundary and retain the same pending record.
If fresh evidence differs or omits the finding, retain pending-user-decision with
approval unchanged. The coordinating agent presents the saved question and the
changed evidence for the user's accept/decline scope decision; it cannot silently
cancel the question or substitute a new one. Copied
terminal records likewise grant no authority without a current authenticated
basis. Retain any active review ID and collect it instead of launching duplicates.

**Decision:** Atomic history and stable admission.
**Choice:** Reuse ticket locking, compare-before-write and temporary-file rename.
Recheck ticket, boundary and receipt under the lock. Identical retries return
stored state; conflicts require a fresh read. A crash exposes the old or new
ticket; failed writes grant nothing. Pending/log/bookkeeping records are excluded
from approval identity: logging is not material correction. Existing decline
projection stays unchanged: new-flow user declines use that same identity-bearing
record and stale the dependent review; only pending/log bookkeeping is excluded.
Scope changes and completed classification decisions
that materially change review basis invalidate the affected review kind and its
normal downstream dependencies. A fresh passing exact-plan verdict is required
before advancement; an unchanged disagreement refuses redispatch with its owner.
For each unresolved blocker, a correction record must cite its fingerprint and
the changed decision or accepted-boundary clause, with before/after evidence.
Compare decision text after stripping Markdown presentation, comments and
whitespace: presentation-only edits, logs and unrelated changes are ineligible.
This comparison rejects obvious rerolls; it does not prove semantic correction.
The normal fresh reviewer receives the unresolved findings and correction map
and must explicitly judge whether each cited change addresses its defect. An
unaddressed finding stays unresolved even if the new review otherwise passes.
That authenticated judgment, bound to exact plan and boundary bytes, owns
semantic sufficiency; the author cannot self-certify it. Proof pairs cosmetic,
unrelated and real decision changes, and refuses a passing review lacking the
required blocker disposition. Confirming already-nonblocking classification does
not change the basis; changing a finding's supported gate effect does.
**Alternative considered:** Overwrite status or separate host-owned stores.
**Rejected because:** Those lose evidence or split authority.
**Evidence reference:** Current disposition writer and planning identity projector.
**Retrieval date:** 2026-11-14.
**Applicable version:** Repository base fd784a2fd.

### Data applicability

Data applicability: Extend ticket records, not a new store. Ticket owns the
portable question and accepted scope; coordinator owns review authority. Record
identity/relationships are specified above. Existing project access, privacy and
retention apply; never export private keys or secret-bearing context. Purpose:
preserve an actionable decision without manufacturing approval. Compliance:
retain the existing project audit history and residency; introduce no external
data destination or new compliance claim. Host
handoff is the cross-system flow. Append history and explicitly supersede stale
bindings; no scheduled deletion or backfill. Existing declines remain readable;
unknown record versions are preserved but cannot grant authority. Rollback keeps
new records as history and requires a current runtime to resolve them.

Measurement applicability: skip: no quantitative Product promise. Process budgets
are proof limits, not new user-facing performance targets.

## Design alignment

Architecture applicability: Shared record lifecycle and admission basis change;
the proposed “Disputed Planning Findings” record in ARCHITECTURE.md preserves the
lasting ownership and trust boundary. Honor its planning-provenance and
approval-ledger decisions. Structure enforces: real admission tests prove blocked
correctness and permitted advice. Automate ceremony, not authority: user scope
choices and NTB1.R4 walkthrough retain control and establish comprehension limits.
One owner: all hosts use the shared router/writer, with installed parity proof.

## Known deviations

The user changed the contract on 2026-11-14: automatic correctness arbitration and
the earlier draft's blanket third-agent requirement are removed. Optional
classification and cloud recovery remain required. Vendor documentation is not
real-host proof. #7481 receipt limitations remain; do not
claim stale review evidence is current or alter review policy to progress.

## Doc impact

Document the CLI dispositions, user-owned scope, recovery action and two-agent
optional-classification limit. Explain confirmed versus unavailable handoff and
advisory surfaces.

Rollout and rollback: YCFFNC owns host activation. Release matching readers and
writers together. The user chose on 2026-11-14 to require updated Safeword on
every participating host before using this feature. YCFFNC confirms matching
feature-capable installations before activation; incomplete upgrades leave the
feature inactive. Expand only after installed and recovery proof. Do not roll
back affected projects while dispute records remain unresolved. On false
approval, lost records or incompatible reads, stop feature use, retain history
and repair with the updated runtime before resuming. Older versions do not
enforce these new protections; deliberate old-runtime use and automatic
mixed-version protection are outside the accepted guarantee. This is a
coordinated-upgrade requirement, not a new runtime-version enforcement system.

## Assessment triggers

Reconsider if handoff loses the question or plan, host-user authority cannot be
established, bookkeeping stales its own review, optional classification repeatedly
remains pending, or recovery consumes more review work than the judgment restores.
These trigger design reassessment, not new counters or automatic scope changes.
