# Impl Plan: tracker connect/onboarding flow (2TK5AD)

**Status:** implemented

Steps 1–5 landed: `a582747` (ports + handoff), `17cffeb` (orchestration AC2–AC7),
`1d719f4` (command + wiring test + live boundary shims), `4375205` (setup offer
AC1/AC8). Build steps 3 and 5 merged — the command commit also carried the
`verify.ts`/`secret-store.ts` shims behind the injected ports.

## Approach

A new `packages/cli/src/tracker-connect/` module + a thin `commands/connect.ts`
wired in `cli.ts`, plus a one-line opt-in in `commands/setup.ts` that delegates to
the same flow (AC8 — one code path). Reuses JS5K5G's `tracker-sync` (config shape,
`TrackerMap` for seeding, secret env-var names).

**Per #363, the boundary is the only thing mocked.** The orchestration —
`connectTracker(deps)` — is pure over injected ports; tests drive the _real_
config-write / sidecar-seed / opt-in-file logic and mock only: the interactive
**prompt**, the **secret store** (keychain), and the per-provider **verify
client** (WhoAmI). A command-level **wiring test** runs the real `connect` command
in a temp cwd with those three boundary ports stubbed, asserting the external
end-state (config bytes, sidecar file, printed steps) — the test the prior feature
lacked.

| File                              | Owns (ACs)                                                                                                            | Test layer                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `tracker-connect/types.ts`        | `Prompt`, `SecretStore`, `VerifyClient` ports; `ConnectResult`                                                        | (types)                                 |
| `tracker-connect/handoff.ts`      | per-provider human-step text (Arcade OAuth / App / PAT) (AC2)                                                         | unit (pure)                             |
| `tracker-connect/index.ts`        | `connectTracker(deps)` orchestration: config write, secret route, verify, seed, opt-ins, reject-unsupported (AC1–AC7) | unit (real fs in tmpdir + mocked ports) |
| `tracker-connect/verify.ts`       | live verify clients: GitHub via `gh auth status`; Linear pending Arcade (actionable error)                            | (boundary shim, untested live)          |
| `tracker-connect/secret-store.ts` | keychain writer (OS tool) → env-var-export fallback                                                                   | (boundary shim, untested live)          |
| `commands/connect.ts`             | commander action → connectTracker with real ports                                                                     | unit **wiring** test (boundary mocked)  |
| `commands/setup.ts` (edit)        | opt-in prompt (default no) → delegates to connectTracker (AC8)                                                        | unit wiring (delegation observable)     |

Build order (each builds on green):

1. `types.ts` + `handoff.ts` — ports + pure per-provider step text (AC2 print).
2. `index.ts` `connectTracker` — config write (AC2), secret routing (AC3), verify dispatch + pass/fail messaging (AC4), sidecar seed-on-success (AC5), opt-in files (AC6), unsupported-reject with no partial wiring (AC7). All against real fs + mocked ports.
3. `commands/connect.ts` + `cli.ts` registration + the command **wiring test**.
4. `setup.ts` opt-in delegating to connectTracker (AC1 decline-inert, AC8 accept-delegates).
5. `verify.ts` + `secret-store.ts` live boundary shims (gh / keychain), behind the injected ports.

## Decisions

| Decision                 | Choice                                                                                   | Alternatives considered              | Rejected because                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Setup ↔ connect          | `setup` offers a yes/no (default no) that **delegates** to `connectTracker`              | inline a minimal connect in setup    | two code paths diverge (AC8); single orchestration keeps setup-connect == standalone-connect |
| Secret store             | injected `SecretStore` port; live impl = OS keychain tool → env-var-export fallback      | bundle a keychain npm lib (keytar)   | zero-runtime-dep ethos (mirrors gh-not-SDK in JS5K5G); env fallback always works             |
| Verify depth             | non-destructive WhoAmI/auth check (AC4)                                                  | dry-run a real one-ticket projection | a write during _connect_ risks a side effect; write-scope dry-run deferred (open-q resolved) |
| Linear live verify       | pending the Arcade integration → actionable error                                        | build the Arcade client now          | same deferral as JS5K5G's Linear writer; out of v1 (no Arcade SDK in repo)                   |
| Sidecar seeding location | reuse `tracker-sync`'s `TrackerMap().save()` to write empty `.safeword/tracker-map.json` | hand-write the JSON                  | one writer for the sidecar format keeps connect and sync in lockstep (JS5K5G AC9 contract)   |

## Arch alignment

Honors ARCHITECTURE.md: **CLI Structure** (`commands/` + lazy `import()` in `cli.ts`);
**Dependencies — minimize deps** (keychain via OS tool/env, no new runtime dep, as
gh was for JS5K5G); **off the per-turn loop** (connect is an explicit command, the
only network is the one verify call). Consumes JS5K5G's `tracker-sync` config +
sidecar contracts.

## Known deviations

skip: no deviations planned. The Linear live verify deferral mirrors JS5K5G's
documented Linear-client deferral (both pending the Arcade integration this ticket
otherwise sets up) — surfaced as an actionable error, not silent.

## Assessment triggers

- **Arcade SDK lands** — replace the Linear verify "pending" error with a real
  WhoAmI; the connect handoff for Linear becomes fully live.
- **Write-scope verification demanded** — promote AC4 from WhoAmI to a real
  one-ticket dry-run (needs a non-destructive write probe).
- **A real keychain dependency is justified** — if the OS-tool shim proves fragile
  across platforms, reconsider a maintained keychain lib.
- **Provider #3** — `handoff.ts` + the verify/secret ports are where a third
  provider's steps slot in.
