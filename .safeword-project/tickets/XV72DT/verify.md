# Verify — Ticket XV72DT

Warn-on-fabricated-verification-stamp PostToolUse hook + guide anti-pattern.

## Verify Checklist

**Test Suite:** ✓ 1978/1978 tests pass (1 skipped, 0 failed) — schema drift in initial run on HEAD `4e724b1` (missing ownedFiles entry); fixed on `ad06249`, re-ran schema + new hook tests (43/43 pass).
**Build:** ✅ Success (ESM + DTS, `bun run build` from `packages/cli/`)
**Lint:** ✅ Clean (`bun run lint:eslint`, `bun run format`, `bunx tsc --noEmit` all silent)
**Scenarios:** All 4 scenarios marked complete (no `test-definitions.md` for this task ticket; `done_when` criteria mapped to `tests/hooks/learning-verification-stamps.test.ts` — see mapping below)
**Dep Drift:** ✅ Clean (no new `package.json` deps; the 3 new files are internal hook lib + test + ticket folder)
**Parent Epic:** N/A

### `done_when` → test mapping

| `done_when` criterion                                                 | Evidence                                                                                                             |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Learning with `✅ Verified by X` triggers `additionalContext` warning | `tests/hooks/learning-verification-stamps.test.ts` — 8 positive-case assertions in "must flag" block                 |
| Learning with `verified gap` / `verified across` does NOT trigger     | Same test file — 8 negative-case assertions in "must NOT flag" block                                                 |
| Hook still regenerates `INDEX.md` as before (existing behavior)       | Existing `spawnSync('bun', ['…/cli.ts', 'sync-learnings', …])` path unchanged in `post-tool-sync-learnings.ts:43-47` |
| Anti-pattern paragraph exists in both install + template copies       | `dogfood-parity.release.test.ts` enforces byte-equality on `learning-extraction.md` (in schema `ownedFiles`)         |

## Audit

Audit passed.

- **Architecture:** ✅ No violations (depcruise: 1231 modules, 3384 deps cruised, 0 errors).
- **Dead code (knip):** ✅ Clean — silent across all 3 new/modified files.
- **Duplication (jscpd):** 92 clones, 2.05% of lines / 1.8% of tokens — pre-existing baseline, unaffected by this ticket (the new lib file is 60 LOC of unique policy logic, the new test is parameterized via `it.each`).
- **Learning files (`Covers:` line):** ✅ All conform; the new hook is targeted at the _write-time_ gate, not at retrofitting existing files.
- **Outdated deps:** 3 packages flagged, all pre-existing.

| Package             | Current | Latest | Type | Bump  | Risk   |
| ------------------- | ------- | ------ | ---- | ----- | ------ |
| eslint-plugin-jsdoc | 62.9.0  | 63.0.0 | dev  | major | Medium |
| eslint              | 9.39.4  | 10.4.0 | dev  | major | High   |
| knip                | 6.14.1  | 6.14.2 | dev  | patch | Low    |

- ✅ **Low risk (1):** `knip` patch — safe to update next housekeeping pass.
- ⚠️ **Medium risk (1):** `eslint-plugin-jsdoc` major — review changelog; defer.
- 🔴 **High risk (1):** `eslint` 9→10 — separate ticket (ticket 099 already exists per CLAUDE.md MEMORY).

None of these are introduced by this ticket; all pre-existing.

## What this ticket delivers

Two-layer inoculation against fabricated `✅ Verified` claims in `.safeword-project/learnings/` — chosen via `/explore-and-debate` over PostToolUse auto-strip and PreToolUse hard-deny.

1. **Guide rule** ([learning-extraction.md](.safeword/guides/learning-extraction.md)) — anti-pattern added to the "Anti-Patterns (Don't Extract)" section. The agent reads this _before_ extracting, so the rule shapes the write itself. Inoculation per [arxiv:2511.18397](https://arxiv.org/pdf/2511.18397) — Anthropic's reward-hacking paper found inoculation outperformed blocking by 75-90% for semantic patterns.
2. **Runtime nudge** ([post-tool-sync-learnings.ts](.safeword/hooks/post-tool-sync-learnings.ts)) — PostToolUse `additionalContext` warning fires when the just-written file contains `✅ Verified`, `Verified by`, or line-leading `verified:` in body prose. Names `verify.md` as the right home for verification claims (commit-pinned, evidence-bound — the structural inverse of forward-looking principles). Exempt patterns cover legitimate research idioms ("verified gap", "verified across tickets", "empirically verified") to avoid the synonym arms race documented in [arxiv:2504.11168](https://arxiv.org/html/2504.11168v3).

### Why warn-not-block

Three options were debated:

- **B — PostToolUse auto-strip (mutate the file).** Rejected: no semantic-mutation precedent in the Claude Code ecosystem (formatters only mutate syntax); false-positive cost on the ~4 existing legitimate "verified" research citations; agent edit-war risk.
- **C — Restructure file format (`## Principle` / `## Evidence` sections).** Rejected: migrates 19 existing files; doesn't actually prevent fabrication, just relocates it. Heavy ceremony for a once-per-session bug.
- **A — Warn (`additionalContext`).** ✅ Chosen: matches Anthropic's documented mitigation, reuses the existing pattern from `post-tool-lint.ts:46-51`, zero false-positive cost (research-methodology "verified" mentions get the nudge, human reviewer ships).

### Smoke-tested in-session

- Stamped file (`✅ Verified by bun run build`) → hook emits `{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"Verification stamp detected in ..."}}` on stdout, exit 0.
- Clean file (`verified gap, April 2026 — closed in 6.0-beta`) → hook emits no output, exit 0.

## Side findings (out of scope for this ticket)

None spawned. The original Astro-spike message that triggered this work noted ~4 existing learnings with "verified" in them; spot-checked during research phase — all are legitimate research-methodology uses ("verified gap, April 2026", "empirically verified across tickets #124a/b"). No retrofit ticket needed.
