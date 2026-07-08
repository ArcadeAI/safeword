---
id: HGYGND
slug: artifact-content-phase-anchors
type: feature
phase: done
status: done
phase_anchors:
  - define-behavior: .project/tickets/HGYGND-artifact-content-phase-anchors/spec.md
  - scenario-gate: features/artifact-content-phase-anchors.feature
  - implement: .project/tickets/HGYGND-artifact-content-phase-anchors/impl-plan.md
  - verify: .project/tickets/HGYGND-artifact-content-phase-anchors/test-definitions.md
  - done: .project/tickets/HGYGND-artifact-content-phase-anchors/verify.md
epic: "808"
external_issue: https://github.com/ArcadeAI/safeword/issues/815
scope:
  - "Anchor grammar swap in phase-provenance.ts: value = repo-relative path of the exited phase's exit artifact (`- <phase-entered>: <path>`), replacing isValidSha; parsePhaseKeyedEntries, entered-phase-only, append-per-advance semantics unchanged; last-wins on re-advance documented + pinned by test."
  - "Detection predicates redefined tree-only: detectUnanchoredPhaseTransition drops the ShaResolver seam for an injected artifact reader (path -> content | absent); verdict ladder = entry present -> path-shaped -> artifact present -> shape-valid. detectUnanchoredPhaseState gains the same reader seam (at-rest checks stay format-only without a reader)."
  - "Shape verification reuses shipped pure libs, never duplicates: parseImplPlan (impl-plan.md), checkVerifyArtifact (verify.md), ledger presence for test-definitions.md, frontmatter-parse + JTBD presence for spec.md, non-empty for the feature source."
  - "Boundary engine migration (src/boundary/engine.ts + commands/boundary.ts): anchor check runs fully at BOTH tiers via the artifact reader (staged tree at commit, HEAD tree at push); resolver injection stays for the ledger check only; UNREACHABLE_CAUSES shallow-clone hedge deleted from the anchor path."
  - "Legacy tolerance: hex-shaped (7-40 char) anchor values are grandfathered — silent at rest and in birth/traversal checks; a new forward transition entering a phase with a hex-shaped anchor warns with the exact path-shaped line to write instead."
  - "Consumer-surface updates: health.ts advisory text teaches the path grammar; ticket-system SKILL.md anchor doc + glossary Phase Anchor entry rewritten; templates<->.safeword parity green."
  - "Tests migrated, not grown ad hoc: phase-anchor.test.ts partitions re-expressed for the path grammar; check.test.ts advisory fixtures; boundary suites' anchor scenarios (forged/unreachable/rebase-canonicalization replaced by absent-artifact/hollow-artifact/legacy-hex); evidence-anchored-phase-transitions.feature + steps updated; dogfood: this ticket's own advances carry path anchors."
out_of_scope:
  - "#810 slice 3 (server-side required check / hard-block tiering) — builds later against this substrate; nothing here adds a blocking path (warn-and-record exit-0 stays absolute)."
  - "R/G/R ledger changes of any kind — per-tick SHA grammar, createLedgerShaResolver, validateLedger, done-gate wiring all untouched (SM1.R5)."
  - "Rewriting existing tickets' SHA anchors — grandfathered at rest; a one-shot rewrite would fabricate history (the #909 sin)."
  - "Committed review-stamp home for scenario-gate evidence (#918) — adjacent issue; the anchor points at the phase's committed conclusion (impl-plan.md), not the review log."
  - "Anchor content hashes or per-phase hash-equality policies — rejected in /figure-it-out (final-tree evolution guarantees false positives; shape predicates cover hollow files)."
  - "Machine-stamping anchors via E32M4P's PostToolUse hook — rejected (no hash to compute; Edit-channel hand-authoring mirrors phase_skips; Write-tool blindness)."
  - "Closing the dissolved issues (#902-#905, #911, #912) — done as PR follow-through with per-issue citations, not code in this ticket."
done_when:
  - "detectUnanchoredPhaseTransition/State validate path-grammar anchors tree-only: anchored passes; missing entry, non-path value, absent artifact, and shape-failing artifact each unanchored with the exact remediation line; backward/re-declare/non-feature/at-rest silent; legacy hex silent at rest, warned with migration text on new transitions (unit-tested)."
  - "safeword boundary --at commit fully verifies the entered phase's anchor against the staged tree (no resolver); --at push verifies against HEAD tree; ledger checks still resolve SHAs via createLedgerShaResolver (command-tested in temp git repos, incl. a squash-merge and a shallow-clone scenario passing where SHA anchors failed)."
  - "safeword check advisory nudges the path grammar; last-wins re-advance semantics pinned by test; docs (SKILL.md x3 mirrors via parity, glossary) teach the new grammar."
  - "All prior anchor test partitions have path-grammar equivalents; full /verify + /audit pass; verify.md written; parity green."
created: 2026-07-07T05:10:18.049Z
last_modified: 2026-07-07T05:10:18.049Z
---

# Artifact-content phase anchors (redesign of #809's SHA anchors)

**Goal:** Anchor each phase to the committed artifact it produces, verified in the final tree at the #810 boundary — replacing commit-SHA reachability

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Design Decision — anchor-value semantics (/figure-it-out, 2026-07-08)

**Chosen: bare artifact path, tree-verified.** `- <phase-entered>:
<repo-relative-path>` of the exited phase's exit artifact; detection and the
boundary verify existence + the artifact's existing shape predicate against the
tree being shipped. Rationale and evidence in spec.md "Primitive".

- **Rejected — `<relpath>@<contentHash>`:** the boundary reads the final tree,
  where honest evolution guarantees mismatch for 4 of 5 phases — the hash is
  either decoration (inviting a future false-blocking equality check) or a
  guaranteed-false-positive drift warning (alarm-fatigue research: false
  positives are why warn channels get ignored). Shape predicates cover hollow
  files; a hash can't (an empty file hashes fine).
- **Rejected — per-phase hash-equality policy (frozen vs evolving):** most
  complexity for the narrowest threat (post-done verify.md tampering, already
  covered by done-gate shape checks + PR review).
- **Rejected — valueless anchors (derived artifact map):** the explicit path
  pins per-ticket ambiguity (configurable features dir, legacy AC-path
  tickets) and keeps the traversal trail the shipped birth check reads
  (engine.ts:198); typing a path costs nothing.
- **Rejected — machine-stamping via E32M4P's hook:** no hash to compute, so
  hand-authoring via the Edit channel (mirroring phase_skips) is trivial; a
  stamping hook adds a write surface with documented Write-tool blindness and
  no added trust.

**Caveat carried forward from #809:** phases are not commit-bearing — the
entered-phase-only demand and commitless multi-phase sittings stay tolerated;
under path anchors distinct phases now carry distinct evidence anyway.

## Work Log

- 2026-07-07T05:10:18.049Z Started: Created ticket HGYGND
- 2026-07-07T05:12:00.000Z Intake research complete: 8-agent audit (17-issue cluster #808/#809/#810/#813-816/#824/#902-905/#909-912/#918 + phase→artifact map + boundary-gate inventory + ledger mechanics + RM84M8 prior art). All five forward transitions map to committed tree artifacts — pure artifact-content anchor viable, no hybrid needed. Findings in spec.md.
- 2026-07-07T05:12:00.000Z BLOCKED on #810: user decision — #810's boundary gate is being built on another branch against SHA-reachability anchors; hold this redesign until it merges, then migrate the live gate. Resume at intake with spec.md's Open Questions (/figure-it-out on hash semantics).
- 2026-07-08T02:13:55.616Z Phase: intake → define-behavior
- 2026-07-08T02:16:06.514Z Phase: define-behavior → scenario-gate
- 2026-07-08T02:29:33.085Z Phase: scenario-gate → implement
- 2026-07-08T03:11:15.675Z Phase: implement → verify
- 2026-07-08T03:34:50.398Z Phase: verify → done
