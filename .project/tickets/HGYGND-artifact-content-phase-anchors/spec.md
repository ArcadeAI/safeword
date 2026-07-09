# Spec: Artifact-content phase anchors (redesign of #809's SHA anchors)

Covers core cluster #813, #815, #814, #816 · epic #808. **ON HOLD** — see Status.

## Status: active (resumed 2026-07-08)

Parked 2026-07-07 while #810 was mid-build elsewhere; resumed on user
instruction after #810 slices 1-2 merged (#938: warn-only
`safeword boundary --at commit|push` + host-repo install). Slice 3 (server-side
hard-block) is still unbuilt — the primitive swap lands before it, so the
un-bypassable tier is built against artifact anchors and never ships
SHA-reachability semantics.

## Intent

Replace the `phase_anchors` commit-SHA-plus-reachability evidence primitive with
anchors tied to the content of the committed artifact each phase produces,
verified in the final tree at the #810 commit/push/PR boundary — durable
tamper-evidence that survives amend/squash/rebase/shallow-clone instead of
breaking under them.

## Intake Brief

- **Requested by:** alex (TheMostlyGreat) — design session on the
  phase-provenance evidence primitive, following the #810 friction register
  (8 items from #809's dogfooding).
- **Cost of inaction:** Five of the friction register's eight items are defects
  of SHA-as-anchor specifically: squash-merge orphans every anchor with no
  patch-id recovery (#903), `--amend` invalidates a just-recorded anchor (#904),
  the recording edit is always one commit behind the SHA it names (#902),
  shallow clones (CI `fetch-depth: 1`) read real anchors as unreachable (#911),
  and the format's rebase-hostility forces merge-only catch-up, which caused a
  live duplicate-merge push race (#912). Even when it works, a commitless
  multi-phase sitting anchors every phase to the same uninformative HEAD (#905)
  — presence + reachability ≠ evidence of the phase's work. Building #810's
  blocking enforcement on this datum ships a gate that false-blocks honest
  squash/amend/shallow workflows.
- **Reversibility:** Two-way door **shrinking**: today the anchor's only
  consumers are two pure predicates, one zero-exit `safeword check` advisory
  (#824), and a doc line — swapping the datum is at lifetime-minimum cost until
  #810 wires a git hook + CI required check to it. After #810 lands (the chosen
  sequencing), the migration also touches a live blocking gate and its
  consumer-repo install path — bigger, but done once, against a settled
  consumer.

## The decisive audit — five forward transitions × committed artifacts

Every phase's exit artifact is git-tracked in real usage (verified against this
repo's dogfood tree: 556 ticket.md / 112 spec.md / 88 dimensions.md /
115 test-definitions.md / 52 impl-plan.md / 188 verify.md all tracked; only
transient state is gitignored). **No gate phase lacks a committed artifact**, so
the pure artifact-content anchor needs no hybrid fallback, and the
/figure-it-out trigger for the primitive choice (a gate phase with no artifact)
did not fire.

| Transition | Exit artifact of the phase being left | Committed? | Existing enforcement |
| --- | --- | --- | --- |
| intake → define-behavior | `spec.md` (Intake Brief, JTBD, Rules) + `scope`/`out_of_scope`/`done_when` frontmatter | yes | spec/JTBD/criteria gates, `pre-tool-quality.ts:289-424` |
| define-behavior → scenario-gate | `features/<slug>.feature` + `test-definitions.md` skeleton + `dimensions.md` | yes | dimensions gate `pre-tool-quality.ts:343-365`; stop hook `stop-quality.ts:182-208` |
| scenario-gate → implement | `impl-plan.md` (authored at scenario-gate exit) | yes | hard-block at implement+ `stop-quality.ts:218-238` |
| implement → verify | R/G/R ledger ticks with per-tick SHAs in `test-definitions.md`; `impl-plan.md` Status → implemented | yes | tick-annotation write gate `pre-tool-quality.ts:587-611`; reconciliation `stop-quality.ts:242-247` |
| verify → done | `verify.md` (PR-scope + audit lines) | yes | done gate `stop-quality.ts:537-548`, `done-gate.ts:25-58` |

Caveat found by the audit: the scenario-gate's *independent-review* evidence
(the Tier 2 stamp) lands in `skill-invocations.log`, which is **gitignored** —
the gate's conclusion (impl-plan.md) is committed, its evidence is not. That
is #918's surface and stays a known limit of any tree-verified scheme until
stamps get a committed home (out of scope here; see Open Questions).

## Primitive: the settled semantics (/figure-it-out, 2026-07-08)

**Anchor value = the repo-relative path of the exit artifact of the phase being
left; the boundary verifies that artifact exists in the tree being shipped and
passes its existing shape predicate.** Not SHAs, not history, not content
hashes.

- **Format:** the `phase_anchors:` block-sequence shape survives —
  `- <phase-entered>: <repo-relative-path>` (e.g.
  `- implement: .project/tickets/HGYGND-x/impl-plan.md`). Only value validation
  changes: a path (non-empty, repo-relative, no `..`) replaces `isValidSha`.
  `parsePhaseKeyedEntries`, entered-phase-only, append-per-advance, and
  last-wins-on-re-advance all carry over.
- **Canonical per-phase artifact** (phase entered ← exit artifact of phase
  left): define-behavior ← `spec.md` · scenario-gate ← the feature source
  (`features/<slug>.feature` or configured path) · implement ← `impl-plan.md` ·
  verify ← `test-definitions.md` (the R/G/R ledger) · done ← `verify.md`. The
  explicit path (rather than a derived map) pins per-ticket ambiguity —
  configurable features dir, legacy AC-path tickets — and keeps the traversal
  trail the shipped birth check already reads (`engine.ts:198`).
- **Boundary verification (#810):** for the entered phase of a transition in
  the change — the anchored artifact exists in the shipped tree and passes the
  artifact's existing shape predicate (`parseImplPlan`, `checkVerifyArtifact`,
  `validateLedger`-presence, spec JTBD check — all shipped pure libs). Pure
  tree read: no `createLedgerShaResolver`, no patch-id archaeology, works at
  `fetch-depth: 1`, invariant under amend/squash/rebase — and fully checkable
  at the **commit tier** (staged tree, sub-second), a strict upgrade over SHA
  anchors' format-only commit tier. Subsumes three checks #810 planned to fold
  separately: artifact precedence (#676), impl-plan-before-code (#666),
  verify-actually-ran (#725).
- **No content hash in the value** (rejected `<relpath>@<hash>`): the boundary
  verifies the final tree, where honest evolution (spec refined in
  define-behavior, ledger annotated through implement, impl-plan reconciled at
  implement exit) guarantees hash mismatch for 4 of 5 phases — so an embedded
  hash is either never compared (decoration inviting a future false-blocking
  equality check) or compared and false-warning (alarm-fatigue evidence: false
  positives are why developers ignore warn channels). Anti-hollow-file coverage
  comes from the shape predicates, which a hash cannot provide (a hash of an
  empty file is a valid hash). In-toto/SLSA back this split: a digest binds
  state-at-attestation-time; what the verifier compares is the policy's call —
  and this policy has nothing meaningful to compare a hash against.
- **No machine-stamping hook** (rejected extending E32M4P's PostToolUse
  observer to write anchors): with no hash to compute, hand-authoring a path
  via the Edit channel is trivial and mirrors `phase_skips`; a stamping hook
  adds a write surface with the documented Write-tool blindness and no added
  trust — the value is self-reported either way.
- **Legacy SHA anchors** (`/^[0-9a-f]{7,40}$/i`-shaped values on existing
  tickets): grandfathered — at-rest silence, never re-validated; a *new*
  transition carrying a hex-shaped anchor gets a remediation-forward warning
  naming the exact path-shaped line to write instead.
- **Threat model:** durable tamper-evidence, not unforgeability — #905 proved
  the SHA is satisfiable by reflexively writing HEAD; a content hash is equally
  satisfiable by hashing the file. The gain is that the *artifact itself* must
  exist in the shipped tree, so a forger must fabricate reviewable files that
  appear in the PR diff — the human-visible record — rather than an opaque hex
  string.
- **Keep:** the R/G/R ledger's per-tick commit SHA for implement
  (`ledger-validation.ts` / `ledger-git.ts` / done gate at `stop-quality.ts:603`)
  — untouched; the dependency is strictly one-way (anchors borrow `isValidSha` +
  the `ShaResolver` type; the ledger imports nothing from phase-provenance).
- **Blast radius at resume** (from the code audit): the anchor half of
  `phase-provenance.ts` (`parseAnchors`, `validateAnchor`,
  `detectUnanchoredPhaseTransition`, `detectUnanchoredPhaseState`, the
  `ShaResolver` import), `health.ts:343-349` advisory + message, docs
  (`ticket-system/SKILL.md:95` ×3 mirrors, `glossary.md:138`), tests
  (`phase-anchor.test.ts`, `check.test.ts:1143+`,
  `features/evidence-anchored-phase-transitions.feature` + steps), parity mirror
  `.safeword/hooks/lib/phase-provenance.ts` — plus, post-hold, whatever #810
  ships.

## Issue-cluster resolution (to execute at resume)

Dissolved outright by the redesign (all are SHA-as-anchor defects): **#902**
(off-by-one — content names bytes, not history position), **#903** (squash —
tree content survives byte-identically), **#904** (amend — same), **#905**
(same-SHA-for-all-phases — each phase anchors to its own distinct artifact),
**#911** (shallow clones — verification reads only the checked-out tree),
**#912** (rebase-hostility and the merge-only race — anchors become
rebase-invariant).

Semantics to redefine (not auto-dissolved):

- **#909** legacy tickets: under content anchors, retroactive anchoring becomes
  *honest* — the anchor asserts "this artifact with this content is in the tree"
  (a present fact), not "this transition happened at commit X" (an unverifiable
  past event). Legacy tickets can be anchored by hashing what exists; the #824
  advisory's remediation stops demanding fabricated evidence. Keep at-rest
  tolerance; never escalate legacy advisories to blocks.
- **#910** re-advance duplicates: last-wins becomes the *correct* semantic, not
  an accident — re-doing a phase legitimately replaces its artifact, so the
  latest anchor describes the current output. Document explicitly + pin with a
  test at resume.

## Handoff notes for the in-flight #810 branch (datum-independent)

Whichever anchor datum #810 ships against, the friction register demands:

1. Validate only the anchor of the phase being **entered**; never re-validate
   prior entries (or squash-merge shops get bricked — register item 1).
2. The server-side required check must fetch full history (`fetch-depth: 0`)
   under the SHA scheme, or every fresh-container run false-blocks (item 3).
3. Tolerate several phases sharing one HEAD SHA — phases are not commit-bearing
   (RM84M8 caveat, ticket.md:58).
4. Duplicate phase keys are silently last-wins in the parser — needs one doc
   line + one pinning test (item 4, #910).
5. Never escalate at-rest legacy advisories into blocks (item 6, #909).
6. Remediation messages must name the exact line to add — the honest human
   hand-editing `phase:` is otherwise indistinguishable from a forger (item 7).

## References

- Epic #808 (constraint envelope: boundary validation, cheap-to-attest, no
  net-new procedural gates) · #810 + its 2026-07-06 friction-register comment
  (the decisive design record) · #809/RM84M8 (shipped SHA substrate; its design
  decision weighed channel stamps, signed commits, write-time denial — no
  artifact-content option was ever considered) · #824 (advisory bridge, only
  live consumer) · core cluster #813 #815 #814 #816 · dissolve set #902-#905
  #911 #912 · semantics #909 #910 · adjacent #918 (untracked verify stamp) ·
  E32M4P/#772 (PostToolUse work-log stamp — precedent for control-plane-authored
  transition evidence).
- Out of scope per the design session: retro-pipeline issues #834 #791 #587
  #667.

## Personas

- Safeword Maintainer (SM) — builds and extends safeword's gates; needs
  enforcement state that is trustworthy, durable under normal git operations,
  and verifiable at the deliverable boundary.

## Surfaces

Affected:

- skip: none — the anchor lives in ticket.md frontmatter and pure hook-lib logic
  identical across agent runtimes; boundary verification is git-native
  (#810's hook/CI), not harness-specific.

Unaffected:

- Claude Code / Cursor / OpenAI Codex and cloud variants — same rationale as
  RM84M8: a frontmatter field + pure predicates read identically everywhere.

## Vocabulary

- **Artifact-content anchor** — a `phase_anchors` entry tying an entered phase
  to the exit artifact of the phase being left, as `<relpath>@<content-hash>`;
  verified against the final tree, never against git history.
- **Final-tree verification** — checking anchors in the tree being
  committed/pushed/PR'd, requiring no history and therefore surviving
  amend/squash/rebase/shallow-clone.

## Jobs To Be Done

### artifact-content-phase-anchors.SM1 — Phase evidence that survives normal git operations

**Persona:** Safeword Maintainer (SM)

> When a feature ticket's phases advance and the branch is later amended,
> rebased, squash-merged, or checked out shallowly, I want each phase's evidence
> to remain verifiable from the final tree alone, so the #810 boundary gate can
> police forged state without false-blocking honest git hygiene.

#### artifact-content-phase-anchors.SM1.R1 — A forward advance anchors the entered phase to the exit artifact of the phase being left

The anchor value is that artifact's repo-relative path; only the entered phase
is demanded on a multi-step advance (skipped phases stay `phase_skips`
territory), and re-advancing a phase replaces its anchor meaning (last-wins is
the documented, correct semantic — the latest artifact is the phase's output).

#### artifact-content-phase-anchors.SM1.R2 — An anchored advance verifies from the tree alone, under any history

A transition whose anchored artifact exists in the tree (and passes the
artifact's shape predicate) is anchored — identically in a full clone, a
shallow clone, after amend, rebase, or squash-merge. No check consults git
history for phase anchors.

#### artifact-content-phase-anchors.SM1.R3 — A forward advance without a real artifact behind it is detectable as unanchored

Missing anchor entry for the entered phase, a value that is not a plausible
repo-relative path, a path absent from the tree, or an artifact failing its
shape predicate — each is programmatically detectable, with a remediation
message naming the exact line to write. Detection fires only on the policed
act (a feature ticket's forward advance); backward moves, re-declarations,
non-feature tickets, and tickets at rest stay silent.

#### artifact-content-phase-anchors.SM1.R4 — Legacy SHA anchors neither warn at rest nor block new work

A hex-shaped (7-40 char) anchor value on an existing ticket is grandfathered:
at-rest checks stay silent on it, and only a new forward transition carrying a
hex-shaped anchor for its entered phase draws the migrate-to-path remediation.

#### artifact-content-phase-anchors.SM1.R5 — The R/G/R ledger's per-tick commit SHAs are untouched

`test-definitions.md` tick annotations keep their SHA grammar, reachability
resolution, and done-gate validation exactly as shipped — the redesign removes
the phase-anchor dependency on git history, not the ledger's.

## Rave Moment

skip: table-stakes — evidence-substrate plumbing; the persona-facing moment
belongs to #810's boundary gate.

## Outcomes

- A feature ticket's forward advance records
  `- <phase-entered>: <repo-relative-artifact-path>`; detection and boundary
  verification are pure reads of the tree — no git history anywhere in the
  phase-anchor path.
- The boundary gate's anchor check upgrades at the commit tier from
  format-only to full verification (artifact exists in the staged tree +
  shape), and the push tier's anchor check drops its resolver dependency —
  `createLedgerShaResolver` remains ledger-only.
- All six SHA-fragility issues dissolve with citations: #902 (off-by-one),
  #903 (squash), #904 (amend), #905 (shared HEAD), #911 (shallow clone),
  #912 (rebase-hostility); #909 and #910 get explicit, tested semantics
  (honest backfill; documented last-wins).
- Existing SHA-anchored tickets stay quiet at rest; docs (ticket-system skill,
  glossary) and the `safeword check` advisory teach the path grammar.
- The R/G/R ledger's per-tick SHA model is untouched.

## Open Questions

_None — hash semantics, machine-stamping, and legacy migration were settled by
the 2026-07-08 /figure-it-out (recorded in the Primitive section and ticket.md
Design Decision). #918's gitignored review-stamp log: defer — adjacent issue
about where review evidence lives, not this ticket's anchor-value decision._
