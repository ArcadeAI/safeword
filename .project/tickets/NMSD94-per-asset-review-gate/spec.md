# Spec: Two-tier review enforcement (per-asset stamp + phase-exit independent review)

## Intent

Make "work is reviewed before it's built on" enforceable in the safeword workflow, at two tiers — a cheap per-asset inline review stamp (early catch) and an independent fresh-agent review at each phase exit (the strong backstop) — closing the gap where review is under-triggered unless a human manually prompts it.

## References

- CC/Opus/skills research workflow `wf_c57312ee-82c` (2026-06-03) — verified Claude Code hook/skills primitives + the plan-validate-execute pattern.
- The TDD SHA-or-skip ledger (J7VBGJ) — the proven "stamp proves the step happened" pattern this generalizes.
- The `skill-invocation-log` + done-gate (147) — already requires `verify ✓` + `audit ✓` at done; Tier 2 reuses it at other phase exits.
- Ticket 153 — alert-to-action / bias-quiet lesson for the coverage-gate trial.
- B1TWX7 (wontfix) — authoring constraint: write the new review prose tight, no force-it padding.

## Personas

- **Technical Builder (TB)** — builds features through the agent; bears the cost of a flawed early asset compounding downstream, and of review being silently skipped.
- **Safeword Maintainer (SM)** — owns the gates; bears the cost of bloat and of low-signal gates training `--no-verify` bypass.

## Vocabulary

- **Review stamp** — a logged marker that a review ran for a given asset/phase (proof it happened, not a quality guarantee).
- **Phase exit** — the boundary where a ticket advances from one workflow phase to the next.

## Jobs To Be Done

### review-gate.DEV1 — catch a weak asset before downstream work is built on it

**Persona:** Technical Builder (TB)

> When I'm building a feature and the agent produces each artifact in turn (jobs → acceptance criteria → scenarios, and each TDD step), I want a quick review forced on each one before the next is authored, so a flawed foundation is caught early instead of after the whole chain has been poured on top of it.

#### review-gate.DEV1.AC1 — the next artifact can't be authored until the prior one is reviewed

Authoring artifact N+1 is denied (with a reason naming what's unreviewed) until artifact N carries a review stamp; a `skip: <reason>` stamp also clears it.

#### review-gate.DEV1.AC2 — the forced per-asset review is inline, no separate agent run

Satisfying the per-asset stamp spawns no fresh sub-agent — the review is the working agent's own inline pass, so it adds no per-asset spin-up cost.

### review-gate.DEV2 — guarantee an independent review actually ran at each phase

**Persona:** Technical Builder (TB)

> When the agent advances from one workflow phase to the next, I want proof that an independent review ran — not the author grading its own work, and not skipped — so review isn't silently dropped and I don't have to keep manually prompting for it.

#### review-gate.DEV2.AC1 — a phase can't advance until an independent review of it has run

Advancing past a phase boundary is denied until a logged independent-review stamp for that phase exists; a recorded skip clears it.

#### review-gate.DEV2.AC2 — the phase-exit review is independent, not the author

The phase-exit review is performed by a fresh reviewer with no conversation history (so it can't rubber-stamp its own work), and its verdict is what the stamp records.

### review-gate.SM1 — keep the enforcement high-signal and cheap

**Persona:** Safeword Maintainer (SM)

> When I maintain safeword's gates, I want the review enforcement to reuse the existing stamp/ledger machinery, fire only on genuine gaps, and offer a clear skip valve, so it doesn't bloat the hooks or train people to bypass it.

#### review-gate.SM1.AC1 — the coverage gate fires on genuine gaps and stays silent otherwise

> **Deferred to ticket ZRMDKD.** The coverage gate needs a hook-side `scenario-coverage` port + differential test, separable from the two-tier review mechanism this ticket delivers. Its scenarios here are skip-closed; ZRMDKD owns them.

Test-definitions with an uncovered acceptance criterion or an orphan scenario are blocked; complete, well-covered work passes with no prompt (bias-quiet, measured alert-to-action).

#### review-gate.SM1.AC2 — every block offers a one-step skip with a recorded reason

Each new gate (per-asset, phase-exit, coverage) can be cleared by an explicit `skip: <reason>` that is logged, so a maintainer is never hard-stuck and the override is auditable.
