# Impl Plan: Retro accepts process-level friction surfaces and reports egress drops

**Status:** planned

## Approach

**Riskiest assumption:** a slug wall alone can be leak-proof — the surface field bypasses `sanitizeTextDeep`, so `resolveSurface`'s new namespace branch carries the entire egress guarantee. Proven cheapest by the SM1.R2 rejection outline + the two survivor scenarios (pure egress unit tests, slice 1). If the shape/entropy calibration can't separate `deadbeefcafe` from `dead-code-cleanup`, the design is wrong and fails on slice 1.

Proof plan + build order (all vitest; feature is `@manual` — the corpus convention):

1. **Slug wall** (`src/retro/egress.ts` — `resolveSurface` accepts `process/<slug>`): strict shape (lowercase alnum+hyphen, ≤32, non-empty), secret-shape rejection at ANY length on the whole hyphen-stripped slug and per segment (hex runs; entropy backstop for non-hex alphabets — no ≥20 floor). Primary proof: **unit** (`egress.test.ts`) — the 9 drop rows + 2 survivors. Load-bearing slice, build first.
2. **Drop accounting** (`src/retro/pipeline.ts` — `prepareEncounters` returns per-wall drop counts): primary proof **unit** (`pipeline.test.ts`) — schema-wall vs surface-wall attribution (SM1.R2's Then clause, SM1.R3's schema-wall rejection).
3. **Process label** (`src/retro/draft.ts` — `buildDraft` adds `process` when the surface is `process/…`): **unit** (`draft.test.ts`) — label present for process, absent for file surfaces.
4. **Summary reporting** (`src/commands/retro.ts` — counts flow `prepareEncounters` → `RetroOutcome` → `reportRetroCommandOutcome`, non-zero only): **integration** through `runRetro` + the output reporter — the SM2.R1 quartet, asserting the rendered summary line (never a hand-injected counts object, per the ledger note).
5. **End-to-end filing + guidance strings** (`templates/hooks/lib/retro-extract.ts` prompt + Codex schema description): the SM1.R1 e2e scenario through `runRetro` with extraction+transport mocked; the two R3 string-contract tests.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Secret-shape check | Whole hyphen-stripped slug AND per-segment hex/entropy, any length | Reuse `HIGH_ENTROPY_RUN` (≥20 floor) | Sub-20 hex slugs (`deadbeefcafe`) would clear the floor — the wall is the only egress guarantee on this field |
| Hex-word calibration | Pure-hex test on stripped/segment forms with digit-awareness + entropy, tuned so digit-free dictionary hex-words among non-hex segments survive | Reject any all-`[0-9a-f]` segment | Kills honest slugs (`dead-code-cleanup`) — the survivor scenario pins this |
| Drop-count plumbing | `prepareEncounters` returns `{ encounters, drops: { schema, surface } }` | Module-level counter; logging side-channel | Return value keeps the pipeline pure and the counts testable at every altitude |
| Overflow drops | Excluded from reporting | Third wall counter | `MAX_RAW_FINDINGS` (50) is an anti-abuse ceiling unreachable by legitimate sessions — documented waiver in dimensions.md |

## Arch alignment

- **Retro egress composition** (pipeline.ts header: ordered walls, code-assembled bodies) — the namespace is additive to the surface wall; no free-text field is added.
- **Deny-by-default egress posture** (#601, egress.ts) — the slug wall mirrors the documented accepted-residuals reasoning; UUID shapes structurally excluded by the ≤32 bound.
- **Graceful hooks** — drop reporting changes the summary line only; nothing new can block a Stop.

## Known deviations

skip: no deviations planned.

## Assessment triggers

- Extraction models start emitting `process/` surfaces for friction that HAS an honest file → revisit the prompt wording.
- The process-area taxonomy grows semantics (e.g. reconcile wanting to key on them) → revisit G19QG7's SM2.R4 skip together.
- Slug false-drop reports from real sessions → revisit the hex/entropy calibration with the survivor corpus.
