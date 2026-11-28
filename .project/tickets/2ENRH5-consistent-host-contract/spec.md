# Product Plan: Reduce duplicated maintenance and agent drift for Safeword maintainers

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

**Scope amendment, 2026-11-23.** The user selected `@opencode/cli` 2.4.1
as the sole active OpenCode release. CLI and TUI each require fresh runtime
qualification for their own delivery and guarantees. Earlier OpenCode
releases, fallback binaries and compatibility lanes are out of scope. OpenCode
2.2.6 observations retain their original identities as historical evidence.

**Scope amendment, 2026-11-07:** The user explicitly retired older versions of
all agents in [the current-host-only authority](evidence/current-host-only-user-authority.json).
One independently verified current release per agent surface is in scope;
cross-host-version compatibility matrices, older binaries and fallback proof
are not. Cursor CLI/IDE and OpenCode CLI/TUI remain distinct runtime boundaries.
Current-host Safeword configuration reconciliation and selected project-hook
delivery remain required. Historical proofs do not certify the new releases;
all in-scope guards, trust, admission and shared behavior remain unchanged.

**Scope amendment, 2026-11-06:** [User-authorized V1 retirement](evidence/opencode-v1-retirement-user-approval.json) supersedes prior V1 support obligations. Prior bytes and review inputs are retained in [the retirement archive](evidence/opencode-v1-retirement-before-hashes.json). V2-only OpenCode support does not reduce any other host or shared-behavior requirement. The user states V1 was unused; no independent usage measurement is claimed.

- **Problem / Why now:** A shared Safeword change can require repeated edits,
  translation, and verification across agent integrations. Those maintenance
  paths create opportunities for workflow and enforcement drift. The user's
  primary goal is to minimize this duplicated work and drift without having to
  think through each agent when requesting or developing a shared behavior.
  Safeword owns adapting that intent to every supported agent. A common interface
  alone is insufficient if maintainers still reimplement policy or manually
  coordinate host coverage.
- **Expected outcome:** Maintainers describe and author shared behavior once.
  Safeword accounts for every supported agent, derives its delivery, and verifies
  the strongest effective implementation that preserves the behavior's required
  guarantees. Adapters contain only necessary differences in host mechanics.
  Builders use the workflow without choosing packaging, hooks, or fallback
  strategies. Host differences appear only when a limitation requires a user
  decision, with its consequence and a recommended next action; technical
  capability evidence remains available on demand.
- **Persona outcome inventory:** SWM authors shared behavior once with automatic
  host coverage; TBU keeps dependable workflows and preserved project choices;
  NTB receives truthful protection and actionable recovery without host design
  decisions. The accepted jobs and Rules below own these outcomes.
- **Known facts:** Canonical templates, schema-driven reconciliation, a four-agent
  integration registry, and native Claude and Codex delivery exist. OpenCode V1
  delivery predates this ticket. The
  ticket records source-reviewed precedents and exact engineering test targets;
  none establishes new native Cursor or OpenCode V2 runtime proof.
- **Assumptions:** Small delivery/enforcement contracts and host-native resource
  loading can remove independent authoring while preserving each required
  guarantee. Installed-host proof and the before/after ownership evidence must
  validate this assumption before completion.
- **Unresolved product decisions:** None. The Product Bet, jobs, ten Rules,
  milestones, scope and repaired scenarios are accepted. Versioned API mechanics
  and proof execution are engineering decisions, not permission to change scope.
- **Success threshold:** For the agreed migrated capability inventory, changing
  an existing shared rule or skill that needs no new host capability requires
  one authoritative edit and regeneration, without editing equivalent policy or
  content in individual adapters. Shared conformance scenarios prove the change
  reaches all applicable hosts. Required repository checks reject stale generated
  delivery, bypasses of shared policy, and unsupported protection claims. Every
  migrated capability has an explicit disposition for every supported host lane,
  including separate OpenCode V2 2.4.1 CLI and TUI lanes and
  permitted alternatives and unavailable or inactive protection. Delivery changes
  preserve project-owned tickets, learnings, and configuration. Exact inventory
  and host versions must be settled before intake exits; a foundation demo alone
  does not prove complete migration. Generated copies are acceptable; independently
  maintained copies of shared behavior are the duplication to eliminate. A
  maintainer's shared change automatically accounts for every supported agent
  without asking them which hosts to update or how to adapt the behavior.
  Omitting an agent cannot count as completion. Host selection and existing user
  authorization still govern installation and mutation; coverage does not mean
  installing or probing agents the user has not selected. When no implementation
  can preserve a required guarantee, Safeword identifies the blocker and the next
  action rather than claiming success or silently weakening that guarantee.
- **Project non-goals:** Changing upstream APIs; treating prompts as enforced
  guards; guaranteeing interception where the host exposes no boundary; inferring
  cloud or desktop parity from CLI proof; introducing an MCP server solely for
  packaging; changing unrelated workflow policy; publishing or releasing.
- **Reversibility:** One-way: delivery migrations and contributor-facing
  contracts create compatibility obligations. Internal implementation remains
  replaceable.

The implementation must reduce independent maintenance paths, not merely add
interfaces around them. Reuse bundled content directly where a host permits it;
derive copies only where needed. Keep content delivery and enforcement as small,
separate boundaries around existing shared owners. Record which parallel edits
or policy implementations each consolidation removes. The
[engineering scope](./ticket.md#research-derived-design-constraints) connects
these constraints to the assessed implementation precedents.

## Jobs To Be Done

### consistent-host-contract.SWM1 — Change shared behavior once without agent drift

**Persona:** Safeword Maintainer (SWM)

> When I ask for a Safeword improvement, I want to express the behavior once and
> have Safeword make it work effectively across every supported agent without
> asking me to manage their differences, so supporting more agents does not
> multiply my maintenance work or let their workflows drift.

This is the primary job. The builder jobs below preserve the user experience
while maintenance is consolidated. A new host capability can require adapter
work; an existing shared behavior change should not require parallel policy edits.

#### consistent-host-contract.SWM1.R1 — Shared behavior has one authoritative definition

A change to an existing shared skill or policy, within the capabilities already
supported by the adapters, is authored once and reaches every applicable agent
through derived delivery. Maintainers do not edit equivalent behavior separately
for each host. Necessary host translations may differ; they do not independently
own the workflow rule. Generated copies are permitted and must be reproducible
from their authoritative sources.

Essential rules shared by testing and review are authored once and included
automatically in each applicable workflow's delivered instructions. Generated
repetition is permitted; separately authored equivalents are not. Optional
examples and background remain references. Required output checks reject missing,
stale or oversized essential content; delivery alone proves neither understanding
nor behavior at an unobserved host boundary.

#### consistent-host-contract.SWM1.R2 — Every supported agent is accounted for automatically

Adding or changing shared behavior requires no user-supplied host checklist.
Safeword includes every supported host lane in its coverage result, with separate
OpenCode V2 CLI and TUI dispositions and a proven
implementation, a centrally permitted alternative, or an explicit unmet
requirement. A missing adapter disposition or missing required proof prevents a
change being reported complete; a declared limitation is not a passing
implementation of a required guarantee. New host capabilities require adapter
work, but do not authorize new copies of shared policy.

#### consistent-host-contract.SWM1.R3 — Required checks prevent drift and policy bypasses

Required repository checks reject stale derived content, missing capability
dispositions, and integration paths that bypass the shared decision boundary or
maintain a second authoritative implementation of shared policy. Behavioral
conformance proves claimed enforcement at the promised boundary; capability
labels and structurally valid packages alone cannot satisfy that proof. These
checks govern migrated existing behavior and future additions to that contract.

### consistent-host-contract.TBU1 — Keep the workflow dependable when changing agents

**Persona:** Technical Builder (TBU)

> When I work on the same project through different coding agents, I want
> Safeword to handle each agent's integration automatically, so I can use the
> same workflow without learning host mechanics or discovering silent changes
> in protection.

#### consistent-host-contract.TBU1.R1 — Host adaptation preserves the promised outcome

Safeword automatically uses the strongest verified host mechanism that satisfies
a behavior's required guarantees. Equivalent mechanisms may differ between hosts.
A weaker alternative is eligible only when shared policy explicitly permits its
weaker guarantee; adapter-specific convenience cannot silently change policy.
Ticket-transition enforcement and conversation continuation remain separate
outcomes, and evidence for one cannot establish the other.

#### consistent-host-contract.TBU1.R2 — Active protection is distinguished from host potential

Safeword reports protection as active only when the selected host, delivery, and
required activation or trust conditions have applicable evidence. Unsupported,
unknown, disabled, untrusted, failed, and stale-evidence states cannot inherit a
healthy claim from a host capability declaration. Changes that invalidate the
proof invalidate the claim until protection is verified again. Host limits and
continuation limits remain part of the claimed guarantee.

### consistent-host-contract.NTB1 — Know what protection works and how to recover

**Persona:** Non-Technical Builder (NTB)

> When my agent cannot provide a protection Safeword needs, I want a plain
> explanation of what remains protected and the next action available to me,
> so I can make progress without trusting a guarantee that is not active.

#### consistent-host-contract.NTB1.R1 — Routine host differences need no user coordination

When a verified implementation or permitted alternative can serve the requested
behavior, Safeword handles adaptation without asking the user to choose hooks,
packaging, translations, or which supported agents to update. Routine differences
do not create repeated warnings or decisions. Technical capability details and
proof remain available on request.

#### consistent-host-contract.NTB1.R2 — An unmet guarantee has an honest recovery path

When no available implementation can satisfy a required guarantee, Safeword does
not claim the affected behavior is protected or complete. It explains the
specific affected outcome, what remains usable, and a concrete recommended next
action. It requests user input only when a real decision or authorization is
needed; it does not automatically weaken the guarantee or imply it can block an
action at a boundary the host does not expose.

For a selected OpenCode installation whose detected version is unlisted,
Safeword status reports the applicable package facts, withholds the affected
protection claim, and recommends updating Safeword and restarting OpenCode.

### consistent-host-contract.TBU2 — Update the framework without duplicating project files

**Persona:** Technical Builder (TBU)

> When I install or upgrade Safeword, I want reusable framework content delivered
> through the host's supported plugin mechanism while preserving my project
> knowledge and choices, so updates do not duplicate workflow files or overwrite
> my work.

#### consistent-host-contract.TBU2.R1 — Framework delivery derives from shared content

Safeword delivers the contracted workflow content and runtime through supported
host plugin mechanisms without requiring independently maintained project copies
of that framework. Portable Agent Plugins components are reused where supported;
host-specific extensions supply the required capabilities beyond the portable
core. Existing shared generators or adapters are extended where they serve this
contract rather than creating parallel authoritative catalogues.

#### consistent-host-contract.TBU2.R2 — Delivery changes preserve project ownership and selection

Install, upgrade, repair, and uninstall preserve user-authored tickets, learnings,
configuration, and unrelated host assets. Migrated Safeword-owned assets do not
leave competing active framework authorities. Existing host selection and
required user authorization govern mutations and executable probes; automatically
covering every supported host in development does not enroll unselected hosts in
a user's environment.

#### consistent-host-contract.TBU2.R3 — Native Codex delivery preserves canonical workflow invocation intent

On native Codex, builders discover and use shared workflows according to their
canonical invocation settings without managing host packaging. Internal-only
workflows are absent from user-facing selectors while remaining available to
eligible automatic requests and permitted public-workflow handoffs. Public and
manual-only workflows retain their intended explicit controls. Disabling model
invocation excludes a workflow from automatic discovery; absent flags retain
their canonical defaults.

Fresh requests discover current installed procedures through full canonical
descriptions. Fresh/resumed native startup automatically delivers the existing
bounded required essential block as current developer context before task tools;
restart proof requires this actual current delivery and successful observable
requested testing behavior, not a separate procedure/optional guide open or
understanding. Shared knowledge delivery neither invokes disabled/manual workflows
nor changes their discovery settings. Public handoffs resolve the same
procedures and complete referenced resources when the builder follows their
existing references; optional guidance need not be consumed by every unhinted review.
The canonical quality-review Wiring gate remains mandatory, while reading its
extra testing resource remains optional. A representative public review identifies
missing real-collaborator coverage that conceals a concrete wiring defect, with
an actionable finding, while accepting its correctly wired and covered control.
Loading a procedure alone does not prove this judgment. Procedures and invocation settings
have one authoritative source; necessary host projections do not introduce
separately authored procedures or triggers. Reading an internal procedure grants
no review, continuation, outbound, planning or write authority: the existing
guards and authorization still govern attempted actions. Missing required
discovery, resources or guard proof cannot be advertised as a satisfied
invocation guarantee. This Rule adds native Codex invocation proof; all existing
other-host, portable-delivery and complete propagation obligations remain.

Product Bet, jobs, ten Rules, Shape, Killer Demo, and the refined
[engineering scope](./ticket.md#proposed-engineering-scope) are accepted. The
requested fresh-reader check found the original artifacts sufficient for
scenario definition and planning. The human authorized this additional native
Codex invocation Rule after the isolated diagnostic; its scenarios and
production plans require fresh review before implementation.

## Shape

### M1 — Make one shared change reach every existing integration

- **Outcome:** A maintainer changes contracted behavior once. Claude Code,
  Codex, Cursor, and OpenCode consume the same shared policy and content through
  their existing delivery paths. Host translations declare capabilities and
  permitted alternatives; coverage is derived automatically. Required checks
  detect stale derived output, missing host coverage, and policy-boundary
  bypasses. The existing registry is the starting point, not a second framework.
- **Completion evidence:** A shared-rule change reaches all four integrations;
  deliberately stale output, missing coverage, and a policy bypass fail required
  checks. Each claimed runtime guarantee has proof at its actual boundary.
- **Non-goals:** Changing packaging before the shared contract is adopted; new
  workflow policy; claiming all historical behavior is migrated without an
  explicit inventory. This milestone does not complete the overall feature.

### M2 — Deliver the same framework through native plugins

- **Outcome:** Existing Claude and Codex plugins derive their shared assets from
  the contract. Cursor gains plugin delivery and OpenCode V2 gains native package
  delivery, reusing portable Agent Plugins components where supported. Install,
  upgrade, repair, and uninstall preserve project knowledge and user-owned host
  settings. Old Safeword-owned delivery cannot remain as a competing authority.
  OpenCode V2 2.4.1 is the sole supported OpenCode target. Retire V1 active delivery,
  configuration/schema ownership, runtime selection and V1-only proof obligations.
  Do not activate V2 without its current admission/activation proof. User-owned
  content and historical evidence remain preserved; no V1 migration layer is required.
- **Completion evidence:** Installed packages expose the contracted workflows
  and exercise the promised guard boundary; lifecycle fixtures demonstrate
  preservation, idempotency, and recovery without enrolling unselected hosts.
- **Non-goals:** A universal executable plugin API, upstream host changes,
  introducing an MCP server only for packaging, or replacing the entire
  project-owned configuration tree with a plugin.

### M3 — Prove continued consistency and make drift block release

- **Outcome:** The supported host set, shared behavior inventory, derived
  delivery, and conformance evidence drive the required release checks. A shared
  content or policy update covers every supported host without asking the author
  which agents to update. Protection claims depend on applicable evidence and
  active configuration; unavoidable limitations have actionable recovery.
- **Completion evidence:** The Killer Demo passes, both a shared policy update
  and a shared skill update reach all applicable hosts without equivalent
  adapter edits, and negative controls reject stale delivery, invalidated proof,
  and policy bypasses. Every accepted Rule has scenario evidence. Manual host
  observations, where necessary, are explicit evidence with an identified
  version and boundary; they cannot be reported as automated checks.
- **Non-goals:** An adapter declaration standing in for runtime proof, a
  foundation-only release being called complete, or new cloud enforcement
  claims inferred from local host checks.

M2 depends on M1; M3 closes the full delivery rather than postponing validation.
Each milestone verifies the behavior it introduces before the next depends on
it. The overall feature includes all three milestones; separate reviewable
changes may implement them without deferring the accepted outcome.

## Killer Demo

> For a Safeword maintainer tired of updating four integrations, changing one
> shared verification rule produces the corresponding behavior in Claude Code,
> Codex, Cursor, and OpenCode without equivalent per-agent edits or a manual host
> checklist, visibly proven by the complete host coverage result, rejection of a
> deliberately stale output, and an honest recovery message where a host cannot
> provide the required guarantee, within the declared supported host versions.

Expected demo journey:

1. Start with supported installed host fixtures and the same ticket missing
   required verification evidence. Show the current coverage and protection
   evidence, including any declared host limitation.
2. Change the shared verification rule at its authoritative source. Run the
   normal derivation and conformance entry point without providing a host list.
3. Each supported adapter receives the new decision through the shared policy.
   The host result is assessed against its specific promised guarantee; ticket
   rejection does not count as proof of conversation continuation.
4. Leave one generated delivery stale. The required check rejects it and names
   the repair; regenerated delivery passes the same check.
5. In a fixture with an unavailable required guarantee, Safeword identifies the
   affected outcome and recommended next action without claiming protection.

This is a planned demonstration, not observed conformance. Full completion also
requires the shared-skill propagation and lifecycle preservation evidence in M2
and M3; this one journey does not replace that coverage.

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor
- OpenCode
- Safeword CLI
- Agent Plugins 1.0

OpenCode V2 2.4.1 CLI and TUI require separate current evidence. Desktop
remains advisory. Safeword CLI coverage includes status, unknown-version
recovery and required repository checks.
Agent Plugins 1.0 is registered in the project surface inventory: portable skills and resource loading on
supporting hosts do not establish hook or custom-agent support.

Unaffected: cloud-specific delivery and unrelated relay and
collector behavior. Shared-code changes must preserve existing behavior without
making new cloud enforcement claims.


## Qualification ownership — 2026-11-21

The user moved real Cursor IDE native and project-hooks qualification, native
Cursor IDE exhausted-cap evidence, and the combined seven-delivery demo to
[XHMWSC](../XHMWSC-qualify-cursor-ide-on-isolated-desktop/ticket.md). 2ENRH5 may
reach done once all non-IDE obligations are proved. The full contract, required
delivery population, and demo remain defined here and in the feature. Any
transferred observation remains unverified until XHMWSC produces it. Neither
ticket may claim IDE protection or complete seven-delivery proof from headless
results. Cursor CLI qualification and Claude/Codex exhausted-cap proof remain in 2ENRH5.
