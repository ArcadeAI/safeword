# Plan Implementation: Design Before TDD

**Entry:** Agent enters `plan-implementation` phase. Scenarios passed the scenario-gate; behavior is fixed. This phase produces the implementation design record — `impl-plan.md` — and nothing else ships from it. Application code stays untouched until `implement` (the pre-tool hook enforces this).

## Design the approach — ideal first

1. **Sketch the ideal design** for the validated scenarios as if the codebase didn't exist. Run `/figure-it-out` for each **load-bearing** choice — slicing, data model, storage, interfaces, test layers — and record the evidence in the Decisions table. Non-obvious choices get researched, not recalled.
2. **Then survey what exists** — after sketching the ideal, read the generated architecture state doc (`architecture.generated.md` — the machine-owned _what-is_) and the decision record (resolved from `paths.architecture`) for **reuse** candidates: components that already do the job, or do it better. Order matters: surveying first anchors the design to the status quo.
3. **Reconcile without sunk-cost conformance.** Existing architecture is changeable with a recorded decision, not a constraint to conform to. Reuse what's better; change what's worse — deliberately, with the change recorded (ADR lifecycle below).

## Environment fluency

- **Map installed language skills and component skills to the scenarios** — for the languages the feature touches, check the installed skill packs (`.claude/skills/<lang>-*`) and note per-scenario which apply. Scope to the feature's touched code and surfaces: in a polyglot monorepo, surface only what's relevant, never the full inventory.
- **Read the installed version's documentation** for each component or library the plan selects, before recording the decision. Designs authored from training memory of another version are silently wrong; `/quality-review` at implement is the backstop, not the first line.

## Deep design routes through existing lanes

Component design and data-model design belong in the lanes that already ship: scaffold from `design-doc-template.md` (Components, Data Model) when `design-doc-guide.md`'s triggers fire, and follow `data-architecture-guide.md` for data-model elevation. `impl-plan.md` stays the lean record pointing at them. The phase stores the plan, qualifying ADRs, and existing-lane design docs — no novel artifact kinds.

## Author impl-plan.md

Scaffold from `.safeword/templates/impl-plan-template.md` (sibling to `ticket.md`), status `planned`. Sections stay **content-or-skip** — every section gets real content or `skip: <non-empty reason>`:

- **Approach** — open with the riskiest assumption and the cheapest scenario that proves it; then the proof plan: for each scenario the primary proof (`unit`, `integration`, `E2E`, or `eval` per `testing/SKILL.md`'s highest practical scope rule), supporting proofs, at least one wiring test per new entry point, and the build order with the load-bearing slice first. Cover each **affected surface** the spec lists — name the proof that covers it or a per-surface `skip: <reason>`.
- **Decisions** — one row per significant technical choice: choice, alternatives, rejected-because, with the `/figure-it-out` evidence cited.
- **Arch alignment** — consult the architecture record (resolve `paths.architecture` in `.safeword/config.json`; default `.project/architecture.md`; a directory holds one ADR per `.md`, README excluded) **before** filling this in. Records exist: list the decisions this design honors. None recorded yet: write `skip: no ADRs in this project yet` and offer to draft the first ADR (technology choices spanning features, data ownership, cross-service contracts).
- **Known deviations** — where this deviates from guidance and why that's acceptable.
- **Doc impact** — which configured `docs.sources` surfaces the customer-visible changes touch, folded into the build order as tasks; internal-only: `skip: <reason>`.
- **Assessment triggers** — what would prompt revisiting these choices.

## ADR lifecycle

- **Emit only when significant.** Offer an ADR when a decision affects **structure, key quality attributes**, or is **difficult to reverse**. Routine choices live and die in the plan's Decisions table — no ceremony records.
- **Scaffold from the template into the configured location.** New ADRs scaffold from `.safeword/templates/adr-template.md` and land at the `paths.architecture` location: a file receives an appended entry; a directory receives one file per ADR with a merge-safe **date-prefixed** filename (`YYYYMMDD-slug.md` — sequential numbers collide across parallel sessions).
- **Never into generated docs.** `architecture.generated.md` and its per-package leaves are machine-owned state; never write decision records there — the record (_why_) is the only destination.
- **Keep records lean** — a page or two each; no mega-ADRs, no design guides in disguise (deep design belongs in the design-doc lane above).
- **Supersede, never edit.** A changed or contradicted decision gets a new record marked "supersedes", and the old one "superseded by" — linked both directions, nothing deleted. This applies **mid-flight too**: when implementation proves a planned decision wrong during implement, update the plan section then, note the change in Decisions, and supersede the affected ADR before `verify` — implement-exit reconciliation is the backstop, not the excuse to defer.

## Editorial contract — size, never whether

- **Depth tracks blast radius, in both directions.** A brief plan is correct for a small feature; hard-to-reverse or cross-cutting work compels depth. Padding is a defect either way.
- **The exit review applies the deletion test:** flag spans that can be deleted without information loss; a shorter plan scores no worse than a longer one at equal decision coverage.
- **Skip lines govern applicability, never effort or size.** The sections stay content-or-skip regardless of feature size — proportionality is never a license to skip the planning itself.

## Exit: review, then (optionally) the user

1. **Independent review first.** Spawn a fresh reviewer with no conversation history — handed only `impl-plan.md`, the ticket scope, and the `.feature` source — to refute the plan (wrong-direction design, missed scenarios, editorial padding via the deletion test). Fix findings, re-review, then stamp the exit (`write-review-stamp.ts --phase plan-implementation`, where the review gate is enabled). Human handoff happens **only after** this review passes — raw planning output is never presented for approval. Exception, any time: information only the user has (intent, priorities, constraints not in code or docs) routes to the user the moment the gap appears — `/elicit`.
2. **`designApprovalGate`** (in `.safeword/config.json`): **absent or off** — the reviewed plan advances autonomously; do not ask. **Enabled** — present the reviewed plan (riskiest assumption, build order, decisions) and wait for user approval before `implement`.
3. **Sessions without an interactive user** (cloud/headless — Claude Code on the Web, Codex Cloud, Cursor Cloud Agents): an enabled approval gate must not stall the container. Record the auto-decision as pending approval in the ticket work log and surface the reviewed plan in the session's reviewable output (PR description / session summary) — approval lands at PR review. Note: Cursor Cloud Agents run `preToolUse` hooks but not stop hooks, so enforcement rides the transition gate there, not stop-time nudges.
4. **Update frontmatter:** `phase: implement`. The pre-tool transition gate verifies `impl-plan.md` parses valid with status `planned` — a missing or invalid plan blocks the move with the fix named. A `phase_skips` justification satisfies phase provenance only — a new-flow feature (spec.md present) still needs the valid plan to enter implement.
5. **Work log:** the phase hook stamps the transition with real time (Claude Code — on other harnesses add a short transition entry yourself); add a narrative line (riskiest assumption, slice count, ADRs emitted) when useful.

**Splitting checkpoint:** the build order is where task counts materialize — >20 tasks or 5+ major components → consider splitting (see SPLITTING.md); split children restart at `plan-implementation`, each authoring its own plan.

**Voice:** plainspoken and concise — write to be scanned.

**Avoid bloat.**
