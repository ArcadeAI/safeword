# Glossary

<!--
Project domain vocabulary. Specs, JTBDs, and scenarios use these terms
consistently; the bdd skill's intake flow reads this file so meaning doesn't
drift across tickets. `safeword check` validates structure only — humans
curate what belongs. Format: packages/cli/templates/glossary-template.md.
Scope rule: a term lives here when it recurs across more than one ticket
and could mean two things. One-spec-only vocabulary stays in that ticket.
-->

## Gate

**Definition:** A checkpoint that blocks workflow progress until its condition is met. Safeword has several, each with a distinct trigger: the **phase gate** (can't create `test-definitions.md` without `scope`/`out_of_scope`/`done_when`; can't start TDD without `test-definitions.md`), the **phase-provenance gate** (a feature ticket must be born at `phase: intake` and advance one canonical step at a time; skipping a phase requires a per-phase `phase_skips` justification in frontmatter), the **artifact-precedence gate** (a feature's behavior artifacts are created only on complete prerequisites — `spec.md` needs `ticket.md`, `dimensions.md` needs a JTBD/AC-complete `spec.md` — and, always-on for features, `test-definitions.md` needs a review stamp for the spec and advancing into `implement` needs an independent review stamp for the scenarios; denials name the earliest missing prerequisite), the **ledger-write gate** (R/G/R checkbox ticks and annotations must go through an edit tool, not a Bash `sed`/`printf` write — #644 G3), the **LOC gate** (commit roughly every 400 lines of project code), the **done gate** (can't close a ticket without `verify.md`), and the **AC gate** (acceptance-criteria checks routed from `spec.md`).

**Do not confuse with:** "the gate" unqualified — each fires on a different condition, so always name which one.

## Phase

**Definition:** A stage in a ticket's lifecycle, tracked in ticket frontmatter: intake → define-behavior → scenario-gate → implement → verify → done.

## Hook

**Definition:** A shell script safeword runs on IDE agent lifecycle events (PreToolUse, PostToolUse, Stop, SessionStart) to enforce gates and automate linting and quality checks. Fires only during AI-agent sessions.

**Do not confuse with:** A git hook — safeword installs none and never alters the human commit workflow.

## Skill

**Definition:** A markdown capability document under `.claude/skills/` (e.g. bdd, verify, refactor) that adds guidance to the agent's context. Slash-invocable and auto-triggerable; soft enforcement — the agent decides when to apply it.

**Do not confuse with:** Hook — a hook is shell-enforced and fires automatically; a skill is guidance the agent chooses to follow.

## Slash command

**Definition:** A user-typed `/name` trigger (e.g. `/bdd`, `/verify`) that invokes a skill or hook-backed workflow in the IDE.

**Aliases:** Command

## Ticket

**Definition:** A safeword **ticket** is the local **execution anchor** for one unit of multi-step work — your agent's working dossier (spec, scenarios, work log) whose job is to keep the agent on track across sessions, _not_ a tracker item to be triaged. Current tickets created by `safeword ticket new` live at `<namespace-root>/tickets/{ID}-{slug}/`, with lookup still accepting historical `<namespace-root>/tickets/{ID}/` and legacy numeric `<namespace-root>/tickets/{id}-{slug}/` folders. Holds `ticket.md` (frontmatter + work log), `spec.md`, `test-definitions.md`, and `verify.md`. Acts as the context anchor across sessions.

**Ticket vs. issue (vocabulary discipline):** safeword always says **"ticket"** for this local repo artifact and **"issue"** (or Jira's "work item") for the thing in an external tracker. The names are deliberately kept distinct — no dev tracker (Linear/GitHub/Jira) calls its unit a "ticket," so the term stays unambiguous when `sync-tracker` projects a ticket _into_ an issue. When context is thin, qualify: "safeword ticket" vs "tracker issue."

## Sizing

**Definition:** Classifying a piece of work to pick its workflow — **patch** (≤1 file, fix directly), **task** (1–2 files, one testable behavior, TDD), or **feature** (3+ files, new state, or multiple flows, full BDD). Decided internally and stated as a scope read, never announced as a label.

## Dogfood repo

**Definition:** The safeword source repository, which installs and runs safeword on itself so template and hook changes surface in real use before release. Some logic deliberately treats it specially (e.g. auto-upgrade skips it).

## Job To Be Done

**Definition:** A product-intent statement in the form "When I…, I want…, so I can…", anchored to exactly one persona. Authored in `spec.md` under `## Jobs To Be Done`; anchors the acceptance criteria and scope that follow.

**Aliases:** JTBD

## Persona

**Definition:** A user archetype the project serves, defined in `.safeword-project/personas.md` with a `**Role:**` line and a short code (e.g. `TB`, `SM`). JTBDs and scenarios reference personas by name or code.

## Acceptance Criterion

**Definition:** A single capability or guarantee a persona gets — the rung between a JTBD and its scenarios. Written under its JTBD in `spec.md` (`#### <jtbd-id>.AC<n>`); the define-behavior scenarios prove its specifics. Kept at capability level, not implementation.

**Aliases:** AC

## Scope

**Definition:** Ticket-frontmatter field listing what the work will do — derived from the choices accepted during convergence.

## Out of Scope

**Definition:** Ticket-frontmatter field listing what the work will not do — rejected alternatives plus domain exclusions. Prevents scope creep by explicit negation.

## Done When

**Definition:** Ticket-frontmatter field listing the observable, testable outcomes that mark the work complete. Seeds acceptance criteria and scenarios; the phase gate requires it before behavior definition.

## Scenario

**Definition:** A concrete Given/When/Then exemplar of one behavior, grouped under a Rule in `test-definitions.md`, with RED/GREEN/REFACTOR sub-checkboxes tracking TDD progress.

**Do not confuse with:** A generic "use case" — a safeword scenario is a specific artifact whose checkboxes are parsed by hooks.

## Test Definitions

**Definition:** The `test-definitions.md` artifact produced in the define-behavior phase: validated Rules + Scenarios + Given/When/Then + RED/GREEN/REFACTOR checkboxes. Its existence is what the phase gate checks before implementation.

## Dimension

**Definition:** A behavioral variable derived from scope and done-when that partitions the space of scenarios (e.g. "output correctness"). Recorded in `dimensions.md`; seeds scenario generation.

**Do not confuse with:** Partition — a dimension is the variable; a partition is one of its values.

## Partition

**Definition:** One equivalence class (sub-case) within a dimension; each partition or its boundary becomes one or two scenarios.

## AODI

**Definition:** The four-part scenario-validity test applied at the scenario gate — Atomic (one behavior), Observable (externally visible outcome), Deterministic (same result every run), Independent (no ordering dependency).

## Reconciliation

**Definition:** Safeword's upgrade mechanism — diff installed files against the current templates, compute a plan of create/update/delete actions, then apply it idempotently. Never blind-copies over user changes.

## Schema

**Definition:** `packages/cli/src/schema.ts` — the single manifest of every file and directory safeword manages (owned, managed, deprecated, JSON merges, text patches, packages). Every file under `templates/` must have a schema entry.

**Do not confuse with:** A database or JSON schema — here it means safeword's file-management manifest.

## Owned File

**Definition:** A file overwritten from its template on every upgrade — safeword is the source of truth and user edits are not preserved.

**Do not confuse with:** Managed file (created once, then user-owned) and Deprecated file (deleted on upgrade).

## Managed File

**Definition:** A file safeword creates if missing but never overwrites on upgrade — the user may edit it and changes persist.

**Do not confuse with:** Owned file (overwritten every upgrade).

## Deprecated File

**Definition:** A file, directory, or package safeword marks for deletion on the next upgrade (listed in the schema's `deprecated*` sets).

## Language Pack

**Definition:** A per-language tooling module (detection + config generation + setup) implementing the `LanguagePack` interface — one each for typescript, python, golang, rust, sql. Bundled in the CLI, not shipped as separate npm packages.

## RED → GREEN → REFACTOR

**Definition:** The three TDD micro-steps run per scenario — RED (write a failing test), GREEN (minimum code to pass), REFACTOR (clean up with tests green). One commit per step; the scenario's sub-checkboxes are marked with the commit SHA or `skip: <reason>`, and hooks parse them to track the active step.
