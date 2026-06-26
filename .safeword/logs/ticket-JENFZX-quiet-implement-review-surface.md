# ticket-JENFZX-quiet-implement-review-surface

## 2026-06-26

- Started implementation from GitHub issue #464 / ticket JENFZX.
- Test choice: integration tests against deployed `.safeword/hooks/*` because the user-visible behavior is hook stdout / Cursor follow-up payloads.
- Target behavior: quiet ordinary implement-step review prompts; keep phase reviews, hard gates, typecheck advice, and non-implement Cursor stop nudges.
- RED: focused integration tests failed on current behavior for Claude PostToolUse TDD flips, Claude Stop implement-step backstop, and Cursor Stop implement follow-up.
- GREEN: removed PostToolUse implement-step context emission, made Stop skip ordinary implement-step review backstop after typecheck advice, and made Cursor Stop return `{}` for active implement tickets while preserving marker cleanup.
- Guidance sync: updated TDD review and BDD implement docs/rules across template, Claude, Codex, and Cursor mirrors to define quiet implement mode.
- Verification: focused hook/parity suite 101/101 pass; Cursor stop regression 2/2 pass; `bun run --cwd packages/cli typecheck` pass; `bun run lint:eslint` pass; `bun run lint:gherkin` pass.
- Quality-review found and fixed Cursor state wiring: production Cursor PostToolUse now spawns shared hooks with `SAFEWORD_AGENT_RUNTIME=cursor`, post-tool translation reads `.stdout`, raw Cursor conversation ids map to `quality-state-cursor-*`, and the Cursor Stop regression binds through real Cursor PostToolUse before Stop.
- Re-review verification: 16 focused hook/test files pass (253 tests); `bun run --cwd packages/cli typecheck` pass; `bun run lint:eslint` pass; `bun run lint:gherkin` pass; `git diff --check` pass. `bun audit --json` reports existing low/moderate advisories unrelated to #464 and no manifest/lockfile changes.
- Refactor: removed dead implement-step review dedup state/helpers/tests (`selectMostAdvancedStep`, `shouldReviewStep`, `lastReviewedStep`) now that quiet implementation skips ordinary step-review surfacing. Phase review dedup remains intact.
- Refactor verification: affected tests 30/30 pass; broader hook matrix 156/156 pass; scoped audit found one stale test label, then audit follow-up tests 12/12 pass; `bun run --cwd packages/cli typecheck` pass; `bun run lint:eslint` pass; `bun run lint:gherkin` pass; `git diff --check` pass. Commit deferred because HEAD is detached and the refactor is interleaved with the #464 feature diff/ticket artifacts.
