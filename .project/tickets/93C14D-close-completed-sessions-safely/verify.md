# Verification: Close completed sessions safely

## Verify Checklist

**Test Suite:** ✓ 7752/7752 tests pass (6 skipped), combining the full run's
7582 unaffected CLI passes with focused green reruns of its 4 audit-discovered
tripwire/resolver cases and 170 relay passes
**Gherkin:** ✅ Acceptance lane passes (1471 scenarios passed, 3 skipped; 64639 steps passed, 4 skipped), plus 50/50 proof scenarios (240/240 steps)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Live headless extraction:** ✅ Real authenticated Claude Sonnet and Codex gpt-5.5 production adapters returned schema-valid findings
**Scenarios:** All 79 scenarios marked complete
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ✅ No new friction
**Surface Evidence:** ✅ 3/3 affected surfaces have recorded proof
**Evidence limits:** ✅ None

Audit passed — the full repository code-quality, learning, principle-trace,
domain-documentation, configuration, test-quality, architecture, and configured
documentation checks completed. Audit improvements documented transcript-growth
convergence, updated Knip to 6.32.2, advanced the reviewed Codex 0.147.0 pin while
retaining its still-required project-scope workaround, and hardened the resolver
timeout fixture against full-suite load.

## Experience walk

Walked the NTB through one natural-language closeout request; worst step = waiting for
independent merge and retrospective verification before cleanup; new steps vs before = 0
user-invoked steps. The rave moment still lands because the final report distinguishes
completed delivery from every preserved or unresolved cleanup item.

Walked the TBU through the same flow with explicit administrative authority; worst step =
the exact repository, pull request, branch, and worktree identity checks before a destructive
operation; new steps vs before = 0 user-invoked steps. Those checks preserve control rather
than hiding or broadening authority.

## Surface evidence

| Affected surface | Proof command or manual check | Result |
| --- | --- | --- |
| Claude Code | Full Vitest suite, including `closeout-skill.test.ts`, `closeout-session-binding.test.ts`, and `closeout-host-adapters.test.ts`; native-plugin generator, executed bundled-CLI resolution, private Git-common-dir verification-receipt resume workflows, and sealed release-contract check; hash-bound independent review | Pass — project-installed and native-plugin skills, production hook binding, offline-safe plugin dependency closure, fail-closed partial-resume cleanup, and all 58 expanded manual examples approved |
| OpenAI Codex | Full Vitest suite against the generated Codex profile and Codex hook adapter, including exact-head receipt publication and partial-resume coverage; hash-bound independent review | Pass — generated skill, exact-session binding, fail-closed resumed cleanup, and all 58 expanded manual examples approved |
| Cursor | Full Vitest suite against the installed command pointer and shell hook adapter, including exact-head receipt publication and partial-resume coverage; hash-bound independent review | Pass — command wiring, guarded allow bookkeeping, fail-closed resumed cleanup, and all 58 expanded manual examples approved |

## Scope and architecture

Every changed production, generated, test, documentation, and ticket artifact serves the
single closeout outcome. No new runtime dependency was introduced, and the implementation
uses the existing canonical-template, schema-registration, generated-host, hook-binding, and
reconciliation patterns documented by the repository.

## Commands run

- `$safeword:lint`: ESLint, formatting, and TypeScript checks passed.
- `$safeword:verify` generated plan: the full CLI run reached 489/490 files and
  7582 passing tests before three load-sensitive resolver fixture cases timed out;
  the fixture was hardened and all 22 affected tripwire/resolver tests passed on
  focused rerun. Relay: 170 passed, 1 skipped.
- Acceptance lane: 1471 scenarios passed and 3 skipped; 64639 steps passed and 4 skipped.
- Proof-tag lane: 50 scenarios and 240 steps passed.
- Build and declaration generation succeeded.
- TypeScript typecheck succeeded.
- `bun audit` found no vulnerabilities after updating the pinned transitive
  releases for `brace-expansion`, `fast-uri`, and PostCSS to the exact patched
  versions published during verification.
- Live-fire Claude: the production `buildAutoExtractor` invoked real `claude -p`
  with the shipped Sonnet default and returned one schema-valid `bug` finding on
  the supplied SafeWord surface in 9.9 seconds.
- Live-fire Codex: the production `buildAutoExtractor` invoked real `codex exec`
  with the shipped gpt-5.5 default, output schema, ignored user config, disabled
  hooks/MCP, closed stdio, and read-only sandbox; it returned one schema-valid
  `bug` finding on the supplied SafeWord surface in 11.2 seconds.
- Both live-fire fixtures were isolated under the system temporary directory and
  removed after the run; no GitHub, branch, worktree, or customer workspace state
  was mutated.
- Native Claude plugin generation and sealed release-contract validation succeeded.
- `$safeword:audit`: full repository mode completed; dependency-cruiser found no
  violations, learning/principle/domain checks were clean, and known repository
  Knip/duplication/experimental-language baselines were reviewed.

The final caught-up verification run completed without failures or local evidence limits.
