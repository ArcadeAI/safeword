---
id: AXRC4D
slug: architecture-md-reconcile
type: feature
phase: verify
status: todo
created: 2026-06-29T00:42:00.000Z
last_modified: 2026-06-30T04:10:00.000Z
scope:
  - Sharpen the `/audit` skill's existing ARCHITECTURE.md check (§5 "Project Documentation Checks") to reconcile the human doc's STRUCTURAL claims against `architecture.generated.md` — the machine-listed module/layer set — not only against `package.json` dependencies as today. The agent reads the generated doc as ground truth and flags: a documented module/layer that no longer exists (orphaned), a real top-level module the doc never mentions (missing), and a drifted layer→directory mapping. Report only; the agent updates the human narrative with the user reviewing. It NEVER auto-overwrites prose.
  - A fingerprint-triggered staleness NUDGE at the done-gate (`/verify` / the Stop done-gate hook): when the project's top-level shape fingerprint moved DURING this ticket, surface a one-line, NON-blocking advisory — "you changed the top-level structure; ARCHITECTURE.md's module/layer description may be stale — reconcile it." Reuse the EXISTING `shapeFingerprint`/`monorepoFingerprint` already computed by the architecture subsystem; do not build a new detector.
  - Anchor both surfaces on the generated doc as ground truth (the agent READS the machine module list), so the structural verdict is deterministic-by-reading rather than model-guessed.
out_of_scope:
  - A bespoke deterministic `architectureDocDrift` TS module — explicitly dropped (see Decision below). Reuse the fingerprint that already exists; the generated doc already IS the readable structural truth.
  - A marker-delimited "managed Module-Map region" inside ARCHITECTURE.md (safeword owning part of a human file). Deferred — only reconsider if the skill-first approach proves insufficient in practice. It is the heaviest, riskiest piece (a new partial-file ownership primitive) and is not needed for v1.
  - Any BLOCKING gate. ARCHITECTURE.md is human-owned; only a person can fix narrative drift, so blocking a commit/CI on it is hostile and false-positive-prone. Advisory only, everywhere.
  - LLM rewriting of free narrative beyond what `/audit` already does (drift reporting + targeted edits under human review). No autonomous prose generation.
  - Touching the generated-doc pipeline itself (extraction, fingerprint, self-heal) — unchanged; this ticket only consumes its outputs.
done_when:
  - Running `/audit` on a repo whose ARCHITECTURE.md omits a real top-level module, or names a module that was deleted, produces a clear drift finding that cites the generated doc — distinct from the existing dependency-drift check.
  - When a ticket adds or removes a top-level module/package, that ticket's done-gate emits a one-line non-blocking nudge pointing at ARCHITECTURE.md; a ticket that did NOT move the top-level fingerprint emits no nudge (no false alarm).
  - Neither surface blocks; neither auto-edits the human narrative; both read the generated doc as the source of structural truth.
  - No new deterministic drift TS module and no managed-region ownership were introduced (the change is a skill/prompt sharpening plus reuse of the existing fingerprint signal).
  - Scenarios cover: in-sync (no finding, no nudge); a new module (missing-in-doc flagged); a removed module (orphaned-in-doc flagged); ARCHITECTURE.md absent (audit's create-from-template path, unchanged); a non-structural ticket (no nudge).
---

# Reconcile ARCHITECTURE.md against the generated architecture doc

**Goal:** Keep the human-authored `ARCHITECTURE.md` honest about the project's
real structure by reconciling it against the always-accurate
`architecture.generated.md` — without ever overwriting the human "why," and
without building new deterministic machinery.

## Why

safeword generates `architecture.generated.md` (the deterministic module map +
dependency fingerprint, kept fresh by hooks) but `ARCHITECTURE.md` (the human
design narrative) is never reconciled against it, so it silently rots: a module
is added or removed and the human doc still describes the old shape. The two
never disagree loudly.

## Decision (from `/figure-it-out`, 2026-06-29)

Reconciliation splits by what each tool is good at:

- **The structural facts** (which modules/layers exist) — the generated doc
  already IS the machine-readable truth. A skill READS it and compares.
- **The narrative** (why it's shaped this way) — only a human/agent can judge if
  a paragraph is still true; surface it, never auto-rewrite it.

So the reconciliation WORK is a **skill** (sharpen the existing `/audit` doc
check), and the only non-skill piece is reusing the **already-computed
fingerprint** as a cheap trigger so the skill is run when it matters (done-gate
nudge) instead of being forgotten. This deliberately REJECTS the earlier,
heavier proposal (a new `architectureDocDrift` module + a marker-delimited
managed region) as over-built: the fingerprint and the readable generated doc
already provide everything the deterministic layer needs.

**Where it fires:** detect cheaply + advisory at the done-gate and in `/audit`'s
report; RECONCILE the narrative at `/audit` (agent + human review). Never block.

**Premortem:** the likely failure is inconsistent reconciliations (different agent
runs disagree on "stale," doc thrashes). Mitigate by anchoring the skill to the
generated doc as ground truth so the structural verdict is deterministic-by-reading
and only genuine narrative judgment is left to the model.

## Next

Run `/bdd` to turn the five `done_when` flows into scenarios (in-sync, new
module, removed module, doc-absent, non-structural ticket), then implement as a
skill/prompt sharpening + the fingerprint-triggered done-gate nudge.
