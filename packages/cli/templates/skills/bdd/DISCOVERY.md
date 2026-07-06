# Intake: Understanding & Scope

**Entry:** Agent detects feature-level work OR resumes ticket at `intake` phase.

## Sub-phase gates

Intake advances through sub-phases (load personas/glossary/surfaces → JTBD → Rules → engineering scope). Each one ends with a **gate** — don't advance on your own momentum; present what you captured and get the user's signoff first. Three moves:

1. **Present** the captured artifact verbatim — the JTBD list, the Rules list grouped by JTBD, or the Scope / Out of Scope / Done When block.
2. **Ask** the sub-phase's closing question (below).
3. **Wait** for confirmation. Any forward-moving reply advances — an explicit "looks good" / "proceed", or an amendment you fold in and re-present. A new concern loops back; you don't advance until it's resolved.

| Sub-phase                      | Closing question                                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personas / glossary / surfaces | _"`<file>` is empty — add entries now, or proceed without?"_ (only when missing/empty)                                                                                                       |
| Jobs To Be Done                | _"Here's who asked, the cost of not doing it, and how reversible it is — plus the jobs it serves. Given that, is this a feature, or a task? And do the jobs cover who this serves and why?"_ |
| Rules                          | _"Does each job's criteria capture what 'done' means for the persona? Any to split, add, or drop?"_                                                                                          |
| Engineering scope              | _"Here's the scope / out-of-scope / done-when — ready to proceed?"_                                                                                                                          |

**On resume** (picked up mid-sub-phase across sessions): re-present the captured artifact for re-confirmation rather than assuming the prior signoff still stands — context may have shifted.

**Under YOLO mode** (G2E72G): gates auto-confirm and the auto-decision is recorded in the work log, so the audit trail shows what was waved through.

These gates are conversational discipline the agent runs — not a hook block. (Hook-enforced sub-phase tracking is future work, coordinated with phase-step-enforcement epic 172.)

## Load project personas

At intake start, read the configured personas file (`paths.personas`, default `<namespace-root>/personas.md`). This file is the project's source of truth for who features serve; later phases (JTBD authoring, criteria validation, scenario numbering) reference its entries.

- **If the file is missing or empty** (no persona blocks parsed — the scaffolded template comment doesn't count) — surface a soft prompt:

  > _"`personas.md` is empty — want to add some now, or proceed without?"_

  The user can answer "proceed without" and intake continues; the prompt fires again later only if a turn tries to reference a persona that isn't in the file.

- **If a persona reference comes up during intake that isn't in the file** — flag it, don't invent. Ask whether it's a new persona to add, or a typo for an existing one. Use `validatePersonaReference` semantics (case-sensitive match; offer the suggestion when only casing differs).

Short codes auto-derive from names on the next `safeword check` (e.g., `Platform Operator` → `PO`). Codes can be overridden with explicit `## Name (CODE)` syntax. Never edit derived codes manually except via the override path — `safeword check` will rewrite them.

## Load project glossary

At intake start, read the configured glossary file (`paths.glossary`, default `<namespace-root>/glossary.md`). This file is the project's source of truth for domain vocabulary; using terms consistently across tickets keeps specs from drifting (does "session" mean the same thing in two scenarios, or two different things?).

- **If the file is missing or empty** (no term blocks parsed — the scaffolded template comment doesn't count) — surface a soft prompt:

  > _"`glossary.md` is empty — want to add some terms now, or proceed without?"_

  The user can answer "proceed without" and intake continues; the prompt fires again later only if a turn references a domain term that isn't in the file.

- **If a domain term comes up during intake that isn't in the glossary** — flag it, don't invent a definition. Ask whether it's a new term to define in the configured glossary file, or a synonym for an existing one. Use `validateGlossaryReference` semantics (exact name or alias match; offer the suggestion when only casing differs).

Project-wide terms live in the configured glossary file; vocabulary used in only one spec stays in that ticket. Never extract terms from prose automatically — humans curate the glossary.

## Load project surfaces

At intake start, read the configured surfaces file (`paths.surfaces`, default `<namespace-root>/surfaces.md`). This file is the project's source of truth for feature surfaces: supported product, agent, runtime, protocol, client, or deployment contexts where behavior must keep working. Examples include Claude Code, OpenAI Codex, Cursor, Web app, Mobile app, MCP, Cloud service, and Self-hosted Azure.

- **If the file is missing or empty** (no surface blocks parsed — the scaffolded template comment doesn't count) — surface a soft prompt:

  > _"`surfaces.md` is empty — want to add surfaces now, or proceed without?"_

  The user can answer "proceed without" and intake continues. The surface inventory is optional until a spec names affected surfaces; once it does, saved scenarios should prove coverage with `@surface.<slug>` tags or explicit `skip:` reasons.

- **If a feature mentions a reusable context that isn't in the file** — flag it, don't silently promote it. Ask whether it should become a project surface or stay spec-local under `## Surfaces`.

Promote a spec-local surface into project surfaces when it is recurring across tickets, ambiguous enough to drift, or important enough that missing it would leave a runtime, protocol, client, or deployment untested. One-spec-only contexts stay in that ticket.

## Author Intake Brief

Rung 0 — before framing the jobs, capture the decide-to-build brief in `spec.md`'s `## Intake Brief`. Three advisory lines (write `skip: <reason>` where one doesn't apply):

- **Requested by** — who asked, distinct from the persona the feature serves.
- **Cost of inaction** — what changes, breaks, or is lost if we don't build it. (Framing inaction as a risk is sharper than framing action as an opportunity.)
- **Reversibility** — how hard this is to undo once shipped (one-way vs. two-way door). Count cross-cutting changes (data model, public API, migration) as one-way for this purpose. The readiness pointer raises this live in chat during Clarify; the brief is where it's written down and kept for later review.

The brief frames _whether and how much_ to build before JTBD frames _what_. Its payoff is **triage**: when cost-of-inaction is low and reversibility is high, the feature may not warrant the full ladder — raise it at the gate below. Don't add a separate stop; present the brief together with the jobs at the **JTBD sub-phase gate**, whose question now also asks "is this a feature, or a task?" Features only — tasks and patches skip the brief and lean on the readiness pointer.

## Author Jobs To Be Done

Before converging on scope, frame the product intent: what jobs does this feature do, and for whom? Write Jobs To Be Done into the ticket's `spec.md` under `## Jobs To Be Done`, one entry per job. JTBDs come first — they anchor the acceptance criteria and scope that follow.

Each JTBD is:

- A `### <slug>.<persona-code><n> — <title>` heading (e.g., `### oauth-flow.PO1 — rotate credentials without downtime`).
- A `**Persona:** <ref>` line naming **exactly one** persona from the configured personas file — one persona per JTBD. A job that serves two personas is two jobs.
- A `> When I …, I want …, so I can …` statement capturing the trigger, the desired action, and the outcome.

Resolve each persona reference against the loaded personas before writing it. A JTBD naming a persona absent from `personas.md` blocks the next phase — the intake-exit gate denies `test-definitions.md` until every JTBD resolves, or a `skip: <reason>` is recorded under `## Jobs To Be Done` for a deliberate omission.

**Pause and confirm** the JTBD set with the user before advancing to Understanding — this is the JTBD **Sub-phase gate** (see above). Converge on the jobs first, then build scope on top of them.

## Author Rules

Once the JTBDs are confirmed, decompose each into **numbered Rules** — the rung between a job and its scenarios. A Rule is a single testable business invariant the persona relies on; the define-behavior scenarios prove its specifics, and the rules sum to JTBD fulfillment. Write them under their JTBD in `spec.md`:

- A `#### <jtbd-id>.R<n> — <invariant>` heading (e.g., `### oauth-flow.PO1` → `#### oauth-flow.PO1.R1 — a rotated key's predecessor keeps working for a bounded grace window`).
- Each JTBD needs **≥1 Rule** (or ≥1 legacy Acceptance Criterion), or a `skip: <reason>` under it for a job with no user-observable behavior to enumerate. The intake-exit gate enforces this (denies `test-definitions.md` until every JTBD has a criterion or a skip).
- Legacy alternative (soft-deprecated): a JTBD may instead declare **Acceptance Criteria** (`#### <jtbd-id>.AC<n> — <capability>`) — one criteria kind per job, never both. The gate accepts either; numbered Rules need a `.feature` scenario source while the legacy `test-definitions.md` path stays AC-only. The full rule grammar lives in the bdd skill's SCENARIOS.md.

**Coaching — keep Rules at the invariant level, not implementation:**

- General invariant, not a bare verb: "a revoked session stops working everywhere within seconds" ✓, not just "user can revoke a session."
- Invariant, not mechanism: "`DELETE /sessions/<id>` returns 204" ✗ — that's a scenario's Then, not a Rule.
- **Split-test heuristic:** could each clause of a bundled Rule ship as its own complete deliverable with independent value? If yes → split into separate Rules. If the sub-operations only make sense together → keep as one.
- If a Rule starts spawning more than ~10 scenarios in define-behavior, it's probably two Rules — split it.

**Pause and confirm** the criteria list grouped by JTBD with the user before advancing — this is the criteria **Sub-phase gate** (see above). Iterate until they sign off, then build engineering scope (Understanding) on top.

## Author the Rave Moment

Optional, and only for the **highest persona-facing surface** in the tree — the epic if there is one, else this feature. Child features under an epic that already named one inherit it; internal/plumbing work skips it. Advisory: it never blocks intake exit.

The jobs above say what a persona can _do_. The rave moment says what would make them _tell a peer about it_ — a different and higher bar. It needs three things at once:

- **The moment** — one specific beat they'd screenshot or recount, not a diffuse "it's nice." People remember the peak and the ending, not the average — name the peak.
- **The expectation it beats** — the dread, status-quo pain, or competitor clunk it's measured against. A moment that beats nothing is table-stakes, not a rave.
- **The one-sentence test** — can the persona repeat it to a peer with the same problem, in a way that makes _them_ look in-the-know? If it can't be said in a sentence, it won't travel.

**Ground it in evidence — don't write it from your priors.** A moment invented from memory is how you get a plausible-but-fake rave, so it isn't optional: **run `/figure-it-out` every time**, handing it the three criteria above as the brief, to research the real dread, the competitor's actual clunk, and what genuinely travels here. (Where that skill isn't available, do that research inline — the grounding is the requirement; the skill is only the tool.) If the real gap is persona intent or raw ideation, it routes you to `/elicit` or `/brainstorm`.

Aim for **awe** ("whoa, it just did that"), not mild satisfaction — low-arousal "fine" doesn't get shared. Write it to `spec.md`'s `## Rave Moment` (e.g., oauth-flow: _"I expected a coordinated flag-day; the old key just kept working while I rolled the fleet"_). If nothing clears the expectation bar, write `skip: table-stakes` — "no rave here" is an honest, common answer, not a gap to fill. Manufacturing one to fill the field is the failure mode; the beaten-expectation requirement is the guard.

`/verify`'s experience lens walks this moment as the persona later and asks whether it landed.

## Understanding (Propose-and-Converge)

Follow the understanding pattern from SAFEWORD.md — including contribution techniques. Converge until the user accepts a proposal with structured scope (Scope, Out of Scope, Done When) written to the ticket spec.

**Specificity self-test** — before proposing scope, verify you can answer all three:

- What behavior changes?
- What behavior stays the same?
- What is the observable done state?

If any answer is vague, you have open questions — surface them, and record each unresolved one in `spec.md`'s `## Open Questions` section (the equivalent of Example Mapping's red "question" cards) so it isn't lost across turns or sessions. Delete a question when it's answered, or mark it `defer: <reason>` for a deliberate punt.

**When the gap is user-only knowledge** (intent, priorities, constraints not derivable from code/docs) — call `/elicit` to extract it via microquestions before drafting scope.

**When the option space is empty** (a vague idea with no candidate approaches yet) — call `/brainstorm` to diverge and generate options first; converge on one with `/figure-it-out` after.

**When the gap is the option space itself** (multiple plausible scopes, framings, or boundaries with no clear winner) — call `/figure-it-out` to weigh options against current docs and research before drafting scope.

**When the feature leans on a library or framework** — read the installed version's docs before proposing API shapes or done-when criteria. Scope baked on training memory of a different version is silently wrong. Check `package.json` / lockfile first, then the source wired up (Context7, official docs, README at the pinned ref).

**When the feature introduces architecture or a new pattern** — design the ideal first (`/figure-it-out`), _then_ survey the existing patterns in the area and reconcile: conform by default, deviate only with a named defect and an uplevel follow-up ticket. See `.safeword/guides/architecture-guide.md` → Survey & Reconcile.

## Worked example: intake end to end

One feature walked through all four artifacts and every sub-phase gate. Slug `oauth-flow`: let an operator rotate an API key without a coordinated flag day.

**1 · Personas — load and reference.** Intake reads the configured personas file and finds the persona this feature serves:

```markdown
## Platform Operator (PO)

**Role:** Owns the fleet's servers and their credentials.
```

The job below names `Platform Operator (PO)`; it resolves against the file, so intake continues. An unknown reference stops here — flag it, don't invent.

**2 · Jobs To Be Done — motivation first.** Capture who and why before anything else, in `spec.md`:

```markdown
### oauth-flow.PO1 — Rotate credentials without a flag day

**Persona:** Platform Operator (PO)

> When I rotate a server's API key, I want the previous key to keep
> working for a short grace period, so I can roll the change across my
> fleet without coordinated downtime.
```

**JTBD gate** → present the brief and the job together, ask _"Given who asked, the cost of inaction, and how reversible this is — is this a feature, or a task? And do the jobs cover who this serves and why?"_, wait for signoff before decomposing.

**3 · Rules — invariants under the job.** Each Rule is one testable invariant the operator relies on, not a mechanism:

```markdown
#### oauth-flow.PO1.R1 — A rotated key's predecessor keeps authenticating for a bounded grace window

#### oauth-flow.PO1.R2 — Every currently-issued key is visible to the operator as live, grace, or expired
```

**Criteria gate** → present the criteria grouped under their job, ask _"Does each job's criteria capture what 'done' means?"_, wait. (R2 split out by the split-test — "see which keys are live" delivers value on its own.)

**4 · Engineering scope — what we touch, how we'll know.** Only now converge on the engineering contract, written to ticket frontmatter:

```yaml
scope:
  - dual-key validation with a configurable grace TTL
  - a `keys list` view showing each key as live / grace / expired
out_of_scope:
  - automatic rotation scheduling (rejected alternative)
  - per-key rate limits (rejected alternative)
done_when:
  - a request signed with the previous key succeeds within the TTL and fails after it
  - `keys list` reflects each key's current state
```

**Scope gate** → present Scope / Out of Scope / Done When, ask _"ready to proceed?"_, wait. Then advance to define-behavior.

**5 · Scenario lineage — the chain stays machine-checkable.** In define-behavior each scenario title carries the criterion it proves, so persona → JTBD → Rule → scenario is traceable, not eyeballed:

```text
### Scenario: oauth-flow.PO1.R1.previous_key_authenticates_within_grace_window
```

`safeword check` reads these titles and reports coverage gaps as advisories — a Rule no scenario references (R2, until you write one) is **uncovered**; a scenario naming a renumbered or missing Rule is a **stale ref** or **orphan**. The full scheme lives in the bdd skill's SCENARIOS.md.

The arc end to end: a persona from `personas.md`, a job that names it, criteria under the job, an engineering contract on top, and scenarios that trace back to a criterion — each sub-phase closed by its gate.

## Intake Exit

Before proceeding to define-behavior (the Intake Brief is advisory — a missing or `skip:`'d field never blocks this exit; only `scope` / `out_of_scope` / `done_when` are required):

0. **Specificity self-test passed** — you can concretely answer: what changes, what stays the same, observable done state
1. **Cold-start executability check (one-way-door features only)** — read the intake brief's _recorded_ Reversibility field; do not re-judge reversibility here. Offer the cold-start check **only when** that recorded field reads one-way-door or cross-cutting (data model, public API, or migration). A two-way-door, missing, or `skip:`'d Reversibility field gets no offer. The check (see `.safeword/guides/cold-start-check.md`) spawns a context-free sub-agent to judge whether the captured spec could be planned from scratch, and appends any gaps to Open Questions — so run it before resolving them. It is advisory; it never blocks. Under YOLO mode (G2E72G) the offer auto-accepts: the check runs, the auto-decision is recorded in the work log, and each auto-appended gap is recorded as `defer: <reason>` so the auto-confirming exit isn't silently waved through.
2. **Open Questions resolved** — `spec.md`'s `## Open Questions` is empty/answered, or each remaining line carries `defer: <reason>`. A long unresolved list means intake isn't done — keep converging.
3. **Verify ticket exists:** `<namespace-root>/tickets/{ID}-{slug}/ticket.md`
4. **Verify frontmatter has:** `scope`, `out_of_scope`, `done_when` fields (non-empty)
5. **Update frontmatter:** `phase: define-behavior`
6. **Work log:** the phase hook stamps the transition with real time (`post-tool-work-log.ts`); add narrative — what converged, key scope calls — as separate entries when useful.

## Planning Note

Define-behavior scenarios draw from the self-test: behavior that changes seeds happy paths and error paths, observable done states seed acceptance criteria. Behavior that stays the same is protected by the existing test suite — it informs out-of-scope, not new scenarios. Add failure-mode scenarios from domain knowledge.

Technical breakdown — component identification and any design-doc/ADR triggers — belongs here in intake (you design the architecture in "Understanding" above). The per-scenario proof plan + build order step now happens at the scenario-gate exit; the standalone `decomposition` phase is retired (see the ADR in `ARCHITECTURE.md`).

**Voice:** plainspoken and concise — write to be scanned.

**Avoid bloat.**
