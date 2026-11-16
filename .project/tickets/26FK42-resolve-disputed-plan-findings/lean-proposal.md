# Lean dispute-handling proposal

This is a proposal for review, not an approved plan or implemented behavior.
The 2026-11-14 user decision supersedes this proposal's automatic correctness
adjudication direction. See `contract-amendment.md`; the routing paragraphs
below are historical options until parent and child Rules are reconciled.

Accepted product scope and exclusions belong to the user throughout planning
and implementation, whether a change is proposed by an author, reviewer or
another participant and whether anyone disputes it. Adding, removing or
narrowing accepted scope requires the user's decision; correcting an omission
within the accepted boundary does not change scope. Reuse the shared planning
authority contract in `packages/cli/src/planning/shared-contract.ts`; do not
create a separate scope-approval policy for disputes. That contract is reviewer
guidance, not by itself proof of deterministic enforcement at every host or
implementation boundary. The existing review-disposition command records only
user-confirmed declines of approved warning/info findings; it does not provide
general acceptance or durable pending scope decisions. Those capabilities and
authenticated user authority require proof before claiming complete enforcement.
When the user accepts an addition, removal or narrowing, record the authenticated
decision in the authoritative ticket or parent boundary and update the accepted
Rules and scenarios through their existing workflow. Re-review changed context;
the installed plan gate must refuse advancement and name accepted outstanding
work. Declining an addition leaves the accepted boundary unchanged. In a
noninteractive run, return promptly with the choice pending, approval unchanged
and one action to resume; never wait for unavailable input.

Use a small dispute router and existing review machinery. Ask the user whether
scope or optional advice should be adopted; leave unaccepted advice nonblocking.
Compare bound evidence to decide review freshness. A fresh adjudicator applies
the existing optional-strengthening rule when its classification is disputed.
For contested correctness or relevance, attempt each available capable
independent route until a grounded result or route exhaustion, using only the
finding, accepted rules and relevant evidence. Record typed route failures; do
not silently repeat an unchanged route or stop at a fixed attempt count. When no
capable route remains, record unresolved and give one action; never report
approval. Reject unsupported classes and missing originating-reviewer identity;
refuse unchanged redispatch of an upheld closed finding. Scope expansion proposed
by an adjudicator becomes a user-owned pending decision.
Compare the adjudicator's agent family with the authenticated coordinator's
`actual_reviewer` for the originating review; refuse missing or inconsistent
provenance. A fresh process from the origin family is not eligible to
adjudicate alone. A capable route is configured, reachable and independently
eligible. Do not implement or claim this route complete until the unresolved
author-family independence question is settled against R2/R5. Terminal results
are upheld, reclassified, rejected, pending user decision, and unresolved after
available routes; failures preserve the coordinator's typed route evidence.
The existing coordinator compares reviewer and author agent families: same-family
completion is reduced independence. Being different from the originating
reviewer alone therefore does not make the author's family an independently
qualified route under the existing contract. If the configured independent
routes are exhausted, return unresolved and name the next action; do not install
or qualify a provider automatically. This preserves the user-requested
independent resolution but may leave the ordinary two-agent case unresolved.
The closed-upheld redispatch comparison uses the reviewed plan's exact bytes;
semantic review freshness remains the separate provenance comparison.

Keep pending questions and context with the ticket and use the host's normal
work handoff. A later session shows the same question, checks whether old review
evidence is verifiable, and obtains fresh authenticated review evidence only
when needed for authority. If a handoff cannot be confirmed, report that the
record is not durable and leave approval unchanged; do not claim the accepted
cloud recovery scenario is satisfied. Real host reclaim-and-resume proof is still
required.
The pending record binds the review ID, finding fingerprint, accepted boundary
and reviewed plan identity. Those fields identify the question but do not
authenticate the old review in a different runtime.
The handoff must preserve the pending record and exact reviewed plan bytes; a
later session must show the same pending decision while separately obtaining
current authenticated evidence before granting authority. If fresh evidence no
longer contains the finding, preserve the earlier pending record as history and
surface the mismatch; do not silently substitute a new question or approve. The
actual Claude and Cursor host handoff remains unproven; a local file write or a
simulated host is not enough to claim recovery after reclamation.

Avoid a new arbitration service, general review-pass counter, automatic
ticket-only commits, and a blanket third-provider requirement. Do not label a
reduced-independence fallback as independent. Whether a fresh process from the
author's agent family meets the accepted independence requirement is unresolved.
