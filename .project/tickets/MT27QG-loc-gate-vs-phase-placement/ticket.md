---
id: MT27QG
slug: loc-gate-vs-phase-placement
type: feature
phase: done
status: done
epic: workflow-gate-hygiene
created: 2026-05-31T18:31:15.935Z
last_modified: 2026-06-01T04:50:00.000Z
scope:
  - Decision (via /figure-it-out): KEEP the LOC trigger (it's phase-agnostic, reaching the un-phased majority a phase/step boundary can't) — do NOT relocate to phase/step.
  - New pure `isGitOperationInProgress(projectDirectory)` in `templates/hooks/lib/git-operation.ts` — detects merge/rebase/cherry-pick/revert via markers under the resolved git dir.
  - `post-tool-quality.ts` skips arming `gate = 'loc'` while an operation is in progress; `pre-tool-quality.ts` skips denying edits while one is in progress.
  - Unit tests for the detector; sync template → installed hook copies.
out_of_scope:
  - Relocating the trigger to a phase/step boundary (rejected — loses coverage of un-phased work; the TDD ledger already gates the phased path).
  - Removing blast-radius control (trigger placement only).
  - Threshold tuning (400) and mechanical-vs-dense weighting — no documented harm; deferred.
  - Non-LOC gates (phase gate, done gate).
done_when:
  - `isGitOperationInProgress` returns true under an active merge/rebase/cherry-pick/revert, false otherwise.
  - The LOC gate does not arm or block during a git operation; with no operation, ≥400 non-meta LOC still arms + blocks (no regression).
  - Detector unit-tested; template + installed copies in sync; full suite green.
---

# Review LOC gates — keep, or move trigger to phase/step

**Goal:** Audit safeword's LOC-triggered gating — the single `LOC_THRESHOLD = 400` commit gate — and decide whether a line-count threshold is the right trigger or whether a phase/step boundary would gate the same risk better.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes (run intake when picked up).

## Why

Safeword's blast-radius control fires on a line-count heuristic. **Verified against current code (2026-05-31):** `LOC_THRESHOLD = 400` is defined once in `quality-state.ts:9` (with `META_PATHS = ['.safeword-project/', '.safeword/', '.claude/', '.cursor/']` excluded, `:15`); `post-tool-quality.ts:122` counts LOC-since-commit and sets `state.gate = 'loc'` at the threshold; `pre-tool-quality.ts:406` then denies the next edit. So it's **one gate**, surfaced across post-tool (count) + pre-tool (block) + the prompt/stop messaging — not several.

LOC is a proxy for "you've changed enough that you should commit / a reviewer should see a checkpoint," but it's a blunt one: 400 lines of mechanical rename and 400 lines of dense new logic carry very different risk, and the threshold can fire mid-task at an awkward boundary (a known failure mode — the LOC gate blocking mid-merge; recorded in the project's agent **memory** as `project_loc_gate_blocks_merge`, not yet a repo learning). A phase/step boundary (e.g. commit-at-GREEN, commit-on-phase-transition) may gate the _actual_ risk moment more precisely than a line count.

## Scope (sketch — refine at intake)

- **Confirm the trigger surface** (revalidation already did a first pass: one gate — `LOC_THRESHOLD` in `quality-state.ts`, counted in `post-tool-quality.ts`, enforced in `pre-tool-quality.ts`). Re-grep at pickup in case another line-count trigger has since been added; inventory what it gates, threshold, exclusions.
- **Per gate, decide:** keep LOC as-is, keep LOC but tune (threshold/exclusions), or move the trigger to a phase/step boundary (e.g. fire at GREEN, at phase transition, or per-scenario) — whichever gates the real risk with the fewest false trips.
- **Evidence-based call** (`/figure-it-out`): what's blast-radius control actually protecting against, and does LOC or a phase/step boundary correlate better with that risk? Check the `natural-vs-self-report-gates` learning (physics-not-policy) and the LOC-gate-blocks-merge failure mode.
- Ship any resulting gate change + tests.

## Out of scope

- Removing blast-radius control entirely — the question is _trigger placement_, not whether to gate.
- Non-LOC gates (phase gate, done gate) except where they'd absorb a relocated LOC trigger.

## Related

- **M7AZY3** — parent cleanup epic.
- `quality-state.ts` — the primary LOC gate (~400-LOC commit threshold + `META_PATHS`).
- Repo learning: `natural-vs-self-report-gates` (physics-not-policy gate design — the lens for "what does this gate actually protect?").
- Project agent memory: `project_loc_gate_blocks_merge` (the mid-merge block failure mode — a memory note, not a `.safeword-project/learnings/` file).

## Work Log

- 2026-05-31T18:31:15.935Z Started: Created ticket MT27QG
- 2026-05-31T18:31:15.935Z Filed (backlog): carved from this session's cleanup pass. LOC is a blunt blast-radius proxy (400 mechanical lines ≠ 400 dense lines) and has a known mid-merge-block failure. Inventory the LOC gates; per gate decide keep/tune/relocate-to-phase-step via /figure-it-out. Sized feature (gate-behavior change); intake confirms.
- 2026-05-31T18:37:30.834Z Revalidated against current code: confirmed `LOC_THRESHOLD = 400` (`quality-state.ts:9`) + exact `META_PATHS` (`:15`); it's **one** gate (post-tool counts `:122`, pre-tool blocks `:406`), not several — corrected the "find every gate" framing. Also corrected: the mid-merge-block failure is a project **memory** note (`project_loc_gate_blocks_merge`), not a repo learning. Scope/why/related updated to match.
- 2026-06-01T04:50:00.000Z Complete: intake — `/figure-it-out` → **KEEP (B)**, not relocate (C): LOC is phase-agnostic so it reaches the un-phased majority a phase/step trigger can't, and it's already a natural gate; the per-step TDD ledger covers the phased path. Root cause of the deadlock confirmed: `countLoc` = `git diff --stat HEAD` counts incoming merge lines; no MERGE_HEAD detection exists. Fix: git-operation-aware suppression. spec.md (JTBD TB1, AC1–AC2) + scope written.
- 2026-06-01T04:50:00.000Z Complete: define-behavior — 8 scenarios (AC1 detect merge/rebase/cherry-pick/revert + gate-stands-down-mid-merge; AC2 false-when-clean / not-a-repo / gate-still-arms-normally). dimensions derived. Decomposition skipped — one pure detector + two guard clauses. → implement.
- 2026-06-01T05:05:00.000Z Implement: RED 999be3ed (stub) → GREEN 5795409f (`isGitOperationInProgress` + post-tool/pre-tool guards; new lib registered in schema; copies synced). 6 detector + 2 integration green; quality-gates LOC suite green (no regression). REFACTOR: un-exported OPERATION_MARKERS (477ad4ea).
- 2026-06-01T05:17:00.000Z Complete: verify + audit — full suite 2358/2358 (1 skipped), build/lint clean, jscpd 0 clones, leaf-module architecture. /verify + /audit invoked. verify.md written. → done.
