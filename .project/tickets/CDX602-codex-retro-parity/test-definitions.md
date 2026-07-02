# Test Definitions: Codex retro parity — invisible local extraction and Lane-2 filing

Feature source: `packages/cli/features/codex-retro-parity.feature`

test-definitions.md is the R/G/R ledger.

## Rule: Stop extraction is synchronous and invisible

### Scenario: The Codex Stop hook runs child extraction with an inline digest

- [x] RED — `tests/hooks/retro-extract.test.ts` and
  `tests/integration/codex-stop-retro.test.ts` failed against the visible
  continuation adapter.
- [x] GREEN — `buildCodexExtractArgv`, `runCodexHeadlessExtraction`, and the
  Codex Stop subprocess test pass.
- [x] REFACTOR — Stop hook shares `retroChildArgs`/`decideRetroRun`; extractor
  helpers isolate Codex-specific argv/schema parsing.

### Scenario Outline: The Codex Stop hook fails open without a continuation

- [x] RED — old hook emitted `{}` or `{decision:"block"}` instead of empty stdout.
- [x] GREEN — malformed stdin, below-threshold, wrong-shape, unreadable
  transcript, non-zero child, and invalid child output stay silent.
- [x] REFACTOR — fail-open behavior is in the hook boundary and Codex extractor
  runner, with no user-facing output path.

### Scenario: A retro child Stop does not spawn another extraction

- [x] RED — old Codex Stop ignored `SAFEWORD_RETRO_CHILD`.
- [x] GREEN — integration test proves sentinel env suppresses child spawn.
- [x] REFACTOR — recursion guard reuses `decideRetroRun`/`isRetroChild`.

## Rule: Codex and Claude resolve different retro model defaults

### Scenario: Codex and Claude resolve their agent-specific defaults

- [x] RED — `DEFAULT_CODEX_RETRO_MODEL` and Codex model resolution were missing.
- [x] GREEN — resolver and `buildAutoExtractor(..., { agent: 'codex' })` default
  Codex to `gpt-5.5` while Claude remains `sonnet`.
- [x] REFACTOR — defaults are named per agent with `DEFAULT_RETRO_MODEL` kept as
  the Claude-compatible alias.

### Scenario: A configured retro model overrides both agent defaults

- [x] RED — override was only covered for the single Claude default.
- [x] GREEN — resolver and runner tests prove `retro.model` overrides Claude and
  Codex defaults.
- [x] REFACTOR — one `resolveRetroModel(project, agent)` function handles both.

## Rule: Codex uses the shared egress, spool, and filing path

### Scenario: Codex child findings are spooled and filed through the existing retro pipeline

- [x] RED — Codex adapter previously bypassed the out-of-band `safeword retro`
  path.
- [x] GREEN — Codex Stop forwards `retro --auto-extract` args; existing
  `tests/commands/retro.test.ts` proves auto-extracted findings pass egress and
  post-egress spool/file logic.
- [x] REFACTOR — `SAFEWORD_RETRO_AGENT=codex` switches only the extraction
  boundary; the retro command still owns egress/spool/triage.

### Scenario Outline: Unfiled Codex drafts remain spooled for the Lane-2 nudge

- [x] RED — Codex config lacked the UserPromptSubmit retro nudge.
- [x] GREEN — reconcile tests wire `prompt-retro-nudge.ts`; existing
  `tests/integration/prompt-retro-nudge.test.ts` covers one-nudge-per-batch
  behavior over spooled drafts.
- [x] REFACTOR — Lane 2 reuses `decideRetroNudge` unchanged.

### Scenario: Empty Codex child findings stay silent and create no filing work

- [x] RED — Codex structured output parser was absent.
- [x] GREEN — Codex extraction fail-open tests return `[]`; existing retro command
  behavior creates no drafts/issues from empty findings.
- [x] REFACTOR — parser accepts only schema object `{findings:[...]}`.

## Rule: UserPromptSubmit surfaces unfiled Codex drafts

### Scenario: The generated Codex config wires the prompt-retro-nudge hook

- [x] RED — template/schema config lacked `.safeword/hooks/prompt-retro-nudge.ts`.
- [x] GREEN — install and upgrade reconcile tests cover template and retrofit
  wiring.
- [x] REFACTOR — schema patch is exported for byte-accurate retrofit tests.

### Scenario: The Codex prompt nudge fires once per unfiled batch

- [x] RED — Codex had no prompt hook boundary for the existing nudge.
- [x] GREEN — Codex config now runs `prompt-retro-nudge.ts`; existing integration
  tests cover duplicate suppression and distinct batch nudge behavior.
- [x] REFACTOR — no fork of the nudge logic was added.

## Feature-level cross-scenario refactor

- [x] cross-scenario — templates and dogfood hook mirrors are byte-identical;
  Codex config template and dogfood config are synced.
