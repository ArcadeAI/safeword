# Test Definitions: Tracker connect/onboarding flow (2TK5AD)

Feature source: `features/tracker-connect-flow.feature`

test-definitions.md is the R/G/R ledger. Given/When/Then live in the `.feature`
source; this file tracks per-scenario RED → GREEN → REFACTOR with commit SHAs.

Build-step SHAs (each scenario's GREEN cites the step that proved it):

- `a582747` — ports + per-provider handoff text (AC2 foundation)
- `17cffeb` — connect orchestration (AC2–AC7)
- `1d719f4` — connect command + #363 wiring test + live boundary shims
- `4375205` — setup offer delegating to the connect flow (AC1, AC8)

REFACTOR is marked where the step landed code in its reviewed final shape with
the scenario green (no separate churn pass was needed); the SHA is the commit
the green test shipped in.

## Rule: setup offers connect, opt-in and default no

### Scenario: Declining the setup offer leaves the project inert

- [x] RED — `4375205` (offer.test.ts: declining writes no config, seeds no sidecar)
- [x] GREEN — `4375205`
- [x] REFACTOR — `4375205`

### Scenario: Accepting the setup offer runs the same connect flow

- [x] RED — `4375205` (offer.test.ts: accepting runs real connectTracker; config + handoff + sidecar appear)
- [x] GREEN — `4375205`
- [x] REFACTOR — `4375205`

## Rule: connect writes non-secret config and prints the per-provider handoff

### Scenario: Connecting github writes config and prints the App/PAT handoff

- [x] RED — `a582747` (handoff.test.ts: github steps mention App/PAT), `17cffeb` (connect.test.ts: writes github config)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

### Scenario: Connecting linear writes config and prints the Arcade OAuth handoff

- [x] RED — `a582747` (handoff.test.ts: linear steps mention Arcade), `17cffeb` (connect.test.ts: writes linear config)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

### Scenario: Re-connecting a different provider leaves no stale provider

- [x] RED — `17cffeb` (connect.test.ts: re-connect linear over github preserves other keys)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

## Rule: secrets live outside the repo

### Scenario: The credential is stored in the keychain, never in config

- [x] RED — `17cffeb` (connect.test.ts: SENTINEL token to store, absent from config + logs)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

## Rule: verify before declaring the connection live

### Scenario: Verification passes and the connection is reported live

- [x] RED — `17cffeb` (connect.test.ts: verified connect reports live)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

### Scenario: Verification fails and names the missing piece

- [x] RED — `17cffeb` (connect.test.ts: it.each over missing-piece messages)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

## Rule: a successful connect seeds the empty sidecar

### Scenario: A verified connect seeds an empty tracker-map sidecar

- [x] RED — `17cffeb` (connect.test.ts: sidecar present with empty issues map)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

### Scenario: A failed verification does not seed the sidecar

- [x] RED — `17cffeb` (connect.test.ts: failed verify leaves no sidecar)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

## Rule: connect offers the pollution opt-ins

### Scenario: Accepting the pollution opt-ins writes both files

- [x] RED — `17cffeb` (connect.test.ts: accept writes .cursorindexingignore + .gitattributes marker)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

### Scenario: Declining the pollution opt-ins writes neither file

- [x] RED — `17cffeb` (connect.test.ts: decline writes neither file)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

## Rule: an unsupported provider is rejected cleanly

### Scenario: Connecting an unsupported provider performs no partial wiring

- [x] RED — `17cffeb` (connect.test.ts: asana rejected; no config/secret/sidecar)
- [x] GREEN — `17cffeb`
- [x] REFACTOR — `17cffeb`

## Wiring (the #363 lesson — entry points exercised against real collaborators)

- `connect-command.test.ts` (`1d719f4`) — `safeword connect github` builds real
  ports and drives `connectTracker` end-to-end (only `whoami` stubbed via
  `vi.hoisted`); proves the command seam isn't a fully-mocked tautology.
- `offer.test.ts` (`4375205`) — the setup offer runs the **real** `connectTracker`,
  asserting external file/log outcomes rather than "connect was called".
