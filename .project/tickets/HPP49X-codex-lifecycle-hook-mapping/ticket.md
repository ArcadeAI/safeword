---
id: HPP49X
slug: codex-lifecycle-hook-mapping
type: task
phase: done
status: done
epic: codex-changelog-alignment
relates_to: QM5G9M
scope:
  - Write the Codex lifecycle hook mapping design for safeword's gate moments.
  - Capture Codex divergences from Claude Code, especially Stop behavior and incomplete tool interception.
  - Identify which later tickets depend on each mapping choice.
out_of_scope:
  - Implementing Codex config generation.
  - Building every Codex hook adapter.
  - Proving enterprise managed enforcement.
done_when:
  - `design.md` maps each safeword gate moment to a Codex event, signal, and reuse/divergence note.
  - `design.md` explicitly identifies which enforcement paths are hard blocks, advisories, nudges, or unsupported.
  - The ticket records that `5DEJ8V`, `JV6D1W`, and later adapters depend on this mapping.
---

# Map safeword lifecycle events to Codex hook events (design)

**Goal:** Design doc mapping safeword's five gate moments onto Codex hook events.

**Why:** Before generating config we need the event→gate contract, reusing Claude Code's logic where Codex matches.

## Mapping (verified against hooks doc 2026-05-31)

- `SessionStart` → bootstrap / context + state (inject, non-blocking).
- `UserPromptSubmit` → per-turn phase reminder **and the done/phase hard gate** — `decision:"block"` blocks the prompt; refuse the next turn until `verify.md` / phase precondition is met.
- `PreToolUse` → edit/phase gate — `permissionDecision:"deny"` (or exit 2) blocks the edit/command before it runs.
- `PostToolUse` → LOC gate signal — `decision:"block"` stops result handling (side effect already happened; can't undo).
- `Stop` → done-gate **nudge only**. Correction: Codex `Stop` `decision:"block"` does NOT prevent stopping — it auto-creates a continuation prompt. Same as Cursor, unlike Claude Code's hard Stop block. So the real done-gate enforcement lives at `UserPromptSubmit`, with `Stop` used to nudge continuation.

Divergence from Claude Code (8R54HV): CC enforces the done gate at `Stop` (hard block, capped at 8 — ticket EKNEW0). Codex/Cursor can't hard-block at stop, so the gate moves upstream to the prompt-submit event. Design the shared gate logic with this seam.

Revalidation note: current Codex docs also say `PreToolUse` and `PostToolUse` do not intercept every shell path yet. The design must describe these as strong guardrails for supported tool paths, not as the only enforcement layer. For gates that must be unskippable, pair tool hooks with `UserPromptSubmit`, `PermissionRequest`, managed hooks, and command rules where applicable.

## Done when

- Design doc in the ticket folder: each safeword gate → Codex event + signal + reuse-vs-divergence note from epic 8R54HV.

## Source

developers.openai.com/codex/hooks, /config-advanced

## Feature File Coverage

No source `.feature` file is required for this ticket. It is a completed design task whose deliverable is `design.md`: a lifecycle event mapping and downstream dependency record, not executable CLI, hook, or packaging behavior. Executable behavior is covered by `N12G95`, `5DEJ8V`, and the later adapter tickets that implement this mapping.

## Revalidation + /figure-it-out (2026-06-13)

**Frame:** Decide the lifecycle mapping that preserves safeword's gate strength on Codex while acknowledging where Codex differs from Claude Code.

**Research domains checked:** Codex hook event semantics, `Stop` continuation behavior, prompt-submit blocking, permission-request denial, post-tool limitations, and existing safeword gate placement.

**Options:**

1. Mirror Claude Code directly: map done to `Stop` and phase/edit to `PreToolUse`.
2. Prompt-submit centered: move all hard gates to `UserPromptSubmit`.
3. Mixed mapping: use `UserPromptSubmit` for turn-start/done/phase preconditions, `PreToolUse` for edit-time denial, `PermissionRequest` for approval-time denial, `PostToolUse` for side-effect review signals, and `Stop` only for continuation nudges.

**Recommend:** Use option 3. It is the only mapping that matches the current docs without weakening edit-time feedback or pretending `Stop` can hard-block.

**Next:** Write `design.md` with a gate-by-event table plus an explicit "Codex divergence from Claude Code" section covering stop behavior and incomplete shell interception.

## Work Log

- 2026-05-31 Created from Codex research.
- 2026-06-13T14:37:31Z Revalidated and ran /figure-it-out. Mapping still holds, but design must add the current `PreToolUse`/`PostToolUse` limitation and treat `UserPromptSubmit` as the hard done/phase chokepoint.
- 2026-06-13T15:13:35Z Complete: wrote `design.md` with the gate-by-event table, hard/advisory/nudge classifications, Codex-vs-Claude divergence notes, and downstream dependencies for 5DEJ8V/JV6D1W. Closed as a design task.
