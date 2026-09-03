# Quality review — 2026-09-02

Scope: demand-research debiasing, lean Killer Demo, and deterministic lifecycle
fixtures in PR #3630. No production installer changes or version bump.

## Result

Independent Claude passes `28766aee-dd1c-482e-b87f-42e28d2e9d4c` and
`677a6886-cae8-4c84-90db-6b8fee35924b`: APPROVE, no errors, cross-agent independence.

- Currency/sources: current primary sources checked below.
- Correctness: package requests remain observable; unknown requests fail. Earlier
  omission mutation made all 12 lifecycle snapshots fail.
- Elegance/no-bloat: one test-local package fake, no general npm emulator; one
  Killer Demo sentence; no extra research deliverable or planning section.
- Wiring: no new production entry point. Existing real-install tests remain;
  lifecycle snapshots mock package operations and Claude/Codex profile installers.
  They prove orchestration, not actual plugin installation or package-manager parity.

## Applied findings

Scoped the execFileSync guard and test claim; framed hash tokens; prohibited fixture
regeneration in CI; documented fake and normalization limits; removed duplicate
tests and brittle line-wrap matching; bounded the finding-ID regex; fixed the JTBD
heading and persona code; removed blanket tool pre-approval; regenerated Claude,
Codex, and dogfood mirrors. All 25 focused tests passed in regeneration mode;
normal-mode verification is required separately. Root lint, Gherkin lint, typecheck,
and both generated-plugin checks passed after these changes.

## Second-pass dispositions

No further implementation changes recommended for this bounded fix:

- Raw symlink targets and dangling managed symlinks are pre-existing snapshot
  limitations; no managed symlink is introduced by this change. This is not proof
  of arbitrary future symlink behavior.
- Claude/Codex profile collaborators are stubs, as disclosed above. The fake
  deliberately models npm devDependencies, not bun/pnpm/yarn parity.
- Update-mode success is generation, not proof. CI refuses it; normal verification
  must run afterward. A skipped suite would also be easy to misread as green.
  Any nonempty CI value is conservatively treated as CI.
- Byte comparison applies to normalized snapshots: sorted JSON keys, omitted
  undefined values, and config JSON formatting are intentionally not covered.
  Markdown assertions prove instructions exist, not deterministic model compliance.
- Version 0.79.3 is intentionally older than current 0.83.1; hypothetical version
  rollback, direct execution outside the supported build-lock wrapper, and new
  hook timeout controls do not warrant extra machinery here.
- Full canonical tree dumps would expand this patch substantially. Retain compact
  digests; investigate mismatches with targeted diagnostics when needed.

## Behavioral walkthrough and limitations

Fed the shipped Claude demand-research text to a tool-disabled headless Claude
session with synthetic evidence: six positive interviews, eight of ten pilot teams
disabling report emails, three overload complaints, no purchase commitments, and a
sponsor asking to prove demand. Session `e0ff5cd8-dc91-4d57-b1f3-da19b7d23b65`
returned ABSENT as scoped, advised against the full build, contrasted stated
interest with abandonment, retained the cadence/channel alternative, and proposed
cheaper validation. It explicitly identified the evidence as synthetic.

The first normal-profile attempt returned no answer and a SessionEnd hook error
about an unlisted `.in_use` asset. The successful retry used Claude's documented
safe mode with no tools, so it verifies prompt behavior only, not installed hooks
or host integration. One sample does not establish a bias-elimination rate. Its
proposed experiment threshold is a suggestion, not customer evidence.

## Primary-source provenance

Fetched this session:

- [Vitest module mocks](https://vitest.dev/guide/mocking/modules.html): partial
  module mock/importOriginal pattern. Installed and latest checked: 4.1.11.
- [npm install](https://docs.npmjs.com/cli/v11/commands/npm-install/): registry
  resolution of unversioned requests explains the release-triggered fixture drift.
- [Vitest browser advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-g8mr-85jm-7xhm)
  and [UI advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp):
  installed 4.1.11 is beyond their patched versions; neither mode is introduced.
- [Claude skills](https://code.claude.com/docs/en/slash-commands) and
  [permission semantics](https://code.claude.com/docs/en/agent-sdk/permissions):
  allowed-tools affects approval, not a security sandbox. Removing `*` does not
  create read-only enforcement.
- [Hypothetical willingness-to-pay meta-analysis](https://link.springer.com/article/10.1007/s11747-019-00666-6):
  supports skepticism about stated purchase intent, not a universal ranking of
  evidence or a guarantee that this prompt removes sycophancy.

Next: complete normal-mode tests and current-head CI; admin merge only when green.

## CI follow-up

The full suite and both CI nodes found five failures after the initial review:
removed test names still appeared in the proof manifest, and a JTBD test still
expected the old heading. Restored distinct scenario checks without repeating their
assertions in the broad test, updated three renamed proof references, and corrected
the heading check. The proof-sharing ratchet remains unchanged. A final five-file
run passed 75 tests, including normal-mode lifecycle snapshots.

Review `59ca8a70-d413-4157-ad87-4614a058e6c4` requested changes for two existing
proof gaps exposed by the manifest review. Added a direct observable-outcome
guidance assertion and a real pre-tool phase-gate test with an ABSENT Product Bet.
The latter first proves the gate rejects missing review, then stamps the review
and proves the same ABSENT plan is allowed. This exercises the real hook boundary;
the host's subsequent file write is not a Safeword CLI operation.

Also anchored research exclusions to the skip-guidance body, tightened the JTBD
section bounds and exact confirmation instruction, and removed misleading
packaging/parity claims from the doc-presence test. Remaining warnings:

- Negative mode checks are intentionally lexical regression guards, not semantic
  proof against every possible synonym. No runtime mode parser is being added.
- Tool pre-approval absence is intentional, verified against permission docs above;
  the test is not a claim of a read-only sandbox.
- Distinct scenario tests remain for proof provenance. The small shared advisory
  assertion covers both absent demand and ambiguity; it is not runtime proof.
- Other unchanged mappings have narrower evidence than their scenario wording:
  no-second-artifact checks ticket prose; milestone selection checks a happy path;
  Killer Demo checks scaffolding; child isolation points to walkthrough prose even
  though ticket-writer separately tests delta-only output. These pre-existing mapping
  limitations are disclosed, not claimed as newly verified behavior in this patch.
- Manifest tuple shapes and unreferenced additional tests use existing conventions;
  no schema redesign or new planning ceremony is warranted for this fix.

## Killer Demo proof follow-up — 2026-09-03

The user authorized fixing the advisory's demo-quality proof gap. Four real
shared-coordinator reviews matched frozen expectations (accept concrete value;
reject placeholders, unchanged pain, unsupported claims). Inputs, limitations,
model alias and review IDs live in `experiments/killer-demo-eval/results.md`.
Semantic scenarios now live in the manual evaluation lane, not a false Vitest
mapping. Self-review links the existing intake standard in one additional bullet.

Review `a4dcb6d5-942c-47bb-9057-375fe88ca925` requested changes. Dispositions:

- **Milestone rejection proof:** confirmed the two existing mappings missed the
  creation boundary. Added built-CLI tests for missing and unknown milestones,
  asserting rejection, no child, and an unchanged parent; remapped both scenarios.
- **Evidence scope:** made the shared-reviewer-only limitation apply to all four
  ledger entries. The outline remains a requirement, not a claim of independently
  exercised host/owner combinations. Fixed ledger syntax to reference the actual
  evaluation checkpoint. Narrowed the eval cadence to the intake standard; it
  does not test the self-review invocation/stamp mechanism.
- **Easy fixtures:** retained deliberately obvious positive/negative smoke cases
  and narrowed the description. Supplied product facts are necessary to judge
  evidence; no expected labels are supplied. This is not subtle persuasion or
  generalization testing. A larger benchmark is outside this fix.
- **Lane wiring:** Gherkin lint and the proof-map suite pass after the split;
  `cucumber.mjs` excludes `@manual` from ordinary acceptance. Rule lineage stays
  attached to the existing ticket. No requirement or surface tag was deleted.
- **Older self-review stamp timing and relative commands:** unchanged Tier 1
  limitations, not new demo behavior. No gate hardening or unrelated command
  rewrite added. Repro command now includes the source build; results identify
  the installed 0.83.1 coordinator actually used.
- **Other old proof limitations:** retained the earlier disclosure rather than
  expanding this fix into a rewrite of all demand/parent-contract evaluations.

Merged main `258b1055e` and regenerated conflicting assets/snapshots rather than
choosing either side's hashes. Lifecycle result hashes are unchanged; installed
Codex/Cursor tree hashes reflect the merged template changes. Normal-mode
six-file verification passed 96 tests. No release or version bump.
