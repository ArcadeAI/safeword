---
id: 0KYEBN
slug: phase-provenance
type: feature
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/644
scope: |
  Phase-provenance gate (#644 G2) in pre-tool-quality.ts's ticket.md section,
  ordered before the #404 readiness gate, with pure logic in a new
  lib/phase-provenance.ts. Fires only on writes that create a feature
  ticket.md, change a ticket's phase, or flip a ticket's type to feature
  (counts as a birth at the current phase — review-spec adversarial finding);
  denies when (a) a created feature ticket starts past intake, (b) an edit
  advances phase more than one canonical step (intake → define-behavior →
  scenario-gate → implement → verify → done), or (c) the target phase is off
  the canonical enum — unless every skipped phase carries a phase_skips
  frontmatter entry "<phase>: <reason>" with a non-empty reason (house skip:
  semantics). Creation with unparseable/missing frontmatter fails closed
  (#119). Unknown/absent prior phase counts as intake for step-counting
  (legacy migration path). Backward moves always allowed.
  Unit tests for the pure logic + gate-level tests per existing conventions.
out_of_scope: |
  - #644 G1 (artifact precedence/review demands) and G4 (impl-plan timing) —
    next ticket, paired per the agreed ordering
  - #644 G3 (Bash-channel bypass of write-time gates), G5/G6 (commit/push
    reconciliation) — later tickets
  - Normalizing existing off-enum tickets (research, backlog, shape, …) —
    gate is transition-scoped, never validates tickets at rest
  - Gating frontmatter corruption itself (parseable → unparseable edits) —
    repair-side gating closes the provenance route; corruption integrity is
    G3/G5 territory (see work log 2026-07-03T17:00)
  - CLI `ticket new` changes (already births features at intake)
  - Codex/Cursor adapter changes (they spawn the Claude gate as source of truth)
done_when: |
  - Creating a feature ticket.md at a phase past intake without per-phase
    skips is denied at write time with plain-language remediation
  - Editing a feature ticket.md to jump forward past an intermediate phase
    without matching phase_skips entries is denied, naming the skipped phases
  - Off-enum target phases are denied for feature creations/phase-changes;
    tickets at rest and backward moves are untouched
  - Task/patch/epic ticket writes never trip the gate
  - Full test suite green
created: 2026-07-03T15:17:49.077Z
last_modified: 2026-07-03T15:17:49.077Z
---

# Phase provenance: feature tickets must be born at intake and advance one phase at a time

**Goal:** Make ticket phase state trustworthy — feature tickets are born at intake and advance one canonical phase at a time, with any deliberate skip explicit, per-phase, and permanently visible (#644 G2).

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-03T15:17:49.077Z Started: Created ticket 0KYEBN
- 2026-07-03T15:25:00Z Found: G2 gap confirmed in code — #404 readiness gate (pre-tool-quality.ts:437) only fires on phase *changes into* define-behavior; creation at a later phase and forward jumps never trip it. Cursor/Codex adapters spawn the Claude hook as source of truth, so one gate covers all three harnesses.
- 2026-07-03T15:25:00Z Found: phase census — ~15 live/completed tickets carry off-enum phases (research, backlog, shape, understand, todo, clarify, tdd, planning); enum validation must be transition-scoped, never at-rest.
- 2026-07-03T17:12:00Z Found: full-suite baseline comparison (origin/main worktree vs branch, name-level diff) — systematic deltas were the gate's collateral, now fixed (a16def3): contentless payloads pass through (pinned by quality-gates 2.4/9.10 + cursor unreadable-ticket tests), Tier-2 fixtures retargeted to one-step advances. Remaining full-run deltas are cross-run flake (installer/lint env tests; 80 vs 76 on identical code, setup-core 11/11 in isolation).
- 2026-07-03T16:50:00Z Complete: implement — reconciled impl plan; 0 decisions changed (all held), 2 reconciliation notes recorded under Known deviations, 3 assessment triggers added from quality-review suggestions. Whole-ticket /quality-review: APPROVE, no critical issues; cross-scenario refactor 7b0e7f4 (typed canonicalIndex, steps dedupe); docs follow-up parked as SBRA2R. Awaiting baseline suite comparison before phase: verify.
- 2026-07-03T16:45:00Z Found: implement loop done — 31/31 scenarios through R/G/R (93 ledger boxes, each with step SHA or reasoned skip; commits 13c6582→517db68). Cucumber 33/33 pickles, 30 unit partitions. Full-suite run surfaced 80 failures across 44 files; targeted triage shows the 6 hook-area failures reproduce identically on origin/main (environment/pre-existing, e.g. session-author-model, skill-nudge-agents) — full baseline comparison running before verify. Rough edge for retro: pre-push schema-drift test scans raw .safeword/ filesystem and trips on the gitignored self-report spool; drained (filed #682) spool deleted to unblock push.
- 2026-07-03T17:35:00Z Complete: scenario-gate - Scenarios validated (AODI) + adversarial pass: 4 independent review rounds (BLOCK×3 → PASS), all findings applied; /quality-review APPROVE (hook contract + cucumber version verified against live docs; flow-style comma hazard captured as impl decision); user confirmed proceed-unsplit at 31 scenarios; scenario-gate review stamp written; impl-plan.md written (proof plan + build order in Approach, Status: planned).
- 2026-07-03T17:15:00Z Found: re-review round 4 returned PASS — reviewer could construct no false-provenance implementation passing all 30 scenarios, and independently validated the corrupt-direction skip as sound (corruption is a loud dead end; every exit passes a pinned deny or hatch). Applied both non-gating strengtheners verbatim: repair-at-intake allow scenario (now 31 scenarios) and the corrupt-direction skip promoted to out_of_scope. Next per user instruction: /quality-review before impl-plan.
- 2026-07-03T17:00:00Z Found: re-review round 3 returned BLOCK — the at-rest-unparseable scenario invited an `if (!priorParses) allow` shortcut enabling a corrupt-then-repair smuggle. Applied: repair-direction scenario (unparseable → parseable feature past intake = birth, denied); off-enum flip pinned to counts-as-intake (allow — consistent with the migration semantics decision); "traversed" → "skipped" title fix. Now 30 scenarios. Deliberate skip: the reviewer's optional corrupt-direction scenario (parseable → unparseable edit denied) NOT added — the repair scenario kills the smuggle at write 2, and gating frontmatter corruption itself is general integrity enforcement (G3/G5 territory), not phase provenance; over-blocking legacy-ticket edits is the riskier failure here.
- 2026-07-03T16:25:00Z Found: re-review round 2 returned BLOCK — interaction catch: typeless-birth-allowed + task-only flip-deny jointly certified a two-write smuggle (typeless birth at implement, then add type: feature). Applied all round-2 findings: absent→feature flip denied; flip allow-side pinned (at intake, and with complete skips); malformed-but-present YAML creation denied; unparseable-at-rest edit tolerated; retagged no-phase-field scenario to TB1.AC1 under the step rule; AC1 broadened (any prior type, both-ways birth semantics, non-feature tickets untouched in motion). Now 28 scenarios across 5 rules; ledger 1:1.
- 2026-07-03T16:10:00Z Found: scenario-gate independent review (fresh-context subagent, /review-spec procedure) returned BLOCK — 1 must-fix (counts-as-intake semantics had allow-side coverage only; an implementation exempting unknown phases entirely would pass) + 5 strengtheners incl. the type-flip smuggle (task born at implement, then type flipped to feature) and #119-style unparseable-frontmatter fail-open risk. Applied all findings: 8 scenarios added (now 23 across 5 rules), AC1/AC2 descriptions broadened, scope amended (type-flip counts as birth; creation fails closed on unparseable frontmatter), dimensions extended. Spec edits invalidate the content-bound spec review stamp — re-running /self-review, then re-reviewing the gate before stamping.
- 2026-07-03T15:50:00Z Complete: define-behavior - 15 scenarios defined across 5 rules (one rule per AC; saved to features/phase-provenance.feature + R/G/R ledger). User accepted the set and directed /quality-review to run after the adversarial pass, before impl-plan.
- 2026-07-03T15:40:00Z Complete: intake - Understanding converged, scope established. All three sub-phase gates user-confirmed (JTBD ✓, AC ✓, scope re-presented after /figure-it-out on the boundary and confirmed as G2-minimal). /self-review run on spec.md — passed, no edits, stamp written. Cold-start check not offered (recorded Reversibility: two-way door).
- 2026-07-03T15:30:00Z Decision (/figure-it-out): escape hatch is a per-phase `phase_skips:` frontmatter list ("<phase>: <reason>", non-empty reason, one entry per skipped phase). Rejected: single blanket skip field (suppression-without-justification debt; skipping 3 gates would cost same as 1), no-hatch (drives legitimate retro-ticketing to Bash bypass). Unknown prior phase counts as intake for step-counting (legacy migration path). Gate ordered before #404 so denials compose. Premortem: boilerplate-pasted skips re-normalize bypass — mitigated by per-phase reasons, permanent visibility, and later G5/G6 commit-time reconciliation.
