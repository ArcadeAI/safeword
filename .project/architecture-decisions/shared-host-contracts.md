# Shared host contracts and proof gated delivery

**Status:** Proposed, 2026-10-20. Implementation owner: ticket 2ENRH5.

## Context

Safeword's native integrations must preserve different host guarantees while
sharing workflow content and policy. Generating equivalent files does not remove
independent policy ownership. Package discovery alone cannot prove protection,
and a local migration cannot authorize removing shared files for other clones.

## Decision

Extend the canonical schema and integration registry with separate delivery and
enforcement contracts. Shared content and policy each have one authoring owner;
host adapters own mechanics. Every shipped facet has a disposition for every
supported version/runtime lane. Required exact-target host proof remains distinct
from structural coverage, portable loading and runtime activation.

Customer status combines current trusted local activation with an integrity-bound
package conformance declaration matching payloads, exact host/runtime, guarantee
and tested configuration class. Host-binding proof composes with schema-bound
shared-policy proof of allowed-value partitions and every interaction declared
by schema constraints or a shared policy branch; do not
require a separate host run or customer setup for supported non-default values.
Adapters transport those values to the shared owner without interpreting policy.
New options need explicit policy-proof and routing coverage. Unsupported binding
changes cannot inherit this proof. The release conformance controller alone derives
that declaration from validated originating-run receipts. Existing package identity,
trusted distribution and commit-bound release checks establish its trust boundary;
self-hashes cannot authenticate an untrusted package. Never distribute profile
integrity keys. Old packages cannot inherit new contracted guarantees. Before
release, all maintained existing lanes and supported configuration classes require
applicable entries; users do not rerun release suites during ordinary installation.
This includes retained Cursor project-hook delivery: its own exact IDE proof and
binding class, CLI-owned template identity and legacy activation preserve healthy
unenrolled desktop status without native caches. Cloud keeps its existing weaker
configuration report and gains no desktop-derived enforcement claim.
An explicit local sealed conformance run may instead establish a custom class for
the same exact installed payload/target on that machine. It cannot waive release
checks or become portable proof. Unproved required classes yield action_required
with healthy activation separately disclosed; preserve user options and suppress
repeat notices for an unchanged limitation.

The selected-host lifecycle controller alone writes profile-local enrollment,
keyed by machine/profile, canonical checkout realpath and host lane. It binds the
delivery set, epoch and migration journal. Enrollment is never committed or
inferred from a Git remote. Installed hooks separately own activation observations
and the current session handshake; they cannot enroll a checkout. Missing or
foreign enrollment cannot disable legacy protection.

Cursor packages remain in an immutable cache outside automatic global discovery.
A project workspace bootstrap loads the enrolled package set. Shared legacy
hooks and reachable resources remain available for unenrolled clones and existing
cloud project-hook use. A local session/epoch gate selects exactly one dispatch
authority after native registration proof; loading failure retains legacy authority.
Retirement of shared compatibility resources needs a separate project-wide
migration decision. Cursor's existing project-only architecture is superseded
only in this local proved native path when implemented; existing behavior remains
current until then. No new cloud guarantee follows from desktop proof.

OpenCode V2 uses a profile-wide plural plugin declaration but activates only in
explicitly enrolled locations. Preserve V1's singular declaration and resources,
prove shared-profile readability on both exact versions, and never substitute
V2 evidence for V1 CLI/TUI evidence. Uninstall honors remaining consumers.

Trusted conformance and capture controllers exclusively write versioned sealed
conformance-run and owner-inventory records respectively. Native activation stores
remain the sole authority for live observations. Reuse profile-owned receipt
integrity and atomic publication; project JSON cannot manufacture a pass. Preserve
failed attempts and before/after ownership identities until explicit evidence
cleanup. Package declarations are derived immutable projections, not another
observation authority. Identity changes invalidate applicability; rollback creates
new evidence and cannot rewrite failed history.

## Consequences

Canonical changes require no equivalent host-policy edits. Necessary generated
copies and compatibility bridges remain, but they have no independent authorship.
Status can distinguish tested package behavior from current local activation.
Single-owner cutover, journaled recovery and ownership checks preserve user edits,
other checkouts and unselected integrations. Unknown proof remains incomplete.
New enrollment/evidence schemas become shared compatibility contracts.

## Alternatives

A universal runtime erases host semantics and adds infrastructure. Generation
alone retains parallel policy. Activation-only status overclaims guarantees;
running complete suites in every customer project adds redundant host setup.
Profile-wide Cursor activation affects unenrolled projects. Deleting shared hooks
after one local cutover removes protection for teammates/cloud. Unsigned project
assertions and cross-machine receipt-key sharing cannot establish the chosen trust
boundary. Permanently active dual delivery makes ownership ambiguous.

## Reassess

Revisit if exact-target native registration or automated proof fails, the host
cannot provide a single-owner session handshake, configuration classes cannot
represent supported guarantees, package provenance/integrity loses its binding,
V1/V2 profile coexistence fails, or recovery cannot preserve user ownership.
New host capability may replace a translation only after equivalent proof.

## Implementation

All behavior here remains proposed. Ticket 2ENRH5 owns implementation and its
feature-local design in `impl-plan.md`; this record owns the durable cross-feature
constraints. Mark the existing Registry-Driven Agent Integrations decision
partially superseded only when proved Cursor cutover ships. Retain the complete
native-bundle resource contract and single installed-CLI resolver.

## Cursor target update after the user's upgrade

On 2026-10-20 the user upgraded Cursor and asked to resume. The running installed
app reports 3.24.18, build be4c9e5350d77747b42cd467cbd3370a753d4640,
arm64. Strict code-signature verification passed with vendor team VDXQ22DGB9.
Native Cursor delivery now targets that exact installed version. The previously
accepted 3.8.23 project-hook compatibility regression remains required and separate.
The matrix therefore contains six version lanes and eight runtime rows. Four
supported agents and the accepted behavior/inventory scope remain unchanged.

This is an explicit engineering target update following the user's upgrade,
not substitution of a passing newer run for a failed pinned run. Earlier native
3.8.23 observations remain historical and cannot establish native 3.24.18 loading,
guards or continuation limits. Refresh scenario and planning reviews before
production implementation. Test profiles and workspaces remain isolated; never
change the user's normal Cursor profile or grant host trust to make a proof pass.

## Customer compatibility versus exact proof

Engineering completion requires every exact target receipt. Customer status uses
an explicit publisher-owned binding compatibility policy from the same central
registry, sealed with release proof, plus current local activation. Details keep
observed and reference versions distinct. Reuse existing support predicates for
existing delivery; new Cursor native and OpenCode V2 lanes start exact. Changed
required protocol/capability/continuation semantics invalidate only affected
claims. Additional upgraded-host controls cover Claude 2.1.289, Codex 0.163.0 and
Cursor 3.24.18 project hooks without replacing reference targets. New CLI/old
package preserves historical status and exit semantics, adding advisory missing
contract proof. See impl-plan.md's Customer version applicability and Status
compatibility and recovery for the authoritative feature design.

A version change always invalidates the previous local claim. Compatibility
renewal derives a proof chain on each read from a new exact-observed native
activation plus validated sealed publisher policy and reference proof. No
renewal receipt, new key or new writer is introduced. Matching a version predicate or reusing old
activation never renews proof; status stays not active until renewal. This is
supported-binding proof, explicitly distinct from repeating an exact-target run.

Cursor retains generated project rules and command wrappers as their sole
registrations in every mode. The native extension adds hooks and worker
projections only, registering no rules, commands or skills. Core owns native
skills/resources; shared origin resolution directs wrappers to the active content
owner. Actual IDE catalogue/origin proof must reject duplicate public workflows
or simultaneous loaded content sources before native cutover; hook gating cannot
suppress native project-rule/command discovery.

Wrappers are checkout-invariant. Invocation-time resolution uses a schema-owned
mechanical bootstrap and existing single CLI resolver to choose one contained
core resource for a verified native handshake or one legacy project resource
otherwise. Cutover never rewrites tracked wrappers. Native failure restores
legacy authority; missing both origins reports unavailable. This guidance
mechanism cannot create enrollment or conformance proof.
