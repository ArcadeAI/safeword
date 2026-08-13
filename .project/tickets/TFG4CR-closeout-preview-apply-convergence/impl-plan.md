# Impl Plan: Make closeout preview and apply converge for merge sessions

**Status:** planned
**Planned on:** 2026-08-11

## Approach

The riskiest assumption is that cleanup authorization can ignore retrospective progress hashes while a bounded post-seal delta still catches meaningful new work. The primary falsifying proof is the integration scenario where substantial post-preview activity produces a finding and blocks cleanup; the converging companion proves a harmless appended report can advance the receipt and apply the original digest when all exact Git targets remain clean.

Build order:

1. Extend the retrospective receipt gate first. Read the transcript once, choose the last complete newline-terminated JSONL record at or before observed EOF, and derive both offsets from that same immutable prefix: `byteLength` is its buffer length and `utf16Length` is `prefix.toString('utf8').length` for `String.prototype.slice`. The receipt digest covers exactly those `byteLength` bytes. An unchanged prefix is reusable; append-only growth validates that prefix, then closeout internally supplies the receipt-derived `utf16Length` to the existing public `retro --window-start` option. A partial tail remains outside the seal for the next invocation. Mutation, truncation, wrong provenance, missing evidence, pending filing, or failed delta retro remains blocking. Findings and acknowledgements persist before the receipt advances; a failed retro never advances it. Receipt replacement remains atomic and refuses to move an offset backward.
2. In the same atomic implementation change, define the digest projection so it authorizes immutable PR identity, repository state, blockers, and exact cleanup operations while excluding only the retrospective progress hash. Steps 1 and 2 must never land separately: step 1 alone stays safely non-convergent, while step 2 alone would be the unsafe split and must not ship. Unit proof checks digest stability for retro-only progress and continued invalidation for repository or target drift; integration proof covers harmless reporting and substantial post-preview work.
3. Keep the Codex environment identity fallback as the bootstrap/install/upgrade path and exercise it through the installed guard from linked worktrees without a pre-tool binding. Compare repository ownership using the canonical Git common directory so linked worktrees match while separate clones do not. Integration proof covers exact and ambiguous transcript resolution and a concrete recovery message.
4. Add the binding-derived absolute `retro.spoolPath` to blocked closeout output. Unit proof verifies it appears only with authenticated pending drafts.
5. Preserve #1942 by running the shipped validator/drain helper from a different active worktree and session against the exact named spool, proving acknowledgements precede drain and unrelated spools remain untouched.
6. Update the closeout skill text to describe append-only sealed-snapshot reuse and the executable bootstrap recovery path, then regenerate/sync installed artifacts through the normal Safeword reconciliation path.

Primary proof is integration/E2E at the installed guard and shipped helper boundaries; pure digest and receipt predicates retain focused unit tests for exhaustive edge cases.

## Decisions

### Implementation Inspiration

#### Implementation Unsuccessful Search

| Technical question | Decision informed | Constraints | Dependency versions | Source categories | Repositories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| How should mutable transcript progress be separated from destructive cleanup authorization? | Separate retrospective progress from cleanup authorization while retaining fresh prerequisite validation | No new dependency; exact Git compare-and-swap; host-authenticated transcript identity; Bun and Node filesystem APIs | Bun 1.3.14; Node built-ins | Existing architecture, merged fix history, issue reproductions | ArcadeAI/safeword | git history for #2374/#2380 and local closeout contracts | 2026-08-11 | ARCHITECTURE.md, commits 9a78f7fa0 and fab06c017, issues #2431/#1852/#1826/#1942 | No external implementation combines agent transcript seals, retrospective filing, and exact Git worktree cleanup | Separate retrospective progress from cleanup authorization while retaining fresh prerequisite validation |

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Separate retrospective progress from cleanup authorization while retaining fresh prerequisite validation | Hash a cleanup-authorization projection that omits only `retroStateHash`; require current bounded-delta retro completion before building an applicable plan | Freeze the entire transcript forever; automatically refresh the approved digest; skip retro re-observation on apply | Full freeze makes the preview report self-invalidating; automatic refresh changes what the user approved; skipping the prerequisite weakens safety |
| Reuse bounded retrospective evidence | Seal the last complete JSONL record from one read, validate that byte-exact prefix, and extract from its receipt-derived UTF-16 offset before advancing | Re-extract the whole transcript; ignore append-only growth; accept size-only growth; let closeout accept a caller-provided offset | Whole-transcript extraction recreates the loop; ignoring growth misses new work; size-only checks miss mutation; caller-provided closeout offsets bypass host provenance. The existing retro CLI offset remains public, but closeout never trusts an external value. |
| Bootstrap identity | Retain exact `CODEX_THREAD_ID` plus unique canonical transcript resolution as the supported current-task fallback | Guess newest transcript; require all users to start a new task | Guessing can bind another task; unconditional restart strands the task that installed the feature |
| Filing fallback | Expose only the binding-derived canonical spool path and keep acknowledgement-gated drain | Discover newest spool; accept a caller path; delete after tracker success without durable ack | Each alternative loses provenance or crash-safe filing proof |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Same-task closeout converges automatically; blocked bootstrap cases receive one executable recovery action | features/closeout-preview-apply-convergence.feature | |
| 1. Structure enforces; instructions suggest | Digest projection, receipt identity, exact-prefix validation, bounded-delta extraction, and acknowledgement-gated drain enforce the boundary in code | packages/cli/tests/closeout-cleanup.test.ts | |
| 2. Fire at boundaries, not every turn | Retrospective sealing occurs at preview/apply boundaries, not on every transcript append | packages/cli/templates/scripts/closeout-cleanup.ts | |
| 4. Contribute, then converge | Preview remains reportable and its approved cleanup converges despite that report | packages/cli/tests/integration/closeout-host-adapters.test.ts | |
| 5. Correct and safe; then clear; then simple | One projection and one bounded-delta receipt path preserve current compare-and-swap behavior without a parallel cleanup protocol | packages/cli/templates/scripts/closeout-cleanup.ts | |

Architecture proof: canonical edits remain under `packages/cli/templates/`, parity is enforced by `packages/cli/tests/closeout-cleanup.test.ts`, and private receipts plus durable acknowledgements remain in Git common state and `.safeword/retro-drafts` respectively.

## Known deviations

skip: no deviations planned

## Doc impact

- Update the canonical closeout skill under `packages/cli/templates/skills/closeout/SKILL.md`.
- Reconcile dogfood and generated host artifacts from the canonical template; do not edit installed copies first.

## Assessment triggers

- A host stops exposing a stable authenticated task/session identity.
- Transcripts cease being append-only files or are compacted in place during a task.
- Retrospective extraction requires semantic inclusion of post-preview assistant reporting.
- Cleanup authorization gains another mutable prerequisite that is not an exact Git target.
