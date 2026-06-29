# Spec: Reconcile ARCHITECTURE.md against the generated architecture doc (AXRC4D)

## Jobs To Be Done

### AXRC4D.J1 — Keep the human architecture doc honest about the real structure

**Persona:** Technical Builder (TB)

safeword generates `architecture.generated.md` (a deterministic, always-fresh
module/package map) but my hand-authored `ARCHITECTURE.md` is never reconciled
against it, so it silently rots — I add or remove a module and the human doc
still describes the old shape. I want the two to disagree *loudly* (a clear
finding when I run `/audit`, and a nudge at the done-gate when a ticket moved the
shape), so the narrative stays trustworthy — **without** a tool ever rewriting my
"why" or blocking my commit on a human-owned file.

#### AXRC4D.J1.AC1 — Orphaned module is flagged

When `ARCHITECTURE.md` documents a module/layer (or a layer→directory mapping)
that no longer appears in `architecture.generated.md`, `/audit` reports it as a
structural-drift finding that cites the generated doc — distinct from the
existing dependency-drift check.

#### AXRC4D.J1.AC2 — Missing module is flagged

When a real top-level module/package in `architecture.generated.md` is never
mentioned in `ARCHITECTURE.md`, `/audit` reports it as a structural gap.

#### AXRC4D.J1.AC3 — Narrative is never auto-overwritten

The structural reconciliation is **report-only**: it cites evidence and proposes
edits for human review; it never rewrites the free narrative and never blocks.
The structural *facts* are read from the generated doc (deterministic-by-reading);
only narrative *judgment* is left to the human/agent.

#### AXRC4D.J1.AC4 — Done-gate nudge when this ticket moved the shape

When a ticket moved the top-level architecture fingerprint (the value recorded in
`architecture.generated.md`) and an `ARCHITECTURE.md` exists, the done-gate emits
a one-line, **non-blocking** advisory pointing at `ARCHITECTURE.md`.

#### AXRC4D.J1.AC5 — No false alarm

A ticket that did **not** move the top-level fingerprint, or a project with no
`ARCHITECTURE.md`, emits **no** nudge. The advisory never blocks the done
transition.

## Problem

The structural facts (which modules/layers exist) already live, machine-readable,
in `architecture.generated.md`. The narrative (why it's shaped this way) is
human-owned. Today nothing connects them, so the human doc drifts silently. The
fix splits by what each side is good at: a **skill** (`/audit`) READS the
generated doc and reports structural drift; the **already-computed fingerprint**
is reused as a cheap done-gate trigger so the reconcile is prompted when it
matters instead of being forgotten.

## Design

Two surfaces, no new deterministic drift module and no managed region (both
explicitly rejected — see ticket Decision):

- **`/audit` structural reconciliation (skill prompt).** Sharpen the existing
  `ARCHITECTURE.md` check to reconcile structural claims against
  `architecture.generated.md` (the `### <name>` units under `## Modules` /
  `## Packages`): orphaned (error), missing (warn), drifted layer→dir (warn).
  Report-only; new codes E003/W008/W009.
- **Done-gate nudge (deterministic Stop-hook trigger).** A small hook helper
  (`architecture-document-nudge.ts`) reads the generated doc's recorded
  `fingerprint:` on disk and at the branch base (`git show <merge-base>:…`); when
  they differ and `ARCHITECTURE.md` exists, the done-gate surfaces a one-line
  non-blocking advisory. It REUSES the existing fingerprint (computes nothing from
  source — not a drift detector) and never blocks.

## Out of scope

A bespoke deterministic `architectureDocDrift` source-analyzing module; a managed
Module-Map region inside `ARCHITECTURE.md`; any blocking gate; LLM rewriting of
narrative beyond what `/audit` already does; touching the generated-doc pipeline
(extraction/fingerprint/self-heal) — this ticket only consumes its outputs.
