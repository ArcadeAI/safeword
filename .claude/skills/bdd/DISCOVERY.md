# Intake: Understanding & Scope

**Entry:** Agent detects feature-level work OR resumes ticket at `intake` phase.

## Load project personas

At intake start, read `.safeword-project/personas.md`. This file is the project's source of truth for who features serve; later phases (JTBD authoring, AC validation, scenario numbering) reference its entries.

- **If the file is missing or empty** (no persona blocks parsed — the scaffolded template comment doesn't count) — surface a soft prompt:

  > _"`.safeword-project/personas.md` is empty — want to add some now, or proceed without?"_

  The user can answer "proceed without" and intake continues; the prompt fires again later only if a turn tries to reference a persona that isn't in the file.

- **If a persona reference comes up during intake that isn't in the file** — flag it, don't invent. Ask whether it's a new persona to add, or a typo for an existing one. Use `validatePersonaReference` semantics (case-sensitive match; offer the suggestion when only casing differs).

Short codes auto-derive from names on the next `safeword check` (e.g., `Platform Operator` → `PO`). Codes can be overridden with explicit `## Name (CODE)` syntax. Never edit derived codes manually except via the override path — `safeword check` will rewrite them.

## Load project glossary

At intake start, read `.safeword-project/glossary.md`. This file is the project's source of truth for domain vocabulary; using terms consistently across tickets keeps specs from drifting (does "session" mean the same thing in two scenarios, or two different things?).

- **If the file is missing or empty** (no term blocks parsed — the scaffolded template comment doesn't count) — surface a soft prompt:

  > _"`.safeword-project/glossary.md` is empty — want to add some terms now, or proceed without?"_

  The user can answer "proceed without" and intake continues; the prompt fires again later only if a turn references a domain term that isn't in the file.

- **If a domain term comes up during intake that isn't in the glossary** — flag it, don't invent a definition. Ask whether it's a new term to define in `.safeword-project/glossary.md`, or a synonym for an existing one. Use `validateGlossaryReference` semantics (exact name or alias match; offer the suggestion when only casing differs).

Project-wide terms live in `.safeword-project/glossary.md`; vocabulary used in only one spec stays in that ticket. Never extract terms from prose automatically — humans curate the glossary.

## Author Jobs To Be Done

Before converging on scope, frame the product intent: what jobs does this feature do, and for whom? Write Jobs To Be Done into the ticket's `spec.md` under `## Jobs To Be Done`, one entry per job. JTBDs come first — they anchor the acceptance criteria and scope that follow.

Each JTBD is:

- A `### <slug>.<persona-code><n> — <title>` heading (e.g., `### oauth-flow.PO1 — rotate credentials without downtime`).
- A `**Persona:** <ref>` line naming **exactly one** persona from `.safeword-project/personas.md` — one persona per JTBD. A job that serves two personas is two jobs.
- A `> When I …, I want …, so I can …` statement capturing the trigger, the desired action, and the outcome.

Resolve each persona reference against the loaded personas before writing it. A JTBD naming a persona absent from `personas.md` blocks the next phase — the intake-exit gate denies `test-definitions.md` until every JTBD resolves, or a `skip: <reason>` is recorded under `## Jobs To Be Done` for a deliberate omission.

**Pause and confirm** the JTBD set with the user before advancing to Understanding — converge on the jobs first, then build scope on top of them.

## Author Acceptance Criteria

Once the JTBDs are confirmed, decompose each into **Acceptance Criteria** — the rung between a job and its scenarios. An AC is a single capability or guarantee the persona gets; the Phase-3 scenarios prove its specifics, and the ACs sum to JTBD fulfillment. Write them under their JTBD in `spec.md`:

- A `#### <jtbd-id>.AC<n> — <capability>` heading (e.g., `### oauth-flow.PO1` → `#### oauth-flow.PO1.AC1 — old key keeps working for a bounded grace window`).
- Each JTBD needs **≥1 AC**, or a `skip: <reason>` under it for a job with no user-observable capability to enumerate. The intake-exit gate enforces this (denies `test-definitions.md` until every JTBD has an AC or a skip).

**Coaching — keep ACs at the capability level, not implementation:**

- Descriptive guarantee, not a bare verb: "user can revoke a session and it stops working everywhere within seconds" ✓, not just "user can revoke a session."
- Capability, not mechanism: "`DELETE /sessions/<id>` returns 204" ✗ — that's a scenario's Then, not an AC.
- **Split-test heuristic:** could each clause of a bundled AC ship as its own complete deliverable with independent value? If yes → split into separate ACs. If the sub-operations only make sense together → keep as one.
- If an AC starts spawning more than ~10 scenarios in define-behavior, it's probably two ACs — split it.

**Pause and confirm** the AC list grouped by JTBD with the user before advancing — iterate until they sign off. Then build engineering scope (Understanding) on top.

## Understanding (Propose-and-Converge)

Follow the understanding pattern from SAFEWORD.md — including contribution techniques. Converge until the user accepts a proposal with structured scope (Scope, Out of Scope, Done When) written to the ticket spec.

**Specificity self-test** — before proposing scope, verify you can answer all three:

- What behavior changes?
- What behavior stays the same?
- What is the observable done state?

If any answer is vague, you have open questions — surface them.

**When the gap is user-only knowledge** (intent, priorities, constraints not derivable from code/docs) — call `/elicit` to extract it via microquestions before drafting scope.

**When the gap is the option space itself** (multiple plausible scopes, framings, or boundaries with no clear winner) — call `/figure-it-out` to weigh options against current docs and research before drafting scope.

**When the feature leans on a library or framework** — read the installed version's docs before proposing API shapes or done-when criteria. Scope baked on training memory of a different version is silently wrong. Check `package.json` / lockfile first, then the source wired up (Context7, official docs, README at the pinned ref).

### Concrete example

**Context:** User says "I want to add a --verbose flag to the lint command."

**Agent turn 1:**

> You want `--verbose` on lint to show more detail during linting. I'd frame this as: verbose mode surfaces which files are being checked, which linters ran, and any warnings that are currently suppressed.
>
> A couple of things to nail down — the output format (structured JSON vs human-readable lines) and whether verbose shows passing files too or just failures. My instinct is human-readable, failures + warnings only. What do you think?

**User:** "Human-readable, but show passing files too — I want to see it's actually checking everything."

**Agent turn 2:**

> Got it. Here's the proposal:
>
> **Scope:** `--verbose` flag on lint command. Shows each file checked, linter used, and result (pass/warning/fail). Human-readable output.
> **Out of Scope:** Structured JSON output, debug-level linter internals, verbose mode for other commands.
> **Done When:** `--verbose` produces per-file output showing filename, linter, and result for every file checked.
>
> Ready to proceed?

**User:** "Yes."

**Result:** Zero open questions → proceed to sizing.

## Intake Exit (REQUIRED)

Before proceeding to define-behavior:

0. **Specificity self-test passed** — you can concretely answer: what changes, what stays the same, observable done state
1. **Verify ticket exists:** `.safeword-project/tickets/{id}-{slug}/ticket.md`
2. **Verify frontmatter has:** `scope`, `out_of_scope`, `done_when` fields (non-empty)
3. **Update frontmatter:** `phase: define-behavior`
4. **Add work log entry:**

   ```
   - {timestamp} Complete: intake - Understanding converged, scope established
   ```

## Planning Note

Define-behavior scenarios draw from the self-test: behavior that changes seeds happy paths and error paths, observable done states seed acceptance criteria. Behavior that stays the same is protected by the existing test suite — it informs out-of-scope, not new scenarios. Add failure-mode scenarios from domain knowledge.

Decomposition is optional — skip if the architecture is clear from the converged proposal.

**Voice:** plainspoken and concise — write to be scanned.
