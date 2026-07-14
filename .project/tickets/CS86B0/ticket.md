---
id: CS86B0
slug: codify-spec-absorption
title: 'Codify-spec absorption: emit native vitest test skeletons from test-definitions.md'
type: feature
phase: done
status: done
epic: bdd-phase-one-merge
paired_with: JN39KG
created: 2026-05-24T21:27:52.680Z
last_modified: 2026-06-07T02:30:00.000Z
scope:
  - 'CLI command `safeword codify <ticket>`: resolve the ticket folder, read its test-definitions.md'
  - 'Pure `emitVitestSkeleton(content, { red })` in src/utils — parse `## Rule:`/`### Scenario:` blocks (reuse computeSkipMask + parseAcReferenceFromTitle); emit one describe per rule, one it per scenario, G/W/T as comments'
  - 'Default `it.todo()` pending stubs; `--red` emits `it(…, () => { throw new Error("not implemented") })`'
  - 'stdout by default; `--out <path>` writes a file, refusing to overwrite an existing one'
  - 'Clear errors when test-definitions.md is missing or contains no scenarios'
out_of_scope:
  - 'Python / pytest-bdd / .feature output (vitest-only, no Gherkin runner)'
  - 'Re-codify / merge after scenario edits (refuse-if-exists is the guard; merge is a future ticket)'
  - 'Auto-implementing test bodies (stubs only; implementation is TDD Phase 6)'
  - 'Hook auto-fire on phase transitions (opt-in via command invocation only)'
  - 'Languages beyond TypeScript; multi-language project detection'
done_when:
  - 'emitVitestSkeleton emits one test per scenario, grouped by rule, full-lineage names, G/W/T comments (unit-tested against a fixture)'
  - 'Default output uses it.todo; --red output uses a throwing it body'
  - 'codify command prints to stdout, --out writes + refuses-on-exist, missing/empty input errors (command-tested)'
  - 'command registered in cli.ts; full /verify + /audit pass; verify.md written'
---

# Codify-spec absorption: emit native vitest test skeletons

**Goal:** Add an optional safeword skill (working name `/codify`) that reads a ticket's `test-definitions.md` and emits **native vitest `*.test.ts` skeletons** — one `it()` per scenario, lineage-named, G/W/T as comments; default `it.todo()` pending markers, optional `--red` failing bodies — giving an "N tests to make pass" progress metric. TypeScript / vitest only; no Gherkin. See the Replan (2026-06-06) section for the full decision and rationale.

**Why:** Safeword's TDD model writes one test at a time during each scenario's RED phase. Arcade's `/codify-spec` front-loads: all failing tests exist before any implementation. Both have value — front-loading gives a clear progress metric ("3/12 tests passing"), while interleaved keeps the focus tight. Making test-emission optional preserves the choice.

**Parent epic:** 0AWSY8
**Paired with:** JN39KG in arcade (decommission of /codify-spec)
**Depends on:** —

## Scope

- New skill: invocable on a ticket whose `phase` is `define-behavior`, `scenario-gate`, `decomposition`, or `implement` and has a `test-definitions.md` file with scenarios.
- Reads each `### Scenario:` block under each `## Rule:` and emits a corresponding executable test stub.
- Language-aware: at minimum support Python (pytest-bdd .feature + step_defs) and TypeScript (Vitest or playwright-bdd). Detect from project context (package.json, pyproject.toml, etc.).
- Test stubs fail with a clear "RED — not yet implemented" message (`NotImplementedError` in Python, `throw new Error("RED")` in TS).
- Emits to project-conventional location (`tests/features/<slug>.feature` + `tests/step_defs/test_<slug>.py` for Python; configurable per project via safeword config).
- After emission, runs the test runner and verifies all stubs fail RED. If any test passes, error: "test passes without implementation — investigate."
- Updates ticket frontmatter to add `codified_at: <timestamp>` (no phase change — codification is parallel to phase progression).
- Skill output: summary of N stubs emitted, file paths, all-failing confirmation.

## Out of scope

- Auto-implementing step definitions — stubs are skeletons; implementation happens in TDD Phase 6.
- Re-codifying after scenario edits (idempotent overwrite vs merge is a future ticket).
- Languages beyond Python and TypeScript in v1 — Go, Ruby, etc. as follow-ups.
- Hook integration — codify is opt-in via skill invocation, not auto-fired by phase transitions.

## Done when

- New skill exists in safeword templates (`packages/cli/templates/skills/codify/SKILL.md` or similar).
- Skill emits valid pytest-bdd output for a Python project (verified against a fixture).
- Skill emits valid Vitest output for a TypeScript project (verified against a fixture).
- Emitted stubs all fail RED on first run (verified).
- Documentation in SCENARIOS.md and the skill body shows when to invoke (between Phase 4 and Phase 5, optional).

## Open questions

- Skill name — `/codify`, `/emit-tests`, `/scaffold-tests`? Driver leans `/codify` (matches arcade's vocabulary).
- TypeScript test framework — Vitest or playwright-bdd? Project-detected, with sensible default.
- Idempotency on re-emission — overwrite, merge, refuse? Driver leans refuse-if-exists (user must delete first, prevents accidental overwrite of impl).

## Replan — 2026-06-06 (figure-it-out; corrected scope supersedes the original above)

**TypeScript-only** (user constraint). Arcade's Python/pytest-bdd/`.feature` does not run in safeword — vitest 4.1.7, no Gherkin runner.

**Decision (`/figure-it-out`):** emit **native vitest `*.test.ts` skeletons, no Gherkin.** Only TS path that keeps vitest's native reporter/watch with zero new deps; `.feature` files buy nothing for a dev-internal tool with no non-technical readers. TS Gherkin runners (`@amiceli/vitest-cucumber` the only viable one) lose on a runtime dependency + a parallel two-file artifact set.

**Emission shape:**

- `describe('<jtbd-id>.AC#', …)` → `it('<scenario_name>', …)` per scenario, lineage-named per the SCENARIOS.md scheme, G/W/T as comments.
- Default body **`it.todo('<scenario>')`** — pending inventory; keeps the suite green, reconciling with safeword's commit-on-GREEN + one-test-at-a-time discipline. Optional `--red` flag emits `it(…, () => { throw new Error('not implemented') })` for a true-RED board. (`it.fails` is wrong here — green-while-broken since vitest 4.1.)

**Drop:** Python/pytest-bdd, `.feature`, the `decomposition` phase reference (retired), playwright-bdd, multi-language detection. TS/vitest only in v1.

**Don't inherit arcade bugs:** arcade's own canonical status is `asserted`, but its codify-spec writes `codified` (an arcade bug) and maps from a stale "behaviors / Edge Cases" spec shape — and safeword has no spec-status field at all, so port neither. (safeword reads `test-definitions.md` Rule/Scenario blocks instead.)

**Priority:** marginal value is modest — `test-definitions.md` already enumerates every scenario with R/G/R checkboxes (the "N to make pass" denominator). codify only auto-scaffolds the `.test.ts` files. **Defer remains defensible**; treat CS86B0 as low-priority / optional, not a headline child.

## Work Log

- 2026-05-24T21:27:52.680Z Started: Created ticket CS86B0
- 2026-05-24T21:30:00.000Z Drafted: Scope, language coverage, RED verification, 3 open questions; linked to epic 0AWSY8
- 2026-06-06T17:40:00.000Z Replan (/figure-it-out): re-scoped TS-only — emit native vitest skeletons (it.todo default, --red opt-in), drop Python/Gherkin/.feature/decomposition-ref/multi-lang. Noted arcade bugs not to inherit; flagged low-priority (test-definitions.md already gives the denominator). Build deferred.
- 2026-06-07T02:30:00.000Z Complete: intake — authored spec.md (JTBD codify.TB1 + AC1/2/3 for the DEV persona); added scope/out_of_scope/done_when frontmatter. Verdict refined: describe-per-`## Rule:` (rule = readable AC label, no free-text fallback) instead of describe-per-AC; lineage stays in each it() name. Build as CLI command + pure emitter (TDD target). Phase → define-behavior.
- 2026-06-07T02:45:00.000Z Complete: define-behavior — 14 scenarios across 4 rules in test-definitions.md (AC1 mapping/grouping/robustness ×7, AC2 body-style ×2, AC3 output-sink/bad-input ×5); dimensions.md saved. Phase → scenario-gate.
- 2026-06-07T03:00:00.000Z Complete: scenario-gate — independent review (forked subagent, /review-spec procedure) returned CHANGES: 2 must-fix, 5 should-strengthen. Applied all: pinned describe-name transform (heading minus `Rule:`, JSON.stringify-escaped) + added valid-module/special-chars scenario; broadened G/W/T to And-lines + added no-body stub; added one-to-one count; strengthened stdout/--out to assert content not existence; softened the --red message assertion; added --out parent-dir-missing I/O failure. 14 → 17 scenarios. AODI + determinism confirmed clean by the reviewer. Test layers: AC1/AC2 → unit (pure emitter, assert emitted string); AC3 → command-level (temp dir). Build order: emitter unit-first, then the thin command composing it. Phase → implement.
- 2026-06-07T03:30:00.000Z Complete: implement — TDD'd the pure emitter src/utils/test-skeleton.ts (parseScenarios + emitVitestSkeleton; reuses computeSkipMask, parseHeading local) RED→GREEN, 11/11 unit tests (AC1+AC2), commit 0fa7bc1d; then the thin command src/commands/codify.ts + cli.ts registration RED→GREEN, 6/6 command tests (AC3), commit e4fc8d91. JSON.stringify escaping makes every emitted name a valid literal (no-eval validity assertion). Dogfooded on CS86B0: default it.todo board, --red throwing board, unknown-ticket error. All 17 R/G/R marked (RED/GREEN per-layer sha, REFACTOR + cross-scenario skip). Phase → verify.
- 2026-06-07T03:45:00.000Z Complete: verify + done — /verify (full suite 2535 pass / 1 skip / 156 files, build ✓, lint clean) and /audit (depcruise ✔ no violations, knip baseline-only, jscpd no new clones) both invoked explicitly; verify.md written with the three done-gate patterns. CS86B0 done. Closes the final (optional) child of epic 0AWSY8 — all 7 children complete.
- 2026-06-07T03:50:00.000Z Post-done polish (quality-review + /refactor): verified the design against live docs (vitest 4.1.6 — it.todo=pending, it.fails=passes-when-throws, confirming the --red throwing-it choice; commander 14.0.3 one major behind but in maintenance). Two behavior-preserving refactors to codify.ts, each test+commit: atomic refuse-on-exist via `wx` flag (4327fe75, drops the existsSync TOCTOU), and exact-match-over-prefix ticket resolution (68e1cef5). Command tests 6/6 green after each; depcruise clean.
