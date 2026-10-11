# Bounded completion-evidence recovery

**Status:** planned

**Planned on:** 2026-10-11

## Approach

Implement separately on codex/4200-ledger-recovery, based on b722f9a27a1815abcfb08e6f6ca09dc7317efa46. The user approved current certification without invented historical RED and exclusion of exactly 33 deferred cases. Preserve CKWE2D and the original checked ledger rows. No merge, promotion, release or installed-cache override is authorized.

### Fixed authority and views

Compile one exact 5F5ZZA profile into the installed runtime: baseline commit, feature bytes, accepted authority fields, original checked history, sole erratum, and all 175 case identities partitioned into 142 active and 33 deferred with owners. The case census is input to reviewed constants, never caller-controlled authority. Compare complete feature bytes and exact case sets, not counts or headings alone. Producing commits must descend from the baseline; a rebase that removes that ancestry requires a separately reviewed re-pin before deployment.

Keep two computed views: historical validation applies only the precise REFACTOR 15a7c84aa erratum under “A declared change invalidates exactly its dependent reviews”; completion credits current-certified active cases while displaying missing historical steps and every deferred case as unverified. No original checkbox is rewritten. Reject simultaneous VERIFIED and recovery authority. Mixed outlines receive current-scope credit only when every active Examples row passes; deferred rows remain separately reported. The three DRD65E/KKP2R3 cases absent from the original ledger remain visible in the case-level report.

The unchecked cross-scenario row remains a normal prerequisite, not a recovery waiver. Complete actual whole-ticket quality review and an explicit refactor or documented skip through the ordinary workflow before freezing the authoritative ledger profile. Pin the resulting ledger and preserve every previously checked row; do not ship constants against an unresolved cross-scenario row. The initial 41 checked/137 unchecked census is historical input, not a claim that the final normal prerequisite is complete.

### Actual proof and freshness

Add one fixed installed observer for the existing root nondeferred Cucumber lane, without caller-selected commands or report input. Execute the frozen committed candidate in a disposable detached checkout with frozen-lockfile installation (--ignore-scripts) and the explicit committed build. Refuse dirty/untracked execution or product inputs, inherited code-loading overrides and unavailable input enumeration. Bind the producing revision, committed product-tree projection, resolved execution-input digests, exit status and complete report digest in an authenticated observation. The local user/key/dependency host remains trusted; this is not a claim of protection from that host.

Require exit 0, exactly the 142 active cases, no duplicates or unexpected cases, and every step passed. Deferred cases are not executed. Any missing case, hook/AfterAll failure, nonzero exit, pending/undefined/skipped step or mismatched report denies credit. Retain previous failure reports without replacing their outcomes. Use the existing real positive/rejection controls; do not require a new artificial mutation for every case or invent a generic multi-runner framework.

Gate freshness covers every tracked path except exact audit artifacts: V2ZPV1 ticket.md, investigation.md, impl-plan.md, test-definitions.md, case-census.json, ledger-reconciliation.json, recovery-manifest.json and evidence-summary.json; plus 5F5ZZA ticket.md and verify.md. A resolved execution input cannot be excluded. Separately pin the original ledger and accepted ticket authority fields (id, parent, parent_job, milestone, scope, out_of_scope, done_when). Require observed and current projected trees equal, clean current product/execution inputs, and every reviewed audit digest current. A product change or scope change inside an excluded ticket still denies credit.

Lifecycle: commit product/test sources, observe, write manifest/summary, certify, commit audit-only artifacts, close. Audit-only commits preserve the projected product identity; arbitrary new files do not. Signed observations and full reports live in runtime-owned unique paths under .safeword/state/reviews; the committed manifest/summary are the reviewable audit record. The gate recomputes the bounded summary from authenticated full report bytes, avoiding a 1.9 MB review target.

### Certification and authentication

Introduce the bounded ledger-recovery review kind in the existing coordinator. Its installed rubric requires actor-boundary fidelity, real rejection controls, source fidelity, no historical RED claim, the sole exact erratum and the exact unverified deferrals. Extend the existing structured review response for this kind with recovery_certification carrying the profile identity and explicit confirmations of those six requirements. Require cross-agent approval, fresh signed provenance and all confirmations; an ordinary quality-review approval or missing/false confirmation grants no authority. No mandatory invented findings: confirmations are certification metadata, findings remain actual findings.

Each bounded certification receipt targets the same manifest and summary, with the installed contract as a reviewed target whose bytes match the installed constant. Its additional context covers a slice of the resolved execution inputs. The union must cover cucumber.mjs, all loaded steps/support/world/hooks, package scripts, scripts/dev, mise.toml and the lockfile; every digest must match the observation and current source. Keep existing packet limits and require the reviewer to assess the cases that use its inputs, not merely file coverage.

Reuse the existing authenticated job reader, key infrastructure and durable-write helper. Add sibling ledgerRecoveryObservationTag/validLedgerRecoveryObservationTag functions with a distinct domain and mandatory kind=ledger-recovery-observation:v1, ticket and profile. Never sign these records with CKWE2D's retrospective-close domain. Retain original historical rows; reject changed bytes or automatic SHA rewriting.

### Build order and discriminating proof

1. Finish the case/ledger/step census and normal cross-scenario prerequisite; record and review this bounded trust exception in ARCHITECTURE.md before production implementation. Removal condition: completion of this exact recovery; no general migration of CKWE2D.
2. TDD the real CLI scope refusal, exact erratum, mixed Examples and same-count active/deferred swap rejection. Cover changed inherited tags, stale/wrong-kind/same-agent receipts, forged report without matching observation, false certification confirmations, dirty/untracked support, committed/uncommitted product changes, scope changes in audit paths, and two-way cross-protocol rejection. Prove commit → observe → audit-commit → certify → close.
3. Implement the minimal fixed observer, manifest validator and gate using existing coordinator/signing primitives. Add a public CLI wiring proof; expensive observation runs outside completion-hook deadlines.
4. Apply the two validated views in shared ledger/done checks, retaining historical rewrite guards and all ordinary dependency/test/verify/scope/whole-review prerequisites. Prove valid and denied CLI, Claude/Codex Stop and Cursor closing edits. Require an explicit supported-host discriminator: OpenCode uses the unchanged path, cloud remains deferred.
5. Document commands, missing historical proof, all 33 unverified exclusions and installed-use limits. Register any template helper in schema.ts, regenerate Codex plugin, Claude plugin, historical catalogue, Cursor wrappers and lifecycle fixtures through check-generated-surfaces.ts --fix; verify all five. Run scoped tests, final verification and independent source review. Create a separate Draft PR; do not merge/promote or overwrite the installed plugin cache.

## Decisions

Use one exact profile rather than arbitrary-ticket eligibility; append-only corrections rather than rewritten history; a distinct view rather than VERIFIED's blanket suppression; a typed certification review rather than a generic review whose context cannot instruct it. Add no dependency, signer or generic proof engine.

Implementation Inspiration: Microsoft's compensating-event principle informs preserving original history without adopting an event-sourcing platform: https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing . SLSA's subject/identity verification informs exact binding: https://slsa.dev/spec/v1.2/verifying-artifacts . Conceptual references only; no reused code.

## Design alignment

Structure enforces: authentic current proof precedes credit. Add, never replace: history stays visible. Fire at boundaries: observe once on the frozen candidate and check compact signed records at completion. Reuse existing coordinator, authenticated job records and shared local closing gates; isolate CKWE2D.

## Known deviations

The user explicitly approved current-scope completion with the exact deferred cases still unverified. No general waiver or deferred-host enforcement claim is added. The normal whole-ticket review and cross-scenario row stay required.

## Doc impact

Document the bounded workflow and case-by-case reconciliation in the CLI workflow documentation. State that OpenCode cannot use this recovery and cloud proof is deferred. No website or release version change in this source task.

## Assessment triggers

Riskiest assumption: the existing lane provides actor-facing current evidence for every active case; the census and authentic full-run report must establish this before credit. Missing primary proof, inability to cover loaded execution inputs, a non-clean product candidate or unresolved cross-scenario review stays open.

Freeze the feature, historical ledger and accepted scope before installing constants. Any code/proof-input change requires a fresh observation; any baseline/feature/history/scope re-pin requires fresh profile review. Track trusted deployment here after the Draft PR is ready. Installed 1.1.0 has no recovery observer; a source PR cannot grant installed authority. Explicit merge/release/installation approval remains separate.
