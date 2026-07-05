---
id: RM84M8
slug: evidence-anchored-phase-transitions
type: feature
phase: done
status: done
epic: "808"
phase_anchors:
  - define-behavior: 368c6e0
  - scenario-gate: a88e475
  - implement: e092bef
  - verify: 2c3c33f
  - done: ba1ffbf
scope:
  - "Anchor format: a `phase_anchors:` block sequence in feature ticket.md frontmatter (`  - <phase>: <sha>`, mirroring the existing `phase_skips` convention), one appended entry per phase entered — never an overwritten scalar."
  - "Pure detection predicate `detectUnanchoredPhaseTransition(prior, proposed, resolveSha?)` in the phase-provenance lib: for a feature forward advance, reports whether the entered phase carries a valid anchor. Format-only when no resolver; adds HEAD-reachability when a resolver is injected (the shape #810's boundary consumes). This predicate is the deliverable substrate — it has no caller that blocks in #809."
  - "Reuse, not duplicate: anchor SHA-format via the ledger's `isValidSha` (parse-annotation.ts) and the injected `ShaResolver` shape (ledger-validation.ts / ledger-git.ts); frontmatter + transition parsing via the existing phase-provenance helpers."
  - "Unit tests for the predicate (anchored pass; missing / malformed / unreachable fail; backward, re-declare, non-feature, at-rest legacy all silent)."
  - "Dogfood: this ticket's own forward phase transitions carry `phase_anchors` entries, proving the Edit path records them."
  - "templates/hooks ↔ .safeword/hooks byte-parity kept (parity check green)."
out_of_scope:
  - "Any write-time gate change — no hard-deny and no warn on a missing/unanchored advance. A write-time check sees only SHA *format* (no git at write-time), so a `sed` forger appends a well-formed fake SHA and passes while an honest agent who forgot the field is blocked; the asymmetry inverts. Anchor *enforcement* is #810's boundary job, where git can verify reachability."
  - "#810 boundary reconciliation gate (local git hook + server-side required check) — this ticket only produces + detects the anchors #810 reconciles."
  - "Explicit per-write `channel` stamp via a net-new PostToolUse hook — rejected in /figure-it-out: the channel field is self-asserted and independently unverifiable, adding surface without forgery resistance."
  - "Cryptographic attestation (signed commits / git notes) — rejected: defends commit-authorship spoofing, not #644's no-commit `sed` forge, and imposes signing infra on every consumer repo."
  - "Ledger R/G/R tick anchors — already carry SHA (ledger-validation.ts `checkSha`); the Bash write-channel is already blocked (bash-ledger-writes.ts). Unchanged here."
  - "Retroactive validation of legacy tickets at rest — the gate polices transitions, not history (mirrors phase-provenance.ts today)."
  - "Host-repo git-hook installation via setup/upgrade — that is #810's install path."
done_when:
  - "The `phase_anchors` frontmatter format is defined and documented as the anchor a forward feature phase advance records via the Edit path."
  - "`detectUnanchoredPhaseTransition(prior, proposed, resolveSha?)` returns unanchored for a forward feature advance with a missing / malformed anchor (format-only, no resolver) or an unreachable anchor (with a resolver), and stays silent on backward moves, re-declarations, non-feature tickets, and at-rest legacy tickets (unit-tested)."
  - "Anchor SHA-format + resolver reuse the ledger primitives and the phase-provenance frontmatter/skip parsers — no duplicated SHA-format or parse logic."
  - "No write-time gate change, no new hook file, no new prose nag: #809 is substrate only; #810 is the sole enforcer."
  - "This ticket's own phase transitions carry `phase_anchors` entries (dogfood proof)."
  - "Full `/verify` + `/audit` pass; verify.md written; templates↔.safeword parity green."
created: 2026-07-05T15:23:19.033Z
last_modified: 2026-07-05T15:23:19.033Z
---

# Evidence-anchored phase transitions (SHA-per-transition provenance)

**Goal:** Give a feature ticket's `phase:` advance the same machine-checkable commit-SHA anchor the R/G/R ledger already has per tick, so a `sed`/Bash-forged transition is detectable as unanchored — as the reusable substrate #810's boundary gate enforces.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Design Decision — anchor model (from /figure-it-out, refined by an independent /quality-review)

**Chosen: SHA-per-transition, channel implicit.** A phase advance records a commit-SHA anchor; forgery resistance comes from cross-checking the SHA against git history (the ledger's proven `checkSha` model), not from the agent asserting it. Legality reuses `phase-provenance.ts`.

- **Rejected — explicit channel stamp (net-new PostToolUse hook):** the channel field is agent-controllable and has no external oracle to verify against, so it adds procedural surface with ~zero forgery resistance. Violates the epic's "subtract surface."
- **Rejected — signed commits / git notes:** SLSA-grade but defends the wrong threat (commit-authorship spoofing, not #644's no-commit `sed` forge) and imposes signing infra on every consumer — the opposite of "cheap to attest (presence + SHA match)."

Load-bearing evidence: SLSA's attestation model requires provenance fields be generated/verified by a trusted control plane, not the policed party — a SHA is trustworthy because git history is the independent record the agent can't cheaply fabricate; a self-typed `channel` string is not.

**Enforcement lives at the boundary (#810), not here.** A write-time check on anchor presence/format was considered and rejected: with no git at write-time it can only see SHA *shape*, so a `sed` forger appends a well-formed fake SHA in the same write and passes, while an honest agent who forgot the field is blocked — the asymmetry inverts (honest users pay, forgers walk), for no forgery resistance and ~8 broken transition fixtures plus skill-prose churn. Real resistance needs HEAD-reachability, available only at #810's commit/push boundary. So #809 ships the format + the detection predicate; #810 is the sole enforcer.

**Caveat handed to #810:** phase transitions are **not** commit-bearing the way R/G/R ticks are — several phases can legitimately advance in one commitless sitting and share a `HEAD`. #810's checks (including any distinct-SHA/collision logic) must tolerate that, not demand a distinct commit per phase.

## Work Log

- 2026-07-05T15:23:19.033Z Started: Created ticket RM84M8
- 2026-07-05T15:18:00.000Z Intake: framed via full research (explorer map + /figure-it-out); spec.md authored + self-reviewed (Tier 1 stamp). Scope set to #809 substrate only per user (two-fork convergence).
- 2026-07-05T16:04:00.000Z Intake refine: independent /quality-review (REQUEST CHANGES) showed write-time format-only hard-deny catches no forger and taxes honest advances; re-scoped to substrate-only (format + detection predicate), enforcement is #810's. Softened AC1's distinct-SHA claim (phases aren't commit-bearing).
- 2026-07-05T16:13:00.000Z Complete: define-behavior + scenario-gate — 13 scenarios / 3 rules; independent /review-spec (0 must-fix, 5 should-strengthen) applied; impl-plan.md written.
- 2026-07-05T16:31:00.000Z Complete: implement — TDD RED (1050da6) → GREEN (cd064e7) → REFACTOR (eced2b7, shared parser); 17 unit + 16 acceptance scenarios green.
- 2026-07-05T17:20:00.000Z Complete: verify — 936 hook tests, 259 acceptance scenarios, build/typecheck/lint green; /audit passed (0 errors); verify.md written. Ticket done.
