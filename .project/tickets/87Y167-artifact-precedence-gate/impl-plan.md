# Impl Plan: Artifact precedence + review demand in the PreTool chain (#644 G1)

**Status:** implemented

<!-- Reconciliation (implement exit): the proof plan held — the cucumber
acceptance lane (real hook subprocess) is the primary proof for all 48
scenarios, with pure-logic units alongside; build order followed (two
behavior-preserving extracts → lib/artifact-precedence.ts → wiring by rule).
All Decisions held unchanged. One deviation surfaced in the whole-ticket
/quality-review and was fixed: an unreadable/directory `Feature source:` made
the gate's readFileSync throw, crashing the hook into a silent allow (exit 0);
both the gate callback and write-review-stamp.ts now safe-read → fall back to
the ledger (commit 1935b5f). Deferred (Assessment triggers): path-traversal
confinement of the source path, and the 0.63.0 MINOR version bump at release. -->


## Approach

**Riskiest assumption:** the always-on implement-entry scenario-review demand composes with the G2 phase-provenance hatch and legacy tickets without over-blocking — concretely, that "a phase_skips entry covering scenario-gate satisfies; any other entry does not; backward and non-implement advances stay free" can be implemented against the same frontmatter parse G2 uses. Cheapest proof: the phase_skips triangle (scenarios "A phase_skips justification covering scenario-gate satisfies the demand" / "A phase_skips entry for a different phase does not satisfy" / "Advancing into implement with no scenario artifact is denied") — sequenced as the first pure-logic slice, so a wrong design fails before any wiring exists.

**Proof plan** (per `testing/SKILL.md` highest-practical-scope rule, mirroring the 0KYEBN lane):

- Primary proof for every scenario: the Cucumber acceptance lane — `steps/artifact-precedence-gate.steps.ts` shells out to the **real** `packages/cli/templates/hooks/pre-tool-quality.ts` subprocess against throwaway projects (real collaborators; only the process boundary crossed). This is also the wiring proof for the gate's entry point.
- Supporting unit proof (vitest, `packages/cli/tests/hooks/artifact-precedence.test.ts`): the pure-logic partitions — creation-prerequisite evaluation, scenario-source resolution, stamp-scope matching, phase_skips coverage — plus the two partitions dimensions.md routes to units (payloads with no reconstructable content pass through; reviewGate-on produces no double demand).
- Template↔dogfood parity: `bun scripts/parity-check.ts` (the deployed `.safeword/hooks/` mirror stays byte-identical).

**Build order** (each slice builds on green):

0. Preparatory refactors (behavior-preserving, existing suite is the net): (a) extract the four ticket.md gate blocks' duplicated prior/proposed/frontmatter derivation into one computed write-context; (b) extract the inline test-definitions creation chain into a named function. One refactor → test → commit each.
1. `lib/artifact-precedence.ts` pure logic, load-bearing slice first: implement-entry advance detection + phase_skips scenario-gate coverage + stamp-scope matching for the resolved scenario source (`Feature source:` line in test-definitions.md → `.feature` path; else the ledger itself). Then creation-prerequisite evaluation (spec.md needs ticket.md; dimensions.md needs a JTBD/AC-complete spec.md, reusing `evaluateJtbdGate`/`evaluateAcGate`).
2. Wire the creation gates + earliest-first reordering of the extracted test-definitions chain (spec named before dimensions).
3. Wire the always-on spec-review demand at test-definitions creation (reuse `reviewGateForNextAsset`; fires with reviewGate off; same stamp satisfies the flag-gated Tier-1 path, so no double demand).
4. Wire the implement-entry scenario-review demand on ticket.md edits (ordered after the G2 provenance gate, before the #404 readiness gate).
5. Extend `write-review-stamp.ts` with the `scenarios` artifact (resolves the scenario source the same way the gate does — shared helper, no drift).
6. Cucumber steps + full lane green; per-scenario R/G/R through the ledger with a commit per step (RED may be `skip: <reason>` when an earlier slice's GREEN already covers the behavior — annotate honestly).
7. Cross-scenario refactor pass + ledger row.

Denial-text constraint carried from /quality-review: every new denial (reason + ordered-patch note + EXPLAIN_HINT) stays well under the verified 10,000-character hook-output cap.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Stamp machinery for the scenarios demand | Reuse `reviewScope()`/`hashArtifact()`/`reviewGateForNextAsset()` from review-ledger.ts | New scenario-specific ledger format | Content+ticket binding already built and tested; a second format doubles the drift surface |
| Scenario-source resolution | Parse the ledger's `Feature source:` line; fall back to the ledger file | Config key; glob by slug | The line is already the SCENARIOS.md convention; a foreign path inherits nothing because the stamp scope stays ticket-qualified (round-2 M1) |
| Where the pure logic lives | New `lib/artifact-precedence.ts` | Growing `active-ticket.ts` or `review-ledger.ts` | 0KYEBN single-responsibility pattern; the module owns exactly this gate family's decisions |
| Always-on demands vs the NMSD94 flag paths | Separate always-on checks; flag-gated Tier-1/Tier-2 untouched | Flip the flag default; merge into the flag paths | D2 (epic YA68QF): flipping violates the ship-inert ruling; merging couples rollout semantics — same stamp satisfies both paths, so no double demand |
| phase_skips as review-skip valve | A `phase_skips` entry covering `scenario-gate` specifically satisfies the implement-entry demand | Separate logged review-skip required even when the phase was justifiedly skipped | Double bookkeeping for the same auditable act; frontmatter skip is more visible than the log (round-3 M2 pins the qualification) |

## Arch alignment

- **Continuous Quality Gates (LOC + Phase + TDD)** — extends the same PreToolUse gate family with two new checkpoints; same deny/remediation shape.
- **Product-Framing Layer in BDD Phase 0 (JTBD / Personas / Acceptance Criteria)** — the precedence gates enforce that layer's artifact order (spec → dimensions → scenarios) instead of trusting it.
- **Architecture Review Gate (evidence + independent design review for features)** — reuses its stamp machinery and default-off flag posture for the whole ladder while promoting exactly two demands to always-on.
- **BDD as a Solo-Agent Adaptation of the Three-Practice Model** — the implement-entry demand enforces the scenario-gate exit review that ADR already prescribes.

## Known deviations

skip: no deviations planned — the gates join existing patterns (G2 ordering, NMSD94 stamps, #128 firing point untouched until sibling B04ADS).

## Assessment triggers

- Hook output strings are capped at 10,000 characters (verified 2026-07-03) — revisit denial composition if the chain's messages grow.
- #480 (plan-implementation phase) landing would change the implement-entry detection's target phase — re-key the advance detection.
- Review stamps moving off `skill-invocations.log` (e.g. per-ticket stamp files) would relocate `readReviewStamps` — the gate reads through one helper, so the seam is contained.
- If the Cucumber lane's subprocess-per-scenario cost becomes the suite bottleneck (>48 scenarios here), consolidate fixtures before splitting the feature file.
- **Deferred (whole-ticket review, non-blocking):** confine the resolved `Feature source:` path under the project root (a `../`-laden path is only hashed, never emitted, and the agent authors the ledger anyway, so it grants no bypass — but confinement bounds the read surface). Revisit if scenario-source resolution ever emits or executes the file.
- **Version:** a new always-on behavioral gate is a MINOR bump (`versioning` skill). v0.63.0 was released on main (#753) while this branch was in flight, so the target is **0.64.0** in `packages/cli/package.json` + `.claude-plugin/marketplace.json` at the epic's release step (this child is not itself a release).
- **Enforcement point (#644 reframe, 2026-07-04):** this gate enforces at **write-time (PreTool)**, which the maintainer's reframe flags as Bash-bypassable — an agent can `cat > test-definitions.md` or `sed` the ticket phase to sail past a PreTool Edit/Write gate (the same class of hole G3/#721 had to close for the ledger). This ticket is therefore the **interim** artifact-precedence enforcement: it's a genuine improvement over the pure-existence cascade (content-bound review stamps can't be satisfied by 3-minute retroactive skeletons), but the **durable** version re-validates these same `spec`/`scenarios` review stamps at the **commit/push reconciliation choke point (G5)** — the one gate a one-shot cloud run cannot skip. When G5 lands, its stamp checks subsume this gate's guarantee; keep the write-time gate as the fast-feedback front line, move the authority to the choke point. Successor tracking: #644 G5 (keystone).
