# Test Definitions: Retro re-arm timing (0XEMEE — Phase 0)

Feature source: `packages/cli/features/retro-rearm-timing.feature`
(Given/When/Then live there — not duplicated here. This file is the R/G/R ledger.)

<!-- Lineage: retro-rearm-timing.<TB|NTB>.AC<#>. Persona for every JTBD: Safeword
     Maintainer (SM). Prefixes are thematic scenario namespaces:
     TB1 = first-fire baseline (substantial fires + records count; trivial doesn't);
     TB2 = growth-gated re-fire (re-fire past threshold; hold below it; fuller
           transcript reaches extraction; back-half finding surfaced);
     TB3 = cross-fire dedupe via the occurrence ledger (no duplicate; new files);
     NTB1 = guards preserved (recursion guard first; fail-open on state-write;
            session-id keying).
     Scope: Phase 0 (TIMING) only. Tier (A), coverage (B), and the eval scorer (C)
     are later phases under this ticket, built after this slice and measured by the
     scorer. Unit layer: the re-arm decision + count-state helpers (injected deps,
     no model calls). Integration layer: fuller-transcript-reaches-extraction and
     ledger dedupe with the spawn + transport boundaries mocked. -->

## Rule: First substantial Stop fires and records the fire-count (TB1.AC1)

### Scenario: retro-rearm-timing.TB1.AC1.first_substantial_stop_fires_and_records_count

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: retro-rearm-timing.TB1.AC1.trivial_session_never_fires

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A later Stop re-fires only after enough growth (TB2.AC1)

### Scenario: retro-rearm-timing.TB2.AC1.refire_after_growth_threshold

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: retro-rearm-timing.TB2.AC1.hold_below_growth_threshold

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: retro-rearm-timing.TB2.AC2.refire_passes_current_transcript

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: A finding that only appears after the first fire is still surfaced (TB2.AC3)

### Scenario: retro-rearm-timing.TB2.AC3.back_half_finding_reaches_pipeline

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Re-fires never open duplicate issues (TB3.AC1)

### Scenario: retro-rearm-timing.TB3.AC1.already_filed_manifestation_not_refiled

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: retro-rearm-timing.TB3.AC1.new_manifestation_on_refire_is_filed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: Guards and fail-open behavior are preserved (NTB1.AC1)

### Scenario: retro-rearm-timing.NTB1.AC1.retro_child_never_fires

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: retro-rearm-timing.NTB1.AC1.state_write_failure_never_blocks_stop

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: retro-rearm-timing.NTB1.AC2.rearm_state_keyed_to_session_id

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
