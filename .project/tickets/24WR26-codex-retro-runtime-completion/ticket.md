---
id: 24WR26
slug: codex-retro-runtime-completion
type: task
subtype: bug-investigated
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/960
scope:
  - Debug Codex retro auto-run behavior from real Stop hook input through child extraction, draft spooling, and filing-gate visibility.
  - Add or use sanitized diagnostics that distinguish trigger skips, child failures, empty findings, and spool/filing behavior.
  - Add or update focused smoke coverage where it proves the runtime boundary.
out_of_scope:
  - Redesigning the retro product flow or changing the filing policy.
  - Filing this session's empty retro spool as a finding.
  - Changing Claude or Cursor retro behavior unless the shared helper is proven to be the failing boundary.
  - Logging raw transcript content or unsanitized findings.
done_when:
  - The failing boundary for Codex retro is identified with recorded evidence.
  - A substantial Codex Stop smoke path proves successful child launch and offset-state write.
  - Empty findings are visibly different from extractor failure.
  - The hook remains fail-open for normal users.
created: 2026-07-08T01:49:10.650Z
last_modified: 2026-07-13T02:45:13Z
---

# Debug Codex retro runtime completion

**Goal:** Identify the failing Codex retro runtime boundary and add focused smoke evidence for child launch and offset writes.

**Why:** GitHub issue #960 reports silent Codex retro completion failures with no drafts or successful-run marker.

## Work Log

- 2026-07-08T01:49:10.650Z Started: Created ticket 24WR26
- 2026-07-08T01:49:24Z Scoped: Mirrored GitHub issue #960 scope, exclusions, and done criteria into ticket frontmatter.
- 2026-07-08T01:54:14Z RED: Focused baseline passed 42/42, then new diagnostics tests failed on missing debug JSONL and missing Codex extraction failure reasons.
- 2026-07-08T02:02:20Z GREEN: Added opt-in `SAFEWORD_RETRO_DEBUG_LOG` JSONL diagnostics, Codex extraction failure reasons, child-exit tracing, offset-write tracing, and CLI spool/filing tracing. Focused tests pass 64/64; typecheck, schema registration test, and `git diff --check` pass.
- 2026-07-08T02:06:46Z Verify: ESLint passed; wrote `verify.md` with the live Stop payload capture listed as the remaining evidence limit.
- 2026-07-08T02:11:42Z Runtime capture armed: temporarily prefixed `.codex/config.toml` Stop hook with `SAFEWORD_RETRO_DEBUG_LOG=/Users/alex/.codex/worktrees/f80b/safeword/.project/tmp/codex-retro-stop-019f3f65-b385-7f31-b4be-57a8bbab420e.jsonl`.
- 2026-07-08T02:17:29Z Runtime capture attempt: no debug JSONL was written, but the real Stop path created/touched an empty `.safeword/retro-drafts/019f3f65-b385-7f31-b4be-57a8bbab420e.jsonl` and wrote no offset-state file. Reverted the config prefix and armed a temporary thread-scoped fallback in the installed `.safeword/hooks/lib/retro-debug.ts` copy for the next Stop.
- 2026-07-08T03:02:27Z Runtime capture retry: thread-env fallback still wrote no debug JSONL, while the real Stop path again touched the empty draft and wrote no offset-state file. Reverted that fallback and armed a temporary Stop-input-session switch in the installed `.safeword/hooks/codex/stop.ts` copy so the next Stop can propagate `SAFEWORD_RETRO_DEBUG_LOG` into the retro child.
- 2026-07-08T03:37:15Z Runtime boundary captured: live Stop decided to run with readable transcript and 205 tool uses, the retro CLI reported `failureReason: spawn_nonzero` / `exitCode: 1` from Codex extraction, the parent child exited `status: 1`, no offset state was written, and filing gate stayed silent. Removed the temporary Stop-input-session switch after capture.
- 2026-07-08T05:05:01Z Root cause fixed: exact helper replay captured Codex stderr `Not inside a trusted directory and --skip-git-repo-check was not specified.` Added `--skip-git-repo-check` to the Codex extractor argv; the same real transcript replay now exits 0 with `retro_cli_extraction ok:true`.
- 2026-07-11T05:17:25Z Review cleanup: full audit/quality/refactor pass added direct redaction/fail-open coverage for `retro-debug.ts`, extracted shared test JSONL parsing, and fixed Knip's intentional external `shellcheck` binary finding.
- 2026-07-13T02:45:13Z Done: PR #994 CI passed lint plus full test jobs on Node 22.22.3 and Node 24 after rebasing onto `198a8d35`; ticket metadata moved to done so the ready-PR ticket gate can run cleanly.

## Test Plan

- RED: Run the existing Codex retro trigger and integration smoke tests to capture the current failing boundary.
- RED: Add the narrowest failing smoke test that exercises `.safeword/hooks/codex/stop.ts` from Stop payload through child launch and offset-state write.
- GREEN: Add sanitized diagnostics or runtime plumbing only where the failing boundary requires it.
- REFACTOR: Keep diagnostics opt-in/test-only and preserve fail-open behavior for normal users.

## Root Cause

The confirmed code-level failure boundary was observability plus a live Codex headless extraction failure, not the deterministic Codex Stop trigger. Existing smoke coverage already proved a substantial Codex Stop payload can launch the retro child and write offset state when the child succeeds, but the runtime path swallowed child failures and extractor output failures without a sanitized trace.

The failing behavior was confirmed by RED tests: no debug JSONL existed for a child exit, and `runCodexHeadlessExtractionChecked` returned the same collapsed `{ ok:false, findings:[] }` shape for non-zero child exit, missing output, and malformed output. Schema-valid empty findings already returned `{ ok:true, findings:[] }`, but the Stop hook had no opt-in trace to make that visible when running out of band.

Live Codex Desktop evidence from a temporary sanitized debug log confirmed:

- Trigger reached `outcome: run` with `transcriptPathPresent: true`, `transcriptReadable: true`, `toolUses: 205`, `threshold: 3`, and `fires: 1`.
- Retro CLI extraction returned `ok: false`, `failureReason: spawn_nonzero`, `exitCode: 1`, and `findingsCount: 0`.
- The child command returned `status: 1`, `timedOut: false`, `pendingOffsetState: true`, and `ok: false`.
- Spooling skipped append with `draftsPassed: 0`; filing saw `remainingDrafts: 0`; the Stop filing gate did not dispatch.

The underlying root cause was the Codex extractor's working directory. Safeword intentionally runs extraction from a neutral temp directory so project hooks do not recurse and the extractor cannot mutate the user's repo. Claude accepts that neutral cwd. Codex 0.141.0 refuses to run `codex exec` outside a trusted/git directory unless `--skip-git-repo-check` is supplied. Because the runner closed stdio and ignored stderr, this surfaced only as exit code 1.

Confirmed by exact helper replay with captured stderr: `Not inside a trusted directory and --skip-git-repo-check was not specified.` Confirmed fix by injecting `--skip-git-repo-check` into the same generated argv against the same transcript: extraction returned `ok: true`, `findingsCount: 0`, and the retro command exited 0.

Ruled out: trigger skip, missing transcript, unreadable transcript, empty-findings success, filing-gate dispatch, offset-write failure, invalid model/flag shape, and transcript-specific schema failure. The offset write was not attempted in the failing run because the retro child exited non-zero before the fix.

## Verification

- PASS: `bun run test tests/hooks/retro-trigger-codex.test.ts tests/integration/codex-stop-retro.test.ts tests/hooks/retro-extract.test.ts tests/hooks/retro-debug.test.ts tests/commands/retro.test.ts` — 66 tests.
- PASS: `bun run lint`.
- PASS: `bun run test tests/schema.test.ts -t "should have entry for every template file"`.
- PASS: `bun run knip`.
- PASS: Audit rerun: config sync clean, dependency-cruiser clean, Knip clean, with baseline jscpd duplication and `knip` patch-version freshness reported.
- PASS: `git diff --check`.
- PASS: PR #994 GitHub CI passed full `bun run --cwd packages/cli test`, BDD, release tests, lint, format, typecheck, deps, architecture, and ticket-ID checks on rebased head `0c211f45`.
- LOCAL LIMIT: Two unrelated tests were flaky/environment-sensitive in this Mac worktree before CI: `tests/integration/rust-golden-path.test.ts` scenario 10 depends on local Clippy suggestion behavior, and `tests/scripts/cleanup-zombies.test.ts` preview/--yes depends on macOS temp-path spelling in process command matching. CI passed both full-suite jobs on Linux.

## Runtime Evidence

Captured one real Codex Stop run with debug logging enabled. The temporary capture switch was removed after inspection, the scratch JSONL was summarized above and removed, and the installed dogfood hook now matches the source template again.
