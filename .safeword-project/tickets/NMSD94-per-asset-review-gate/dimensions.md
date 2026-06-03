# Dimensions — NMSD94: two-tier review enforcement

Derived from the 6 ACs. Splits the same way ticket 153 did: **[hook]** = deterministic gate logic (unit-tested); **[agent]** = the review actually running (skill prose, live-verified).

## Behavioral dimensions

| Dimension                 | Partitions                                                          | AC            |
| ------------------------- | ------------------------------------------------------------------- | ------------- |
| Prior-asset review state  | stamped / unstamped / skip-stamped                                  | DEV1.AC1      |
| Asset position            | has a prior asset to gate on / is the first asset (nothing to gate) | DEV1.AC1      |
| Per-asset review actor    | working agent inline (no spawn) / would-be sub-agent (forbidden)    | DEV1.AC2      |
| Phase-exit stamp          | present / absent / skip-stamped                                     | DEV2.AC1      |
| Phase-review independence | fresh reviewer (no history) / author self-review                    | DEV2.AC2      |
| Coverage state            | complete / uncovered AC / orphan scenario                           | SM1.AC1       |
| Skip valve                | provided (with reason) / absent                                     | DEV1/DEV2/SM1 |

## Partitions → rules

- Prior-asset state × position → **Rule: per-asset stamp gates the next asset** (unstamped blocks; stamped/skip allows; first asset has nothing to gate)
- Per-asset review actor → **Rule: per-asset review is inline** (no sub-agent spawned)
- Phase-exit stamp × independence → **Rule: phase advance needs an independent review stamp**
- Coverage state → **Rule: coverage gate fires on genuine gaps, silent otherwise**
- Skip valve → **Rule: every new gate has a logged one-step skip** (cross-cutting)

## Baked decisions (resolve the intake open questions)

- **Inline stamp surface** (open question 1): a `<!-- review: <sha-or-skip> -->` style stamp line is rejected (invisible); use an explicit **review-ledger line** in the session skill-invocation-log keyed by asset id — same store Tier 2 uses, one mechanism. The PreToolUse gate reads the ledger, not the artifact.
- **Tier-1 worth-it** (open question 2): keep the cheap floor but make it **skippable and silent on first-asset** so it can't be the thing that trains bypass; the alert-to-action measurement (SM1) decides if it stays after a trial.

## Invariant

- `templates/hooks/` ↔ `.safeword/hooks/` byte-identical (`diff -q`).
