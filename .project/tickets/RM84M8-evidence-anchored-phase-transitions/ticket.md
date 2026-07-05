---
id: RM84M8
slug: evidence-anchored-phase-transitions
type: feature
phase: intake
status: in_progress
epic: "808"
scope:
  - "Anchor format: a `phase_anchors:` block sequence in feature ticket.md frontmatter (`  - <phase>: <sha>`, mirroring the existing `phase_skips` convention), one appended entry per phase entered — never an overwritten scalar."
  - "Pure detection predicate `detectUnanchoredPhaseTransition(prior, proposed, resolveSha?)` in the phase-provenance lib: for a feature forward advance, reports whether the entered phase carries a valid anchor. Format-only when no resolver (write-time); adds HEAD-reachability when a resolver is injected (the shape #810's boundary consumes)."
  - "Reuse, not duplicate: anchor SHA-format via the ledger's `isValidSha` (parse-annotation.ts) and the injected `ShaResolver` shape (ledger-validation.ts / ledger-git.ts); transition legality via existing phase-provenance evaluation."
  - "Harden the existing write-time phase-provenance gate (pre-tool-quality path) so a forward feature advance whose entered phase lacks a valid-FORMAT anchor is denied — the same deny channel the gate already uses for illegal transitions. Cheap-to-attest presence only; reachability deferred to #810."
  - "Tests: unit tests for the predicate (anchored pass; missing / malformed / unreachable fail; backward, re-declare, non-feature, at-rest legacy all silent) and phase-provenance integration; update existing phase-provenance fixtures to the new contract."
  - "templates/hooks ↔ .safeword/hooks byte-parity kept (parity check green)."
out_of_scope:
  - "#810 boundary reconciliation gate (local git hook + server-side required check) — this ticket only produces + detects the anchors #810 reconciles; reachability enforcement is #810's."
  - "Explicit per-write `channel` stamp via a net-new PostToolUse hook — rejected in /figure-it-out: the channel field is self-asserted and independently unverifiable, adding surface without forgery resistance."
  - "Cryptographic attestation (signed commits / git notes) — rejected: defends commit-authorship spoofing, not #644's no-commit `sed` forge, and imposes signing infra on every consumer repo."
  - "Ledger R/G/R tick anchors — already carry SHA (ledger-validation.ts `checkSha`); the Bash write-channel is already blocked (bash-ledger-writes.ts). Unchanged here."
  - "Retroactive validation of legacy tickets at rest — the gate polices transitions, not history (mirrors phase-provenance.ts today)."
  - "Host-repo git-hook installation via setup/upgrade — that is #810's install path."
done_when:
  - "A forward phase advance in a feature ticket records a per-phase `phase_anchors` entry via the Edit path (unit-tested)."
  - "`detectUnanchoredPhaseTransition` returns unanchored for a forward feature advance with a missing / malformed / (with resolver) unreachable anchor, and stays silent on backward moves, re-declarations, non-feature tickets, and at-rest legacy tickets (unit-tested)."
  - "Anchor validity and transition legality reuse the existing ledger SHA check and phase-provenance evaluation — no duplicated SHA-format or frontmatter-parse logic."
  - "No new prose nag and no net-new hook file: the invariant is enforced through the existing phase-provenance write-path gate."
  - "Full `/verify` + `/audit` pass; verify.md written; templates↔.safeword parity green."
created: 2026-07-05T15:23:19.033Z
last_modified: 2026-07-05T15:23:19.033Z
---

# Evidence-anchored phase transitions (SHA-per-transition provenance)

**Goal:** Give a feature ticket's `phase:` advance the same machine-checkable commit-SHA anchor the R/G/R ledger already has per tick, so a `sed`/Bash-forged transition is detectable as unanchored.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Design Decision — anchor model (from /figure-it-out)

**Chosen: SHA-per-transition, channel implicit.** A phase advance records a commit-SHA anchor; forgery resistance comes from cross-checking the SHA against git history (the ledger's proven `checkSha` model), not from the agent asserting it. Legality reuses `phase-provenance.ts`.

- **Rejected — explicit channel stamp (net-new PostToolUse hook):** the channel field is agent-controllable and has no external oracle to verify against, so it adds procedural surface with ~zero forgery resistance. Violates the epic's "subtract surface."
- **Rejected — signed commits / git notes:** SLSA-grade but defends the wrong threat (commit-authorship spoofing, not #644's no-commit `sed` forge) and imposes signing infra on every consumer — the opposite of "cheap to attest (presence + SHA match)."

Load-bearing evidence: SLSA's attestation model requires provenance fields be generated/verified by a trusted control plane, not the policed party — a SHA is trustworthy because git history is the independent record the agent can't cheaply fabricate; a self-typed `channel` string is not.

**Split of enforcement:** write-time hardened gate checks anchor **presence + format** (cheap-to-attest → safe to block early); **reachability** is re-checked at #810's deliverable boundary (needs git; where one-shot/cloud sessions can't skip it).

## Work Log

- 2026-07-05T15:23:19.033Z Started: Created ticket RM84M8
- 2026-07-05T15:18:00.000Z Intake: framed via full research (explorer map + /figure-it-out); spec.md authored + self-reviewed (Tier 1 stamp). Scope set to #809 substrate only per user (two-fork convergence).
