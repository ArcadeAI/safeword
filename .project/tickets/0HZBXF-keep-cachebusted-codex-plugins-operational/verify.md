# Verification: Keep cachebusted Codex plugins operational

## Verify Checklist

**Test Suite:** ✓ 9,857/9,857 tests pass (58 skipped); the only five failures in the planner's redundant second CLI run were stale-build timestamp checks, and the affected file then passed 112/112 after a fresh build
**Gherkin:** ✅ Acceptance lane passes (1,496 passed, 3 skipped; 68,731 steps passed, 4 skipped)
**Build:** ✅ Success
**Lint:** ✅ Clean
**Typecheck:** ✅ Clean
**Scenarios:** All 7 scenarios marked complete
**Refactor:** ✅ Completed — `392b4437f` centralized fresh bundle publication
**PR Scope:** ✅ Diff matches ticket scope
**Dep Drift:** ✅ Clean
**Parent Epic:** N/A
**Reconcile:** ✅ No pattern deviation
**Experience:** ⏭️ N/A — invisible packaging and runtime-resolution correctness, not a new persona-facing flow
**Surface Evidence:** ✅ 4/4 affected surfaces have recorded proof
**Evidence limits:** ⚠️ The planner's redundant second CLI run observed a local stale-build timestamp race, while the authoritative full run and focused rerun were green. Independent review is now restored; one non-blocking suggestion about shared bundle whitespace normalization remains deferred because applying it makes the tracked generated runtime fail the repository's whitespace gate.

Audit passed — diff-scoped architecture, configuration, documentation, and test-quality checks reported no errors or warnings.

## Surface evidence

| Affected surface | Proof command or manual check | Result |
| --- | --- | --- |
| OpenAI Codex | `packages/cli/tests/codex-plugin-version.test.ts` real `codex plugin add` cases | Base and cachebusted bundles execute from their exact installed directories and report the effective version |
| Safeword CLI | Generator and option-boundary tests in `codex-plugin-version.test.ts` and `scripts/codex-plugin-generation.test.ts` | Complete bundles publish atomically; invalid versions and occupied outputs fail without mutation |
| Claude Code | Before/after tree digest around cachebusted Codex generation | Byte-identical |
| Cursor | Before/after tree digest around cachebusted Codex generation | Byte-identical |

## Review assurance

- Coordinator: approved independent review `44c7f018-c6c6-457c-aa2e-54c0beaab751`; approved independent re-review after fixes `19c6e046-8e8b-4103-855d-4889902d42fe`
- Assurance: Claude Opus reviewed the bounded ticket work in a separate headless process. The re-review used the revised source fingerprint after the first-pass fixes.
- Independence: cross-agent (`codex` author, `claude` reviewer)
- Policy: prefer complete
- Verdict: approve — no error-level findings. Six first-pass durability and proof-quality warnings were corrected; remaining suggestions are non-blocking hardening or release-environment follow-ups.

The post-review focused lane passed 67/67 tests, including the complete Codex plugin contract and BDD proof map. Gherkin lint and CLI typecheck also passed.

## Environment notes

- The lockfile-declared optional package `@bruits/satteri-darwin-arm64@0.10.5` was installed with `--no-save`; `package.json` and `bun.lock` were unchanged. The website build then passed.
- Five unrelated retro command tests rejected a stale `dist/cli.js` timestamp only during the planner's redundant second full-suite invocation. A fresh-build rerun of the entire file passed 112/112.
