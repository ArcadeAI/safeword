# Impl Plan: Phase provenance gate (0KYEBN, #644 G2)

**Status:** implemented

## Approach

**Riskiest assumption:** the transition classifier can decide, from only the hook's
`tool_input` plus the on-disk prior ticket.md, which of five write kinds it is
looking at (creation / phase-change / type-flip-to-feature / frontmatter-repair /
at-rest edit) — including unparseable priors — **without false positives on
routine edits**. Over-blocking is the expensive failure: work-log appends are the
most common ticket write in every session, and a gate that misfires there bricks
workflows repo-wide. **Cheapest proof:** the three at-rest scenarios plus
"Advancing one canonical step is allowed" — they fail immediately if
classification is wrong, so they are exercised in slice 1.

**Proof plan (highest practical scope):**

- **Primary proof — integration (subprocess), per scenario.** New
  `steps/phase-provenance.steps.ts` following the sibling pattern
  (`pm-grade-intake-readiness-gate.steps.ts`): build a throwaway project,
  feed the real `.safeword/hooks/pre-tool-quality.ts` a PreToolUse JSON
  (Write/Edit on `tickets/*/ticket.md`) over stdin, assert
  `permissionDecision` and denial-message content on stdout. This is also the
  wiring test: real hook, real filesystem, only the process boundary crossed.
  All 31 `.feature` scenarios run through this harness via `test:bdd`.
- **Supporting proof — unit, for the combinatorial pure logic.** New
  `packages/cli/tests/hooks/phase-provenance.test.ts` over the pure evaluator
  in `packages/cli/templates/hooks/lib/phase-provenance.ts` (no I/O — same
  cross-runtime rationale as `jtbd.ts` / `impl-plan.ts`): step counting,
  hatch parsing/validation, enum membership, prior-phase normalization,
  type-flip and repair classification, frontmatter parseability partitions.
- **RED mechanics:** deny-scenarios go red naturally against the unwired gate
  (they expect deny, get allow). Allow-scenarios are trivially green at the
  hook boundary, so their RED is the unit test proving the classifier
  *distinguishes* the case (e.g. at-rest → no-transition verdict) before the
  distinguishing code exists.

**Build order** (each slice builds on green):

1. **Pure evaluator + unit suite** — classifier and verdict logic for the
   load-bearing partitions first: at-rest / one-step / routine edits (the
   riskiest-assumption slice), then birth, jump, hatch, enum, flip, repair.
2. **Hook wiring** — insert the gate in `pre-tool-quality.ts`'s ticket.md
   section, ordered before the #404 readiness gate; reuse `deny()` +
   `withOrderingNote()` (#385) and `isValidSkipReason` (house skip semantics).
3. **Cucumber harness + step definitions** — one step file; scenarios flip
   green per ledger order; denial-message assertions pin remediation text.
4. **Full-suite + lane verification** — vitest suite, `test:bdd`, lint.

Per-scenario RED→GREEN→REFACTOR with one checkbox per edit and a commit per
step, per TDD.md; scenario order follows the ledger.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Skip-hatch record | `phase_skips:` frontmatter list, one `"<phase>: <reason>"` entry per skipped phase | single skip field; no hatch; work-log entries; sidecar file | blanket suppression hides what was skipped; no-hatch drives Bash bypass; log/sidecar invisible at the frontmatter where gates and readers look (/figure-it-out 2026-07-03) |
| Hatch entry syntax in remediation text | block-sequence form only (`- intake: reason`) | flow-style `[a, b]` | `parseFrontmatter` splits flow arrays on commas — comma-bearing reasons corrupt; block items survive verbatim (quality-review finding, verified against lib/hierarchy.ts) |
| Comma-split flow entries | treated as invalid skip (reason missing) → deny with syntax guidance | silent acceptance; crash | degrade loudly but safely; never let a mangled reason pass as justification |
| Unknown/absent prior phase | counts as intake for step-counting | hard-deny off-enum priors; exempt entirely | migration path for ~15 legacy tickets; exemption reopens G2 (round-1 must-fix) |
| Frontmatter failure | creation fails closed; at-rest edits tolerated; repair evaluated as birth at repaired values | fail-open (re-ships #119); fail-closed everywhere (bricks legacy work-log appends) | scenario-pinned in rounds 3–4 |
| Gate placement | before #404 readiness gate in the ticket.md section | after; merged into #404 | provenance ("wrong step") is logically prior to readiness ("step not earned"); merging would tangle two verdicts' messages |
| Enforcement surface | Claude hook only; Codex/Cursor inherit via adapters spawning it | per-harness reimplementation | adapters already treat pre-tool-quality.ts as source of truth; reimplementation drifts |

## Arch alignment

- **Unified BDD+TDD Workflow (2026-01-07)** — phase discipline lives in hooks + ticket frontmatter; this gate enforces what the skill documents.
- **Hard Block for Done Phase (2026-01-07)** — same philosophy extended to phase transitions: hard deny with evidence-based, actionable remediation rather than soft reminders.
- **Pure-helper cross-runtime pattern** (`jtbd.ts`, `impl-plan.ts` precedent) — validation logic in a standalone lib under `templates/hooks/lib/`, unit-testable without the CLI dist, consumed by the deployed hook.
- **Adapter source-of-truth pattern** (`cursor/gate-adapter.ts`, `codex/pre-tool-quality.ts`) — one Claude-shaped gate; adapters translate payloads.

## Known deviations

None structural — the gate joined the pre-tool chain as planned (before #404, shared `deny()`/`withOrderingNote()`/`isValidSkipReason` idioms; verified in the whole-ticket review). Two reconciliation notes:

- The plan's "RED mechanics" held, but several allow-scenarios' REDs were genuinely unconstructible once earlier slices landed — recorded as reasoned `skip:` annotations in the ledger rather than forced failing tests.
- Scope grew during scenario-gate review rounds (type-flip births, frontmatter fail-closed/repair, off-enum flip pin) — absorbed into the same evaluator as planned, no architectural change.

## Assessment triggers

- The canonical phase model changes (phase added/renamed/removed) — the enum and step map must move in lockstep with the bdd skill and glossary.
- `reviewGate` flips default-on — Tier-2 phase-exit review overlaps this gate's transition trigger; reconcile message ordering.
- #644 G1 (artifact precedence) lands — it may reorder or merge the ticket.md gate chain this gate sits at the head of.
- `parseFrontmatter` is replaced with a real YAML parser — the flow-style comma decision becomes obsolete; revisit the syntax guidance.
- G3/G5 (Bash bypass, commit-time reconciliation) land — revisit the deliberately skipped corrupt-direction gating (out_of_scope, work log 2026-07-03T17:00).
- The four ticket.md gate sections in pre-tool-quality.ts each re-read prior content and recompute the proposed content — hoist a shared pair if a fifth gate joins the chain (quality-review suggestion #3).
- Frontmatter values stay case-sensitive codebase-wide (`type: Feature` exempts everywhere, not just here) — a shared normalizer is a later cross-cutting ticket (quality-review suggestion #5).
- Deleting the `phase:` field is currently a tolerated no-op measured from the intake baseline on re-add — pin with a scenario if it ever misbehaves (quality-review suggestion #4).
