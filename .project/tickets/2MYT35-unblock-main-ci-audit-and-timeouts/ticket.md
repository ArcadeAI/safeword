---
id: 2MYT35
slug: unblock-main-ci-audit-and-timeouts
type: task
phase: done
status: done
external_issue: https://github.com/ArcadeAI/safeword/issues/6357
external_issues: [https://github.com/ArcadeAI/safeword/issues/6357, https://github.com/ArcadeAI/safeword/issues/6358]
external_prs: [https://github.com/ArcadeAI/safeword/pull/6433]
superseded_prs: [https://github.com/ArcadeAI/safeword/pull/6366, https://github.com/ArcadeAI/safeword/pull/6367]
created: 2026-11-02T21:49:19.948Z
last_modified: 2026-11-02T21:55:00.000Z
---

# Unblock main CI for contributors by clearing audit advisories and install-bound test timeouts

**Goal:** Main CI's dependency audit and Node test jobs pass without changing any test deadline or assertion.

**Why:** High undici/zod advisories (#6358) and real dependency installs in three lifecycle test files (#6357) kept main CI red, blocking every PR including #6319.

## Ticket provenance

This ticket was created on 2026-11-02, after the code work, to give the already-reviewed change its delivery record. The work log separates events reconciled from existing commits, runs and reviews (dated as they happened) from work done under this ticket.

## Scope

- Root `package.json` overrides `undici` 8.12.2 and `zod` 4.6.6, plus `bun.lock` (#6358).
- `rust-golden-path.test.ts` upgrade, `setup-reconcile.test.ts` converge and `selected-authority-reconciliation.test.ts` run without the real dependency install, via `SKIP_INSTALL_ENV` or `vi.stubEnv('SAFEWORD_SKIP_INSTALL', '1')` (#6357). These cases assert file ownership, profile state and upgrade output, never installed packages.

**Out of scope:** test deadlines, assertions, product code, Python advisories in the preserved prototype, and #6319's own changes.

## Dependency compatibility

Every consumer's declared range already includes the overridden version: `@astrojs/sitemap` `^4.3.6`, `astro` `^4.5.4`, `knip` `^4.4.3`, `@eslint-react/shared`, `eslint-plugin-react-hooks` and `zod-validation-error` `^3.25.0 || ^4.0.0`; `unifont` `undici ^8.0.0`. Main resolved no Zod 3 copy before the change.

## Tests

No new tests: the change is test setup and dependency resolution. RED evidence is the CI failures below; GREEN is the same suites passing on the same deadlines.

## Work Log

- 2026-11-01T20:42Z Reconciled: `6b727dd2b` overrides undici and zod (#6358); `f992ee593` keeps rust-golden-path upgrade and setup-reconcile converge off the network install (#6357).
- 2026-11-01T22:32Z Reconciled RED: #6366 run 41357604668 — audit passed; both Node jobs timed out in rust-golden-path and selected-authority-reconciliation. #6367 run 41357608015 — audit failed (expected); selected-authority-reconciliation timed out on both Node jobs.
- 2026-11-01T23:20Z Reconciled: locally `selected-authority-reconciliation.test.ts` took 95.79 s with the real install and 2.61 s without (8/8 both ways). `d752ecddd` stubs `SAFEWORD_SKIP_INSTALL` there.
- 2026-11-01T23:24Z Reconciled: #6367 run 41361927263 on `d752ecddd` — Node 24 passed; Node 22 failed 2 tests in `packaged-collector.integration.test.ts` (`expected 'waiting' to be 'ready'`). Not reproduced; cause unconfirmed.
- 2026-11-02T00:16Z Reconciled GREEN: temporary integration commit `02eaea059` (tree `fc02277ff`), run 41366259506 — every job passed, including audit and CLI 727/727 files on both Node versions.
- 2026-11-02T19:10Z Reconciled: #6433 opened with the three commits cherry-picked unchanged onto `f211c4c30` (`9641aa961`, `4c19e50f0`, `755584790`); tree `fc02277ff` matches `02eaea059` exactly. #6366 and #6367 stay open as evidence.
- 2026-11-02T19:11Z Reconciled review (recorded on #6433 at 19:11:54Z): Codex quality review f4e74d78 requested compatibility evidence for the zod override; answered with the lockfile ranges above, no code change. Review 61c0bf9a approved with no findings.
- 2026-11-02T19:33Z Reconciled: #6433 run 41507437273 attempt 1 — all checks passed except Node 22: `claude-plugin-release.release.test.ts` "binds the committed catalogue…" timed out at 30677 ms against 30000 ms (prior 16991–23731 ms; file untouched). Not reproduced; cause unconfirmed. Attempt 2 (failed job only, recorded 21:43:50Z) passed at 19468 ms.
- 2026-11-02T21:49:19.948Z Started: Created ticket 2MYT35 for delivery closure.
- 2026-11-02T21:51:42Z Full local verification started at head `755584790`.
- 2026-11-02T21:52Z Intake review: Codex 3e889f55 requested the `bun.lock` change in the packet; added `evidence/bun-lock-resolution.md`, no code change. Review 01c619a1 approved; stamped for intake.
- 2026-11-02T21:53:00.327Z Phase: intake → verify (implementation and review already complete; see reconciled entries)
- 2026-11-02T22:48:58Z Verification finished (exit 1, 3436 s): tests, Gherkin, build and typecheck passed; dependency audit lane failed on 9 moderate/low JavaScript and 16 Python advisories outside this ticket's scope (see verify.md). No second run.
- 2026-11-02T22:51Z Verify review: Codex 51cea9f8 requested the three test files in the packet; added them with tests/helpers.ts, no code change. Review 8a202f08 approved (warning: close the frontmatter to match this log) and was stamped at 22:51:16Z, then went stale when this log was edited afterwards. The verify-phase exit uses a fresh review of this final text; its id is recorded in the review ledger, the closing commit and #6433.
- Closing criteria: the done gate requires installed dependencies, passing tests and a passing PR Scope line in verify.md; the dependency audit lane result does not gate closure and is recorded as ❌ in verify.md.
- 2026-11-02T22:52:30.321Z Phase: verify → done
