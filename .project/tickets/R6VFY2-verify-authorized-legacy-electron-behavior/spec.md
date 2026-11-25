# Product Plan: Verify authorized legacy Electron behavior

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** Soulless PR 188 has green current checks but its 17 disclosed missing original failing-run histories cannot be closed by the existing CKWE2D-only retrospective path. The user explicitly approved a supported, independently reviewed exception rather than fabricated test history.
- **Expected outcome:** A Technical Builder can earn narrowly authorized present-behavior verification and close that historical ticket while its original evidence remains honest.
- **Persona outcome inventory:** Technical Builder needs clear permission boundaries, useful proof, refusal explanations and a valid closing route. Safeword Maintainer needs one trusted policy mechanism and unchanged legacy enforcement.
- **Known facts:** The current exception fixes ticket, cutoff, feature, ledger and Bun/Vitest execution. Existing signed review, row and close machinery already separates VERIFIED from original RED/GREEN/REFACTOR and replays current inputs.
- **Assumptions:** The installed host can run its existing Electron suite; failure to prepare or execute is a refusal, never a successful mutation.
- **Unresolved product decisions:** None. The user approved preserving missing history while requiring independent eligibility, current passing execution and discriminating mutation proof.
- **Success threshold:** All 17 explicitly authorized SGWMBS rows can receive separately authenticated verification and current-head closing proof; unauthorized rows, meaningless mutations and stale/foreign records remain blocked. Existing CKWE2D coverage remains green.
- **Project non-goals:** General enrollment, project-authored policy, arbitrary shell execution, fabricated RED, hook bypass, or a general-purpose test orchestration framework.
- **Reversibility:** Two-way for code: reverting disables the new scoped migration route. New SGWMBS records remain historical audit evidence, but the reverted runtime cannot verify them and must refuse fresh actions requiring their authorization. It does not rewrite recorded history or pretend those records belong to CKWE2D. Original histories remain unchanged and the pinned legacy policy retains its meaning.

## Jobs To Be Done

### legacy-electron.TBU1 — Close honestly verified legacy work

**Persona:** Technical Builder

> When approved legacy work lacks original test-first records, I want independently verified current behavior credited separately, so I can finish delivery without inventing its history.

#### legacy-electron.TBU1.R1 — Permission is specific and history stays honest

Only a trusted profile for the approved repository, ticket, fixed cutoff, ledger, feature and named scenarios is eligible. Project opt-in alone grants no authority. Historical eligibility and proof each require authenticated coordinator approval from a separate reviewing agent/process under the configured independence policy; author-provided JSON or claimed independence grants nothing. Original missing-RED annotations and original ledger entries stay intact; VERIFIED is separate.

#### legacy-electron.TBU1.R2 — Executable proof distinguishes behavior from broken setup

Each credited scenario has an exactly selected passing original and a uniquely anchored behavior-removal mutation failing at its declared assertion. The ticket author proposes the mutation and assertion; the independent proof reviewer must judge that they discriminate the named behavior rather than break setup. The supported Electron runner uses separate committed-source archives, frozen dependencies, real independent builds, private profiles and independently owned server ports. Setup/build/syntax failures, uncaught exceptions/crashes, timeouts, skipped or ambiguous selection and retry recovery do not qualify. An original that fails on a later required replay invalidates proof; no retry converts that failure into approval. Arbitrary author-supplied commands are not accepted.

#### legacy-electron.TBU1.R3 — Authorization cannot survive a changed meaning

Policy identity, repository/ticket/scenario, source, test, support/configuration/lock inputs and both authenticated review receipts are bound to verification. Changed or foreign inputs refuse reuse. Every new HEAD, including a commit containing only ticket, ledger or observation metadata, requires real original and mutant test execution again before fresh row authorization. There is no metadata-only execution exemption. An old observation retains its truthful original commit and is compared with the fresh executions. Independent review approval may remain valid only when its exact reviewed bytes are unchanged; it never replaces the new executions.

#### legacy-electron.TBU1.R4 — Closing checks every row at the current committed view

All required rows must be covered. Closing replays and refreshes row authorization against the final clean committed inputs and signs the aggregate view. A missing, forged or stale row blocks closure; a dirty tracked tree grants no closing proof.

### legacy-electron.SWM1 — Maintain one enforceable retrospective contract

**Persona:** Safeword Maintainer

> When a second reviewed migration needs a different runner, I want shared authorization and replay rules with a typed runner boundary, so supported installations remain consistent without weakening the first migration.

#### legacy-electron.SWM1.R1 — Existing enforcement and installed surfaces retain their contract

CKWE2D retains its fixed policy and supported receipts, and ordinary TDD remains unchanged. The public observation command and generated installed runtimes use the same trusted policy and runner; installed hooks continue to ask the trusted runtime rather than trusting project-authored approval JSON.

## Shape

### M1 — Scoped, replayable legacy Electron verification

- **Outcome:** One additional explicitly approved migration can proceed through real eligibility review, isolated proof observation, independent proof review, signed VERIFIED rows and final closing replay.
- **Non-goals:** General registration, alternate hook enforcement, runner plug-ins supplied by project configuration, or migration of legacy signed receipts.

## Killer Demo

> For a Technical Builder with an explicitly approved missing-history Electron scenario, current original/mutant execution and two independent reviews authorize one separate VERIFIED row; closing replay accepts the final committed view while the absent original RED stays visibly absent.

## Surfaces

Affected:

- OpenAI Codex
- Safeword CLI
- OpenCode — skip: the trusted CLI policy and existing generated-hook parity protect its unchanged transport; no OpenCode-specific interaction is introduced.
- Claude Code — skip: the CLI policy and row/close protocol are shared; existing installed-hook parity coverage protects the unchanged Claude transport, while the new host proof runs through the public CLI on Codex.
- Cursor — skip: shared installed-runtime gate and generated parity checks cover its unchanged transport; no Cursor-specific interaction is added.

Unaffected:

- Claude Code Cloud — this scoped Electron host migration requires a supported local desktop host; cloud actors retain existing rules.
