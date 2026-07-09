# Dimensions: artifact-content phase anchors (HGYGND)

Derived from spec.md SM1.R1-R5 + domain knowledge (shipped boundary tier split;
phase-provenance transition semantics; the canonical phase→artifact map).

| Dimension                        | Partitions                                                                                                                                                                                             | Rule    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| Anchor presence (entered phase)  | entry present; no `phase_anchors` key at all; key present but entered phase absent                                                                                                                      | R1 / R3 |
| Anchor value grammar             | repo-relative path; hex-shaped 7-40 chars (legacy); empty; `..`-traversal or absolute path (implausible)                                                                                                | R3 / R4 |
| Artifact ↔ phase agreement       | path resolves to the entered phase's expected artifact kind (spec.md / feature source / impl-plan.md / test-definitions.md / verify.md); mismatched kind (e.g. done anchored to README.md)              | R1 / R3 |
| Artifact existence               | anchored path present in the checked tree; absent                                                                                                                                                       | R2 / R3 |
| Artifact shape                   | shape-valid per kind (spec: parseable frontmatter+JTBD · feature: non-empty scenarios · impl-plan: parseImplPlan · ledger: present · verify: checkVerifyArtifact); shape-failing (hollow/scaffold file)  | R2 / R3 |
| Transition kind                  | forward one step; forward multi-step (entered-phase-only); backward; re-declaration; re-advance after backward (last-wins pinned)                                                                       | R1 / R3 |
| Ticket type                      | `feature` → policed; `task` / `patch` / `epic` / none → silent                                                                                                                                          | R3      |
| History state (verdict-invariant) | full clone; shallow clone (`depth: 1`); post-amend; post-squash-merge; post-rebase — identical verdicts across all                                                                                      | R2      |
| Boundary tier                    | commit tier verifies against the staged tree; push tier against the HEAD tree; neither consults history for anchors                                                                                     | R2      |
| At-rest                          | non-phase edit → silent; legacy hex anchor at rest → silent; new transition entering a phase whose anchor is hex-shaped → migrate-to-path remediation                                                   | R3 / R4 |
| Ledger isolation                 | ledger tick SHAs still resolve via the git resolver at push tier and the done gate — behavior byte-identical pre/post redesign                                                                          | R5      |

**Test layers:** R1-R4 core → **unit** (pure predicates with an injected
artifact reader, co-located with `phase-provenance.test.ts` /
`phase-anchor.test.ts`). Boundary tier + history-invariance + R5 → **command**
(temp git repos in the boundary suites, including one squash-merge and one
shallow-clone fixture that fail under SHA anchors and pass under path anchors).
Acceptance → the existing `evidence-anchored-phase-transitions.feature` and
boundary-gate feature files re-expressed for the path grammar.

**Baked decisions (from /figure-it-out + intake, recorded in ticket.md):**

- Bare path value — no content hash, no per-phase equality policy, no
  machine-stamping hook.
- Anchor basename must match the entered phase's expected artifact kind
  (feature source flexibly: any `.feature` path, `test-definitions.md`
  accepted as the legacy fallback).
- Hex-shaped values take the legacy branch before path validation.
- Reader seam (`path -> content | absent`) replaces the ShaResolver seam in
  anchor predicates; the ledger keeps ShaResolver untouched.
