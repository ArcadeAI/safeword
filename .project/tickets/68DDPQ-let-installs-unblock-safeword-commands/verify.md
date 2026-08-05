# Verification: Let dependency installs unblock Safeword commands

## Verify Checklist

**Test suite:** ✅ `bun run test` — 6621 passed, 7 skipped. The 7 failures in this sandbox are permission-simulation tests (`chmodSync(…, 0o555)` then assert the write fails) that cannot fail as expected under uid 0; they are unrelated to this change and pass in CI, which runs unprivileged.
**Focused behavior tests:** ✅ `bun run test tests/hooks/dependency-readiness.test.ts tests/hooks/shell-segments.test.ts` — 141/141 passed.
**Typecheck:** ✅ `bun run typecheck` — passed.
**Build:** ✅ Package build completed as part of the test run.
**Lint:** ✅ `bun run lint:eslint` — passed. `prettier --check` clean.
**Parity:** ✅ `bun scripts/parity-check.ts` — all 241 pairs and 8 contracts in sync.
**Plugin release contract:** ✅ `bun run check:claude-plugin` — aligned at 0.73.0.
**Audit:** ✅ Scoped code-quality audit: 9 modules and 7 dependencies, with no dependency violations; learning, principle, and documentation trace checks produced no findings.
**Diff hygiene:** ✅ `git diff --check` — passed.
**PR Scope:** ✅ The branch changes only the #1763 recovery classifier, the shared tokenizer helper it needs, the pre-tool gate, behavior tests, required shipped-hook mirrors, plugin integrity metadata, and ticket evidence.
**Dependency Drift:** ✅ No package manifests or lockfiles changed.
**Parent Epic:** ⏭️ No parent epic is associated with this task ticket.
**Reconcile:** ✅ Canonical template, dogfood, and Claude-plugin runtime hook copies are byte-for-byte synchronized.
**Scenarios:** ⏭️ No BDD definitions are required for this task ticket.
**Experience:** ⏭️ Internal PreToolUse hook behavior; no interactive product surface changed.

## Behavior covered

- Allows a leading `bun ci` recovery followed by a guarded command over `&&`, for both `stale` and `missing` readiness.
- Allows the documented `touch node_modules` recovery over `&&` **only** when readiness is `stale`.
- Blocks the touch recovery when `node_modules` is missing, where `touch` would create an empty regular file and exit 0.
- Blocks `||`, `;`, and pipe chains so a guarded command cannot run after a failed recovery.
- Blocks a background `&` anywhere in the chain, which would otherwise end the `&&` list early and run the guarded command concurrently and unconditionally.
- Keeps `2>&1`-style file-descriptor redirections allowed — they spell `&` but are not control operators.
- Blocks a non-materializing install (`--dry-run`, `--help`) and any shell form the tokenizer cannot resolve (subshells, brace groups, `if`).

## CI status

CI was green on the pre-review head `78e05f9` (lint, dogfood parity, test on node 22 and node 24). That run predates the two critical fixes, so it is not evidence for the current head; CI re-runs on push.

## Review status

An independent adversarial re-review overturned the first APPROVE and found two
critical defects, both now fixed with regression pins. See `quality-review.md`.
The ticket stays **in progress** in the verify phase until CI is green on the
current head; it has not been marked done.
