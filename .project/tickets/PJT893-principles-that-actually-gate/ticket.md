---
id: PJT893
slug: principles-that-actually-gate
type: task
phase: intake
status: in_progress
created: 2026-09-05T22:36:59.730Z
last_modified: 2026-09-05T22:36:59.730Z
---

# Make authored project principles shape and gate delivered work

**Goal:** A customer's principles file reliably influences plans and blocks a broken principle trace before implementation starts.

**Why:** Today the parser silently discards normally-written principles and the trace check only runs advisory at Done.

## Work Log

- 2026-09-05T22:36:59.730Z Started: Created ticket PJT893

- 2026-09-05T22:45:00.000Z Design decided via /figure-it-out. **Format:** a
  principle is a `##` heading plus prose; no required fields. The
  `**Intent/Prefer/Avoid/Evidence**` set was read by nothing in the codebase, yet
  silently gated recognition — a plainly-written principles file had its
  principles discarded, so the plan's correct citation was reported as a
  fabrication. Reproduced against the real checker before changing anything.
  **Enforcement:** move the objective trace check from advisory `/audit` (late,
  at Done, where findings get waived — see FZTWG0's log) to
  `evaluateImplementEntry` (PreToolUse, blockable, fires once at
  plan-implementation → implement).
  **Rejected:** stable IDs (`PRIN-3`) — priced for 500 requirements changing
  weekly, we have eight; EARS "shall" syntax — structures requirements, and a
  principle has no trigger; a `doctor` principles validator — unnecessary once
  any heading is recognized, so it was cut rather than built.
  **Scope guard:** `/audit` keeps E010 as advisory drift detection. No new gate,
  no new file format, no new config.

- 2026-09-05T22:47:00.000Z Conceptual test against the real root `PRINCIPLES.md`:
  all 6 principles recognized, `## Further reading` terminates the list. Built a
  real Design alignment trace for this ticket's own work; the checker caught a
  genuine defect (an `explicit-conflict` row whose deviation wrote "Principle 5"
  instead of naming it verbatim), then passed once corrected. Two findings folded
  into template guidance: numbered headings force the number into every citation,
  and a deviation must name its principle exactly.

- 2026-09-06T05:20:00.000Z Ran the workflow skills that the first pass skipped
  (`/verify`, `/audit`, `/refactor`, `/quality-review`). They found three defects
  that raw tooling had missed, all mine:
  1. `/verify` — `historical-catalogue.generated.ts` was stale. It fingerprints
     every release's hook files, and `pre-tool-quality.ts` changed. A sixth
     generated artifact beyond the five AGENTS.md lists; parity-check reported
     260 pairs in sync and both plugin generators succeeded, so nothing flagged
     it. It failed `check:claude-plugin` and cascaded into two BDD scenarios.
  2. Regeneration order — the plugin bundles embed the catalogue digest, so
     regenerating the catalogue *after* them left stale bundles and failed a
     third BDD scenario. Bundles must regenerate last. Undocumented ordering.
  3. `/audit` — no test proved the plan gate actually blocks on a broken trace.
     The ticket's headline behavior was wired and read, never exercised. Added a
     block-and-admit pair.

- 2026-09-06T05:23:00.000Z Independent cross-agent review (headless Codex) over
  two passes found three errors, all one class: a proof reference resolving to an
  anchor no reader can follow, admitted through a now-blocking gate. Fenced and
  commented headings, partial principle-name conflict matching, and `id="…"`
  inside inline code. All fixed with regression tests verified to discriminate
  against the old behavior. Root lesson: moving a check behind a gate means
  owning its false-pass modes. Every one of these paths was pre-existing and
  harmless while advisory.

- 2026-09-06T15:40:00.000Z Review loop ran to eleven passes and was stopped by
  judgment. Worth recording honestly, because the shape of the loop is a finding
  in itself.

  **It never returned clean.** Eleven passes, eleven `request_changes`. That is
  how an adversarial LLM reviewer behaves — the literature reports non-monotonic
  convergence — so "loop until clean" is not a terminating rule. Mid-loop I
  adopted "continue while any finding is severity `error`", which is the rubric's
  own contract and was right on correctness, but it carries no cost term.

  **Value was not evenly distributed.** Passes 1–6 chased anchor resolution and
  ended in deleting the surface entirely; that detour was avoidable, and the
  signal to delete was available around instance three. Passes 7–11 found real
  fail-open bugs in table parsing, one of which this ticket introduced by making
  principle names permissive. Twice I tried to stop before pass 7; both attempts
  would have shipped a gate that silently judged nothing.

  **Three passes cleaned up after me.** An over-normalized fragment comparison, a
  block-split that could not work because `sectionBody` strips blank lines
  (unverified assumption about a helper), and an index filter that reported
  findings against an ordinary English sentence.

  **Transferable rules.** At the third instance of one defect class, fix the
  class — and check what upstream helpers actually return before building on
  them. A skipped row is worse than a wrong verdict; a false positive on a gate
  is worse than a missed edge case. Both directions need a test.
