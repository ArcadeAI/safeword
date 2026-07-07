# Spec: Artifact-content phase anchors (redesign of #809's SHA anchors)

Covers core cluster #813, #815, #814, #816 · epic #808. **ON HOLD** — see Status.

## Status: parked until #810 lands

User decision (alex, 2026-07-07): the #810 boundary gate is being built on another
branch against the current SHA-reachability anchors; hold this redesign until it
merges, then migrate the live gate to artifact-content anchors in one stroke.
Everything below is the completed intake research (audit + primitive direction),
recorded so resume costs nothing. Nothing here is implemented.

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

## Primitive direction (decided in principle; value semantics settled at resume)

**Anchor each phase to the content of the artifact it produces, verified in the
final tree at the #810 commit/push/PR boundary.** Not SHAs, not history.

- **Format (sketch):** keep the `phase_anchors:` block-sequence shape —
  `- <phase>: <relpath>@<hash>` — so `parsePhaseKeyedEntries` survives and only
  value validation changes. Reuse the established content-binding idiom
  (`hashArtifact` sha1/12-hex + `<artifact>@<hash>` scope keys,
  `review-ledger.ts:27-39`) instead of `isValidSha`.
- **Boundary verification (#810):** a single pass over the tree being shipped —
  for each phase the ticket claims to have traversed, its exit artifact exists
  (and satisfies the phase's cheap validity predicate, e.g. verify.md's PR-scope
  line). Pure tree read: no `createLedgerShaResolver`, no patch-id archaeology,
  works at `fetch-depth: 1`, invariant under amend/squash/rebase. Directly
  subsumes three checks #810 planned to fold separately: artifact precedence
  (#676), impl-plan-before-code (#666), verify-actually-ran (#725).
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

_Draft — to be converged at resume (intake is parked, not exited)._

### artifact-content-phase-anchors.SM1 — Phase evidence that survives normal git operations

**Persona:** Safeword Maintainer (SM)

> When a feature ticket's phases advance and the branch is later amended,
> rebased, squash-merged, or checked out shallowly, I want each phase's evidence
> to remain verifiable from the final tree alone, so the #810 boundary gate can
> hard-block forged state without false-blocking honest git hygiene.

Rules: authored at resume, informed by the shape #810 ships.

## Rave Moment

skip: table-stakes — evidence-substrate plumbing; the persona-facing moment
belongs to #810's boundary gate.

## Outcomes

_To finalize at resume; the direction:_

- A forward phase advance records `<relpath>@<hash>` for the phase entered;
  boundary verification is a pure read of the final tree.
- All six SHA-fragility issues (#902-#905, #911, #912) are dissolved with
  citations; #909 and #910 get explicit, tested semantics.
- The R/G/R ledger's per-tick SHA model is untouched.

## Open Questions

- Hash semantics at the boundary: existence + phase-validity only, or hash
  equality for frozen-at-exit artifacts (verify.md) with existence-only for
  evolving ones (spec.md, .feature, ledger)? Artifacts legitimately evolve after
  the advance (spec refined in define-behavior, ledger annotated through
  implement, impl-plan reconciled at implement exit), so blanket hash-equality
  in the final tree would false-block honest work — but hash-at-advance still
  gives at-rest drift advisories and advance-time attestation. Settle via
  /figure-it-out at resume, against whatever shape #810 shipped. defer: on hold
  until #810 lands.
- Machine-stamped anchors: E32M4P's PostToolUse observer already fires on
  exactly the policed edit and could hash the artifact itself — converting the
  anchor from self-asserted to control-plane-generated (the SLSA property
  RM84M8 cited). RM84M8 rejected only a self-asserted *channel string* stamp;
  machine-stamping the anchor value was never weighed. defer: same.
- Migration of existing SHA anchors (RM84M8, E32M4P, and other dogfood tickets
  carry `- <phase>: <sha>`): tolerate both grammars at rest, or one-shot
  rewrite? defer: same.
- #918's gitignored review-stamp log: give scenario-gate's independent-review
  evidence a committed home, or accept the "conclusion committed, evidence
  ephemeral" split as the tree-verification limit? defer: adjacent issue, not
  this ticket's scope decision.
