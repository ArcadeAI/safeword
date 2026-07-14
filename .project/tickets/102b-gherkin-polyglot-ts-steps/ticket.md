---
id: '102b'
slug: gherkin-polyglot-ts-steps
title: 'Scaffold the cucumber-js acceptance lane as core safeword setup (TS + non-TS)'
type: feature
status: done
phase: done
priority: high
parent: '102'
epic: bdd-phase-one-merge
depends_on: 102a
scope:
  - '`safeword setup` scaffolds the cucumber-js acceptance lane as standard output (BDD is core, not opt-in): cucumber.mjs, a steps/ scaffold (world + shared shell-out steps + barrel), a features/ dir with a runnable starter, the @cucumber/cucumber + tsx devDeps, and a test:bdd script'
  - 'File ownership split (per the scenario-gate review): `cucumber.mjs` is a safeword-owned template (overwritten on upgrade); `features/` + `steps/` are scaffolded create-once and customer-owned thereafter (never overwritten); the deps join the base package set; `test:bdd` added only when absent'
  - 'Extend ensurePackageJson to create a minimal package.json for pure-non-JS repos (Go/Rust/Python) — reversing its current refusal — so the JS-based runner has a home; the only TS-vs-non-TS divergence'
  - 'Golden-path tests: a freshly set-up TS project and a pure-non-JS (Go) project both get the lane, and `bun run test:bdd` runs the scaffolded starter green'
out_of_scope:
  - '`safeword check` verification of the lane wiring — follow-on'
  - 'The `.feature`-as-source bdd-flow change (test-definitions.md → .feature as the authoring output) — separate slice'
  - 'Language-specific convenience steps — thin shared shell-out core only; grow on real duplication'
  - 'codify populating a real `.feature` into the scaffold — the developer runs codify separately'
  - 'An opt-out / disable mechanism — BDD is core (per the 2026-06-10 decision)'
  - 'reset/uninstall semantics for customer features/ + steps/ — deferred to the `safeword check` lane-verification follow-on'
  - 'A pre-existing customer-authored cucumber.mjs on first setup — safeword-owned config wins (rare collision; documented, not scenario-ized)'
done_when:
  - '`safeword setup` writes the full cucumber-js lane (config + steps scaffold + features/ starter + deps + test:bdd script), verified on a TS fixture'
  - 'A pure-non-JS (Go) fixture gets a minimal package.json + the lane, verified'
  - 'The scaffolded lane runs its starter feature green via `bun run test:bdd`, out of the box (golden-path)'
  - 'full /verify + /audit pass; verify.md written'
---

# Feature: Gherkin for Non-TypeScript Projects (TS Step Defs)

**Type:** Feature | **Priority:** Medium | **Parent:** Epic 102 (under Phase 1 / 0AWSY8) | **Depends on:** 102a

> **Reframed — 2026-06-10 (supersedes the QuickPickle / non-TS-only plan below).** Runner is **cucumber-js**, all-TypeScript; the lane is **core safeword setup, not opt-in** (BDD is what safeword is). Scope widened to the **combined customer scaffold** (TS + non-TS), subsuming the TS-customer scaffold 102a deferred — the non-TS case is just "create a minimal `package.json` so the JS runner has a home." Mechanism: `SAFEWORD_SCHEMA.ownedFiles` templates + base deps + an `ensurePackageJson` change (not a language pack, not an opt-in flag). The QuickPickle-specific plan below is historical; the real plan is `spec.md`.

> **Decision update — 2026-06-09.** Still in scope, and now load-bearing for the arcade merge: arcade is a polyglot monorepo whose services are tested over HTTP, so **TypeScript cucumber-js step defs drive non-TS services** (shell-out _or_ HTTP client). Swap QuickPickle → **cucumber-js** throughout. The all-TS decision keeps step defs uniformly TypeScript — this ticket is exactly that path. (Native-language step defs were 102c, now cancelled.)

## Problem

Ticket 102a adds Gherkin execution for TypeScript projects. But SafeWord supports Go, Rust, Python, and SQL projects. A Go developer using SafeWord's BDD workflow gets `.feature` files they can't execute.

## Solution

Extend the 102a QuickPickle setup to non-TypeScript customer projects. The `.feature` files are language-agnostic. The step definitions remain TypeScript but shell out to the customer's native tooling.

```gherkin
# Same .feature file works for any language
When I run "go test ./..."
Then the exit code should be 0
```

```typescript
// TypeScript step definition shells out — language doesn't matter
When('I run {string}', async (world, command) => {
  world.result = await exec(command);
});
```

## Tradeoff: JS Tooling in a Non-JS Repo

This adds `package.json`, `node_modules`, `vitest.config.ts`, and TypeScript step definitions to a Go or Rust project. This is acceptable because:

- SafeWord already requires Node/Bun — the dependency exists
- Acceptance tests test behavior from the outside, not internal functions
- Step definitions are thin glue code, not application logic
- For teams that find this unacceptable, ticket 102c adds native-language step defs

## Customer Non-TS Project Scaffold

```
customer-go-project/
  .safeword.yml                  <- bdd.enabled: true
  go.mod
  main.go
  features/                      <- .feature files (language-agnostic)
    api-health.feature
  steps/                         <- TypeScript step definitions
    index.ts
    world.ts
    shared.steps.ts              <- shell out to go test, cargo test, etc.
  package.json                   <- QuickPickle + Vitest (devDeps only)
  vitest.config.ts               <- QuickPickle plugin
```

## Implementation Steps

### 1. Extend scaffolding for non-TS projects

- Detect non-TS project (no existing `package.json`, or `package.json` without TypeScript)
- Generate minimal `package.json` with only QuickPickle + Vitest as devDeps
- Generate `vitest.config.ts` with QuickPickle plugin
- Add `.safeword.yml` config: `bdd.enabled: true`

### 2. Verify shared step vocabulary works for shell-out pattern

- Shared steps from 102a (`When I run {string}`, `Then the exit code should be {int}`) already work for any language
- No language-specific convenience steps upfront — let them emerge from real usage (thin core principle from 102a)

### 3. Handle .gitignore for JS artifacts

- Append `node_modules/` to `.gitignore` if not already present
- Consider whether `package.json` and `vitest.config.ts` should be gitignored or committed (recommend committed — they're project config)

### 4. Validate with a real non-TS project

- Test scaffolding against a Go project with `go.mod`
- Test scaffolding against a Rust project with `Cargo.toml`
- Verify `bun test` runs `.feature` files that shell out to native tooling
- Verify `safeword check` validates the setup

### 5. Update safeword check for non-TS projects

- Verify `package.json` exists with QuickPickle dep
- Verify `vitest.config.ts` has QuickPickle plugin
- Verify `features/` directory exists
- Verify `steps/` directory has barrel file

## Out of Scope

- Native-language step definitions — see ticket 102c
- Running customer's native test suite directly (SafeWord scaffolds and verifies, customer runs)
- Mixed TS/non-TS project detection (use `.safeword.yml` config)

## References

- Ticket 102a — prerequisite (cucumber-js lane proven in safeword's own repo)
- Ticket 102c — cancelled (all-TS decision; TS step defs cover non-TS apps)

## Work Log

- 2026-06-10T04:20:00.000Z Complete: intake — reframed to the combined core scaffold (cucumber-js, TS + non-TS, no opt-in flag; BDD is core per user decision); spec.md authored (JTBD gherkin-setup.TB1, AC1 scaffold / AC2 non-JS package.json / AC3 runs-green); scope/out_of_scope/done_when in frontmatter. (commit 8dff0e4c)
- 2026-06-10T04:35:00.000Z Complete: define-behavior — dimensions.md + 9 scenarios across 4 rules. (commit deab7a89)
- 2026-06-10T04:50:00.000Z Complete: scenario-gate — independent review (forked subagent, /review-spec procedure) returned CHANGES: 1 must-fix (feature-survival scenario was vacuous — Given now anchored to the scaffolded starter), 5 should-strengthen (polyglot merge observable via name-mismatch fixture; Go golden-path Then matched to TS twin; pure-go compound Then split into package.json-delta + lane-lands; added the pre-existing test:bdd collision scenario; ownedFiles-vs-customer-owned scope conflict fixed — cucumber.mjs owned, features/+steps/ create-once). 9 → 11 scenarios. Test layers: AC1/AC2 integration (built CLI on temp fixtures), AC3 golden-path (TS + Go). Build order: templates + schema registration → ensurePackageJson change → setup wiring → integration tests → golden-path. Phase → implement.
- 2026-06-10T05:10:00.000Z Decision (user): **Option A — uniform toolchain.** Pure non-JS repos get the full TS toolchain (eslint etc.) alongside the lane, because the lane ships TS step files that safeword's own lint hooks must be able to lint, and the alternative (lane-only) decays into A at first upgrade without a marker (javascript detection = package.json existence).
- 2026-06-10T05:25:00.000Z Complete: implement — RED verified in-session (6 failed | 1 trivially-green | 2 anchored-skip), then GREEN in one commit f11d63b2: templates/cucumber/ ×4 (config, starter feature, world, shared shell-out steps — glob-loaded, no barrel); schema ownedFiles (cucumber.mjs) + managedFiles ×3 (customer-owned working files); base packages += @cucumber/cucumber + tsx; package.json merge += test:bdd add-if-absent (+ unmerge); ensurePackageJson creates a minimal private package.json everywhere (refusal removed). 11/11 scenarios green (9 integration + 2 golden-path: '1 scenario (1 passed)', zero undefined, TS + pure-Go). Updated 6 setup-python/golang tests encoding the old skip-JS spec; nested-config guard exempts cucumber.mjs (packages may run their own lane). Phase → verify.
- 2026-06-10T05:50:00.000Z Complete: verify + done — first full-suite run caught two REAL 102b bugs: (1) scaffolded `features/` matched boundaries.ts's 'features' architecture layer → spurious depcruise configs everywhere (fixed: scanSearchPath skips dirs containing .feature files); (2) missing @types/node broke the typecheck hook on the scaffolded steps in every fresh project (fixed: added to base packages). 13 other failures were those bugs cascading (hooks/reset/sync-config/setup-architecture fixtures) + old-spec assertions (rust-golden-path, tooling-validation — updated to Option A). Fix commit 89094511; re-run of all affected files 152/152; final full suite ✓ 2566/2566 (1 skip, 161 files, exit 0). /verify + /audit invoked (depcruise ✔ 127 modules, knip baseline, 1 accepted cross-runtime template clone); verify.md written. Done. Epic 102's safeword scope complete (102a + 102b done, 102c cancelled).
