# Test Definitions: Keep native Safeword plugins current

Feature source: `packages/cli/features/keep-native-plugins-current.feature`

This is the RED / GREEN / REFACTOR implementation ledger. Scenario details live in the feature source.

Automated proof lives in:

- `tests/claude-plugin/profile-install.test.ts`
- `tests/commands/codex-bootstrap.test.ts`
- `tests/commands/migrate-codex-plugin.test.ts`
- `tests/codex-plugin/profile-lock.test.ts`
- `tests/codex-plugin/profile-proof.test.ts`
- `tests/codex-plugin/project-bootstrap.test.ts`
- `tests/claude-plugin-release.release.test.ts`

The Cucumber feature is `@manual`: native host refresh/cache behavior and an
actual public stable promotion remain release acceptance, while all
Safeword-owned decisions are automated in the files above.

## Builder rules

### Rule: keep-native-plugins-current.TBU1.R1 — Stable host lifecycle

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.TBU1.R2 — Explicit pins

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.TBU1.R3 — Host opt-out

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.TBU1.R4 — First legacy upgrade

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.TBU1.R5 — Later developer enrollment

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Non-technical builder rules

### Rule: keep-native-plugins-current.NTB1.R1 — No repeated installer

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.NTB1.R2 — Activation action

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.NTB1.R3 — Last-known-good protection

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.NTB1.R4 — Resumable channel recovery

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.NTB1.R5 — Automatic pre-plugin migration

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.NTB1.R6 — Startup readiness warning

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.NTB1.R7 — Warning never blocks

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.NTB1.R8 — Plain recovery message

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.NTB1.R9 — Failed enrollment warning

- [x] RED
- [x] GREEN
- [x] REFACTOR

## Maintainer rules

### Rule: keep-native-plugins-current.SWM1.R1 — Cross-host stable identity

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.SWM1.R2 — Publish before promotion

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.SWM1.R3 — Promotion failure safety

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.SWM1.R4 — Trusted declaration migration

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.SWM1.R5 — Unsafe declaration preservation

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.SWM1.R6 — Bootstrap-only compatibility

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.SWM1.R7 — Profile concurrency

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.SWM1.R8 — Profile-local evidence

- [x] RED
- [x] GREEN
- [x] REFACTOR

### Rule: keep-native-plugins-current.SWM1.R9 — Monotonic release promotion

- [x] RED
- [x] GREEN
- [x] REFACTOR
