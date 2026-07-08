# Impl Plan: Artifact-content phase anchors (HGYGND)

**Status:** planned

## Approach

Swap the anchor value grammar and verification substrate in place, then migrate
the consumers outward, tree-only at every step:

1. **Substrate (phase-provenance.ts, templates + .safeword parity mirror).**
   Replace `isValidSha` in `validateAnchor` with the path grammar
   (repo-relative, non-empty, no `..`/absolute; hex-shaped 7-40 values branch
   to legacy handling first). Replace the `ShaResolver` seam on
   `detectUnanchoredPhaseTransition` with an injected `ArtifactReader`
   (`(relpath) => string | undefined`); verdict ladder: entry present →
   path-shaped → artifact readable → shape-valid for the entered phase's
   expected kind. `detectUnanchoredPhaseState` gains the same optional reader.
   The phase→artifact-kind map and per-kind shape dispatch live inside
   phase-provenance.ts (fold-in, no new parity pair; extract only if it grows —
   see Assessment triggers). Shape checks delegate to existing pure libs:
   `parseImplPlan` (impl-plan.md), `checkVerifyArtifact` (verify.md),
   frontmatter+JTBD presence via `jtbd.ts` (spec.md), non-empty with a
   `Scenario:` line (feature source), readable (test-definitions.md — deeper
   ledger validation stays the ledger check's job). Unit lane:
   `phase-anchor.test.ts` partitions re-expressed per dimensions.md.
2. **Boundary engine (src/boundary/engine.ts + commands/boundary.ts).** The
   anchor check takes the reader, not the resolver: commit tier reads staged
   content (`git show :<path>`), push tier reads `HEAD:<path>` — both tiers now
   verify anchors fully. `createLedgerShaResolver` injection remains for the
   ledger check only. Delete the anchor path's `UNREACHABLE_CAUSES` hedge.
   Command lane: squash-merge and shallow-clone fixtures that fail under SHA
   anchors and pass here; the anchors-tree/ledger-history split scenario.
3. **Advisory (src/health.ts).** `safeword check` injects a filesystem reader —
   the at-rest advisory upgrades from format-only to existence+shape; hex
   legacy anchors go silent (R4); message teaches the path grammar.
4. **Acceptance lane.** New `steps/artifact-content-phase-anchors.steps.ts`
   (predicate harness + temp-repo command scenarios); delete
   `features/evidence-anchored-phase-transitions.feature` + steps (superseded);
   re-express the three SHA-specific anchor scenarios in
   `features/boundary-reconciliation-gate.feature` (well-formed-absent-from-history,
   unreachable-with-hedge, rebase-canonicalization) for the path grammar, and
   update the entered-phase-only scenario's step to write a path anchor.
5. **Docs.** `ticket-system/SKILL.md` anchor line (all mirrors), glossary
   "Phase Anchor" entry, boundary command help text if it names SHAs.

Proof plan: unit tests (vitest, `packages/cli/tests/hooks/`) primary for the
predicate; command tests over temp git repos (`packages/cli/tests/commands/`)
for tiers/history-invariance; Cucumber acceptance over the new feature file.
Build order = the five slices above; commit per slice R/G/R per the ledger.

## Decisions

| Decision | Choice | Why | Evidence |
| --- | --- | --- | --- |
| Anchor value | Bare artifact relpath, no content hash | Boundary reads the final tree where honest evolution guarantees hash mismatch for 4/5 phases; a never-compared hash is decoration that invites a false-blocking equality check; shape predicates cover hollow files, hashes cannot | in-toto/SLSA: digest binds state-at-attestation, the verifier's policy decides comparisons [1]; warn-channel false positives drive alarm fatigue [2]; /figure-it-out 2026-07-08 in ticket.md |
| Verification seam | Injected `ArtifactReader`, predicates stay pure | Mirrors the proven `ShaResolver` injection pattern; keeps hook-lib purity (no fs in phase-provenance) | phase-provenance.ts:347-377 precedent |
| Kind map + shape dispatch | Fold into phase-provenance.ts | A new hook-lib file means a new schema parity pair + registration for ~80 lines; extract later if it grows | schema.ts pair registry cost |
| Legacy SHA anchors | Grandfather at rest; migrate-on-new-transition warning | Retroactive rewrites fabricate history (#909); at-rest re-validation violates "polices transitions, not history" | #810 friction register items 6-7 |
| Both boundary tiers verify anchors | Reader per tier (staged / HEAD tree) | Tree reads fit the commit tier's sub-second content-only budget — a strict upgrade over SHA format-only | CDRJTW tier budgets (its ticket.md D-notes) |

[1] https://slsa.dev/blog/2023/05/in-toto-and-slsa
[2] https://arxiv.org/pdf/2511.10323

## Arch alignment

Hook-lib purity preserved (reader injected, no I/O added to
phase-provenance.ts); reuse-not-duplicate (shape checks delegate to
parseImplPlan / checkVerifyArtifact / jtbd helpers — no new parsers);
templates↔.safeword byte parity maintained (pair at schema.ts, enforced by
pre-commit contracts); the ledger's ShaResolver contract untouched
(one-way dependency direction preserved: anchors no longer import it).

## Known deviations

- `features/boundary-reconciliation-gate.feature` + its steps belong to done
  ticket CDRJTW; this ticket edits its four anchor scenarios in place.
  Deliberate cross-ticket edit: those scenarios describe the anchor grammar
  this ticket replaces — leaving them green would pin the superseded behavior.
  Recorded here rather than reopening CDRJTW (the gate behavior they prove —
  warn-and-record at tiers — is unchanged).

## Assessment triggers

- Kind-map/shape dispatch exceeds ~100 lines inside phase-provenance.ts →
  extract an `anchor-artifacts.ts` hook lib (accepting the schema parity-pair
  registration cost).
- The configurable features dir makes the scenario-gate anchor's kind check
  unresolvable at check time → drop to existence-only for `.feature` paths and
  record the narrowing in the ledger.
- Boundary reader-per-tier plumbing duplicates >20 lines between commit and
  push paths → extract a shared reader factory in boundary.ts.
- Any need to consult git history in an anchor check → stop; that's the design
  failing its own R2 — re-open the design decision instead of patching.
