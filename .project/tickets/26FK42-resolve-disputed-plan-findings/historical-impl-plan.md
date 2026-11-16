# Impl Plan: Resolve disputed plan findings

**Status:** planned
**Planned on:** 2026-11-13

**Reconsideration in progress:** The decisions below are the previously reviewed
draft, not the selected lean design. Its automatic ticket-only branch commit and
blanket exclusion of the author's agent are under reconsideration. Preserve the
review findings as evidence; do not implement or approve this draft until the
revised design resolves the open questions in `lean-proposal.md` and passes a
fresh independent review.

## Approach

**Architecture at a glance:** Extend the existing planning review boundary with a
typed dispute operation. It authenticates the originating review and finding,
classifies the dispute, then routes scope to the user, currency to the existing
review-identity comparison, and correctness, relevance, or optional-advice
classification to an independent adjudicator. The ticket carries the finding,
its provenance, and its disposition; admission reads current dispositions along
with the existing review and approval evidence. Pending human decisions return
promptly with one recovery action. No dispute result by itself approves a plan.

**Riskiest assumption:** A pending ticket record can be recovered after a cloud
runner is reclaimed without claiming persistence merely because a local write
succeeded. The discriminating scenario is “A later review recovers the durable
pending disposition” after a fresh runtime; exercise the actual host handoff,
not a shared temporary directory. This is the first proof to attempt.

**Proof strategy:** At the real CLI boundary, exercise supported and unsupported
classes, missing origin, each typed outcome, and unchanged redispatch refusal.
Integration tests use authenticated review jobs and real admission collaborators;
unit tests cover varying route failures, identity normalization, invalid records,
and concurrent updates. The installed plan gate must demonstrate both disputed
unaccepted advice advancing and accepted unfinished work blocking. Tests can
prove these observable mechanics, not an adjudicator's semantic judgment;
independent review evaluates that judgment. Each new CLI entry point needs an
installed invocation proof. Claude Code, Codex, OpenCode CLI/TUI, and Cursor
need installed dispatch proof; Claude Code Cloud and Cursor Cloud need original
invocation and fresh-runtime handoff proof. OpenCode Desktop and Codex Cloud are
advisory as specified. A simulated host test does not establish actual host
persistence; retain this limitation until a real host boundary proves it.

### Persona consequences

The Technical Builder receives provenance, the authority and one explicit
outcome, and can resume a pending decision without a silent retry. The
Non-Technical Builder receives the finding, choices and a plain recovery action;
neither interface grants approval without authority. A walkthrough can test
understanding but not establish all user experience outcomes; NTB1.R4 owns the
recovery walkthrough. The Maintainer
needs version-compatible records and clear failures when a host cannot read them;
tests prove compatibility, not the maintainer's experience.

### Current and target truth

Existing disposition code records confirmed declines of warning/info findings
from approved reviews and binds them to the accepted boundary; its noninteractive
path returns pending without persisting it. Review identity and approval
admission already exist. Dispute routing, durable pending recovery and the
associated proof are proposed, not implemented. No new human approval or
independent review is implied by this plan.

## Decisions

### Recorded Decisions

**Decision:** Finding authority and result.
**Choice:** Require origin identity and a stable fingerprint bound to the
authenticated review, ticket, reviewed identity and accepted boundary. Route
scope adoption only to the user; route currency to the existing identity
resolver; route correctness, relevance and disputed classification to a fresh
independent reviewer who did not originate the finding. Record upheld,
reclassified, rejected, pending user decision, or unresolved after available
independent routes. Unrecognized classes, absent provenance, stale inputs and
unavailable routes fail closed; the origin alone cannot adjudicate. A result
does not mutate accepted scope or grant approval. A user acceptance enters scope
through the existing scope-authority workflow, after which unfinished accepted
work blocks the gate. Unaccepted optional advice remains nonblocking.
Eligibility excludes both the origin's agent identity and the author's agent
identity, even in a fresh process; an unknown identity is ineligible. Reduced
same-agent, fresh-context and author self-review fallbacks cannot adjudicate a
correctness dispute. Exhaustion means every configured capable independent
route has failed or is unavailable; record unresolved and each route's typed
evidence. Record the actual adjudicator and achieved independence with a result.
An adjudicator proposing expanded scope produces a pending user decision, not a
blocking requirement. With only the author and origin agents configured, no
third eligible agent may exist: record unresolved and name the action to add a
capable independent route, then resume against current evidence.
The caller's class is a claim, never authority: currency is accepted only for
a provenance comparison. A claimed scope or optional-adoption dispute goes
directly to the user for an accept-or-decline choice, including when independent
routes are unavailable. That choice decides scope only; correctness, relevance
and optional-classification disputes still require independent adjudication.
Its structured result identifies whether the finding enforces accepted scope or
proposes an expansion, citing the applicable boundary. A user decline records
the scope choice but cannot by itself dismiss an unresolved correctness error.
A confirmed in-scope defect remains blocking; an unclassified error stays
unresolved and cannot be declined away. User acceptance records `accepted`
and changes the authoritative scope; the gate blocks until the work is done.
User decline records `declined` against the finding and boundary; a finding
confirmed as expansion is nonblocking even if originally labeled error, while
unresolved correctness and unrelated in-scope errors remain blocking. Both choices return changed (0) once safely recorded; neither
approves the plan. A changed boundary invalidates the old disposition.
Capable means a configured, reachable route eligible under the identity rule;
do not introduce model rankings as a capability gate.
**Alternative considered:** Let the original reviewer decide or treat every
finding as blocking; use a fresh process of the author's agent with reduced
independence.
**Rejected because:** Either assigns scope or correctness authority to the
interested reviewer; the author's own fresh process remains an interested party
and cannot provide the requested independent correctness adjudication. The cost
is that a two-agent installation may require another route to resolve a dispute.
**Evidence reference:** Parent TBU5.R1–R5 and the existing planning provenance
architecture in `ARCHITECTURE.md`.
**Retrieval date:** 2026-11-13.
**Applicable version:** Current repository planning contract at this worktree's
base; no new dependency.

**Decision:** Durable dispute handoff.
**Choice:** Store each versioned pending or terminal record in the authoritative project ticket,
with finding identity, reviewed identity, accepted boundary, choices, and one
recovery action. In a cloud run hand off the ticket on the task's remote branch:
commit only the ticket record (refuse unrelated staged changes), publish that commit through the host's authorized
branch workflow, then confirm that the remote branch resolves to a commit whose
ticket blob contains the record. Report the branch, commit and ticket path as
the recovery locator. A local write or a push request alone is not confirmation.
A later session checks out the indicated commit or descendant, reads the ticket,
and revalidates the finding, review and boundary bindings before resolving it.
When publication or confirmation is unavailable, return a distinct persistence
failure promptly, leave approval unchanged, and surface the finding and action;
never report the record as durable. Local runs retain the ticket in the
project workspace and do not require network access. The operation does not
create or promote a pull request or merge. A host-created PR is tolerated and
confers no authority. Bound publication and confirmation together to 30 seconds;
timeout returns the persistence failure and the branch and recovery action.
Do not write a self-referential confirmation into the ticket: the local commit
and the remote branch's verified commit and ticket blob are the confirmation.
After a crash or timeout, retry first checks whether the remote contains the
same record; if so return the stored outcome. Otherwise retry publication of
the existing commit, without re-adjudicating or creating duplicate records. If
the local commit is gone and no matching remote record exists, report the lost
attempt and start fresh adjudication against current evidence; do not invent a result.
The matching remote record wins on retry. A rejected non-fast-forward push is a
visible conflict requiring a fresh read, not a successful handoff. A
terminal result is successful in cloud only after the same confirmation as pending.
After a crash before commit, retry commits an intact matching ticket record;
if adjudication finished but no record survived, report the lost attempt and
start a fresh adjudication from current evidence rather than claiming a result.
**Alternative considered:** Store the only authoritative copy in a GitHub or
Linear issue, or assume the runner's file persists.
**Rejected because:** Tracker integration is optional and one-way today; runner
storage alone cannot prove recovery after reclaim.
**Evidence reference:** [Claude cloud sessions](https://code.claude.com/docs/en/claude-code-on-the-web),
[Cursor cloud handoff](https://cursor.com/docs/cloud-agent),
and the repository tracker integration documentation.
**Retrieval date:** 2026-11-13.
**Applicable version:** Host documentation checked on that date; current
repository tracker contract.

**Decision:** State, concurrency and retry.
**Choice:** Preserve versioned historical records; validate fingerprint,
identity and boundary at read and before writing. Serialize ticket updates and
compare the prior bytes and bound evidence under the lock; write a same-directory
temporary file and rename, returning a visible failure on conflict or write
failure. Do not claim power-loss durability from rename alone. A closed finding
on unchanged reviewed bytes cannot be silently redispatched; changed plan bytes
start a normal fresh review. Independent adjudication continues through capable
independent routes until a result or route exhaustion, without a fixed pass cap.
Preserve existing records without backfill; unknown or malformed current records
must not grant authority. Rollback retains records as historical data and older
readers must not treat unsupported records as approval.
The phase-specific identity projector excludes pending, upheld, unresolved and
route-evidence records. It includes rejected and reclassified results and the
existing authenticated declined dispositions. Acceptance changes the accepted
scope itself, which is identity-bearing; the acceptance receipt is not projected
twice. Thus upheld or unresolved alone cannot stale a review or authorize retry;
integration proof compares identity before and after each of those records.
accepted scope changes and user declines retain their existing 5F5ZZA currency
rules. A closed finding is keyed to its original reviewed bytes and disposition:
an upheld result with unchanged bytes refuses redispatch. A rejected or
reclassified result changes the review basis and permits one fresh review even
if plan bytes are unchanged. Pending user decisions and unresolved correctness
remain action required; neither authorizes a fresh approval pass until resolved.
The shared `planning-context-identity` projector applies the table above;
existing `review_dispositions` remain identity-bearing.
Rejected and reclassified results join the next review identity; the closed-dispute guard treats
rejection and reclassification as corrections, but not an upheld result alone.
This extends the 5F5ZZA
projection rather than changing its existing decline behavior; the durable
architecture record captures the extension.
Project only identity-bearing records for the disputed review kind into that phase's identity;
normal downstream dependencies still invalidate when their upstream plan changes.
A stable fingerprint across review jobs binds normalized finding content and
accepted boundary. If a fresh review re-raises the same rejected or reclassified
finding on an unchanged substantive basis, stop with the closed disposition and
owner instead of creating another dispute or silently redispatching. Admission
does not suppress the new blocking finding or approve from the old disposition.
The plan author owns recovery: inspect the finding and prior disposition, then
materially correct the plan or review basis before requesting a fresh review.
If that requires a user-owned scope decision, record it through the normal scope
path. A cosmetic edit or unchanged retry cannot restart the cycle.
**Alternative considered:** Mutable unbound status or a separate general-purpose
arbitration database.
**Rejected because:** The former loses authority and evidence; the latter adds a
new system without an accepted general arbitration requirement.
**Evidence reference:** [SQLite atomic commit](https://www.sqlite.org/atomiccommit.html)
illustrates why crash durability needs more than a simple rename; existing
`review-disposition.ts` supplies the local lock and compare/write pattern.
**Retrieval date:** 2026-11-13.
**Applicable version:** Current repository implementation; SQLite documentation
is conceptual evidence, not a selected dependency.

**Decision:** CLI and rollout.
**Choice:** Add `ticket resolve-review-dispute` with ticket ID, review ID,
finding number and explicit dispute class. Accept and decline require the
existing 5F5ZZA authenticated host-user-event provenance bound to this finding,
choice and current boundary. A CLI stdin answer or an agent assertion is not
user provenance. Hosts without that provenance return pending with no decision
written; each host requires real-boundary proof, including refusal of a piped
agent answer. A scope choice goes directly to the user;
any disputed correctness or classification remains independently adjudicated
before it can be dismissed. Currency resolves
to current or stale, reported as `healthy` (0) or `action_required` (2).
Return `changed` (exit 0) for a newly
recorded upheld, reclassified, rejected, accepted or declined disposition,
`healthy` (0) for an
identical confirmed resolved result,
`action_required` (2) for pending user authority, unresolved after available routes,
or failed durable handoff or unchanged closed redispatch, and `failed` (1) for
unsupported class, missing provenance or malformed input. JSON reports the
typed outcome, origin, review identity, achieved independence, route failures,
and recovery action. `--no-input` never prompts; `--offline` refuses a required
network adjudication or cloud handoff with action required. Catalogue branch
publication as a network effect. Repeated identical requests return the stored
result; conflicting or concurrent writes compare under the lock and require a
fresh read rather than overwriting. Enable the shared route by default only
after the reader and writer ship together on each supported host. During mixed
versions, preserve the ticket's human-readable pending finding and recovery
action; an older host must not claim it resolved and the user upgrades or opens
the branch with a current host. YCFFNC coordinates host delivery. Expand only
after installed boundary and fresh-runtime recovery proof; reverse activation
on lost records, false authority or incompatible reads, retaining history.
**Alternative considered:** Implicit dispatch or opt-in per-host state.
**Rejected because:** Implicit outcomes hide failures; per-host state drifts.
**Evidence reference:** Existing CLI result protocol and host delivery contract.
**Retrieval date:** 2026-11-13.
**Applicable version:** Current repository CLI and planning contract.

### Data applicability

Data applicability: Purpose is recovery and auditable authority. The project
ticket is the proposed store and source of truth; each record belongs to one
ticket and bound finding, and writers are the dispute operation or authorized
user-decision path. Preserve existing history; do not backfill invented decisions.
No cross-tenant service, scheduled deletion, data migration or new compliance
obligation is introduced; ticket access and retention follow the project. Cloud
handoff is a cross-system flow to the authorized remote task branch, confirmed
against its commit and ticket blob. Remote unavailability is a visible failure,
not a durable record. Rollback preserves records without granting authority to older readers.
Do not export finding text to a tracker without honoring existing egress policy.

Measurement applicability: skip: the child makes no quantitative product
promise; scenario and host-boundary evidence establish observable behavior.

## Design alignment

Architecture applicability: This changes review authority and durable state.
Honor `ARCHITECTURE.md`'s planning review provenance, approval-ledger and
“Disputed Planning Findings” records. Structure enforces authority: admission and identity
checks prove it, not a prompt. Optimize for the non-technical builder: a recovery
walkthrough proves the action is understandable, while technical provenance
remains available. Those tests do not establish the complete user experience.

## Known deviations

The cloud handoff requires a remote branch and appropriate host authorization;
an unavailable handoff is reported as failure rather than pretending that a
local write satisfies the recovery scenario. Host-specific execution remains
to be proven, not assumed from vendor documentation.
Correctness adjudication deliberately excludes reduced same-agent and self-review
fallbacks despite the general best-available review direction and the proposed
`Independent Review Never Blocks` architecture: the parties to
the dispute cannot independently settle it. With only Claude and Codex, an
author and originating reviewer using those two agents leave no eligible route;
the result stays unresolved until another independent route is configured.

## Doc impact

Update the configured CLI and tracker documentation to describe dispute outcomes,
user-owned decisions, recovery and the actual persistence limits. Do not promise
tracker-backed recovery where no supported integration exists.

## Assessment triggers

Revisit on a host handoff that cannot preserve the ticket, a false-current
identity, an untrusted adjudicator accepted as independent, concurrent writes
losing a disposition, a tracker ownership change, or a recovery path users
cannot understand.
