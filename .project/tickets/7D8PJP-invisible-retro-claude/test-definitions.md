# Test Definitions: Invisible retro — synchronous headless claude -p extraction (7D8PJP)

Feature source: `packages/cli/features/invisible-retro-claude.feature`
(Given/When/Then live there — not duplicated here. This file is the R/G/R ledger.)

<!-- Lineage: invisible-retro-claude.<JTBD>.AC<#>.<name>.
     TB1 = no conversation hijack (no additionalContext; out-of-band subprocess);
     TB2 = works in cloud (no --bare; synchronous; digest);
     NTB1 = no-leak (egress guard unchanged) + recursion guard;
     SM1 = agent-owned transport + once-per-session gate.
     Unit layer: digest builder, headless-argv builder, decideRetro action,
     recursion-guard predicate. Hook layer: stop-retro output + sentinel. Command
     layer: `safeword retro --auto-extract` with claude -p subprocess + GitHub
     transport boundaries mocked. -->

## Rule: The retro trigger never touches the user's conversation

### Scenario: invisible-retro-claude.TB1.AC1.stop_hook_emits_no_conversation_context

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: invisible-retro-claude.TB1.AC1.fail_open_stays_silent_when_extraction_errors

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: invisible-retro-claude.TB1.AC2.extraction_runs_as_an_out_of_band_subprocess

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: It authenticates and completes in a Claude cloud session

### Scenario: invisible-retro-claude.TB2.AC1.headless_argv_omits_bare_flag

- [x] RED 8224ade
- [x] GREEN 8224ade
- [x] REFACTOR skip: pure builder (buildExtractArgv); clean on first write

### Scenario: invisible-retro-claude.TB2.AC2.extraction_runs_synchronously

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: invisible-retro-claude.TB2.AC3.large_transcript_is_digested_before_extraction

- [x] RED 22a7e34
- [x] GREEN 22a7e34
- [x] REFACTOR skip: pure unit (buildDigest); clean on first write, cleanup folded into GREEN

## Rule: The egress guard is unchanged and still fails closed

### Scenario: invisible-retro-claude.NTB1.AC1.auto_extracted_findings_pass_the_egress_guard

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: invisible-retro-claude.NTB1.AC2.hook_early_returns_under_retro_child_sentinel

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Filing uses the environment's GitHub access, gated once per session

### Scenario: invisible-retro-claude.SM1.AC1.filing_succeeds_without_a_github_token

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: invisible-retro-claude.SM1.AC1.token_present_uses_the_rest_transport

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: invisible-retro-claude.SM1.AC2.extraction_fires_once_when_sentinel_unset

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: invisible-retro-claude.SM1.AC2.extraction_fires_at_most_once_per_session

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
