---
id: M35AP7
slug: codex-upgrade-protection
type: task
phase: implement
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/2806
scope:
  - preserve a valid task-bound session proof when a newer Codex profile plugin is installed
  - classify bootstrap protection as current, older-observed, or unverified without promoting older proof to current proof
  - keep missing, malformed, foreign, and inconsistent proof loud and fail-open
  - cover upgrade-in-place and concurrent SessionStart ordering with focused regression tests
out_of_scope:
  - hot-loading newly installed Codex plugin hooks into an already-running task
  - treating historical task proof as cleanup or destructive-operation authority
  - weakening exact current-version activation or hook-authorization checks
done_when:
  - an upgrade preserves and reports observed older task protection while the installed update remains pending
  - absent or untrusted proof remains explicitly unverified and never blocks the task
  - exact current proof remains silent and authoritative
  - focused tests, full verification, audit, and quality review pass
created: 2026-08-15T03:15:02.064Z
last_modified: 2026-08-15T06:32:12.000Z
---

# Keep observed Codex protection visible across upgrades

**Goal:** Preserve trustworthy task-bound proof of an older loaded Safeword runtime across profile upgrades while keeping current-version activation exact and fail-open.

**Why:** The hotfix prevents false blocking language, but installation still erases the evidence needed to distinguish observed older protection from genuinely unobserved protection.

## Work Log

- 2026-08-15T03:15:02.064Z Started: Created ticket M35AP7
- 2026-08-15T03:16:00.000Z Scope: Resumed the user-approved two-stage plan after shipping v0.78.2. Official Codex documentation confirms installed plugin capabilities require a new session and exposes no supported production hook hot-reload API, so this task preserves observed older protection without promising first-install hot activation.
- 2026-08-15T03:16:30.000Z Root cause: `writeCodexActivationMarker` deletes the entire task-bound session-proof store. The exact-current comparison would already reject an older identity safely; deletion instead destroys the only evidence needed to distinguish observed older protection from unverified protection.
- 2026-08-15T03:54:00.000Z TDD: Added upgrade-in-place, same-host ordering, malformed proof, and retention regressions. Focused red/green/refactor coverage reached 44 passing contracts before deep review.
- 2026-08-15T04:01:00.000Z Quality review: Independent Claude/Opus review identified cross-platform permission rejection and acceptance of an obsolete unbound proof schema as pre-merge defects, plus consistency and wiring improvements.
- 2026-08-15T04:07:54.000Z Hardened: Proof metadata now degrades safely without POSIX modes; current proof accepts only schemas 2/3; activation precedence is shared; retained history is bounded per project and across projects; empty roots and empty `CODEX_HOME` are handled; marker corruption and version skew are distinct; local proof trust is named accurately; the packaged manifest and command dispatcher share and test the event contract. Focused coverage: 78 passing tests; ESLint and typecheck pass.
- 2026-08-15T04:13:00.000Z Audit: Diff-scoped dependency and architecture checks passed. Corrected customer documentation that still implied a new task without an app restart was sufficient, and updated the accepted architecture decision to distinguish retained advisory history from cleanup authority.
- 2026-08-15T04:15:00.000Z Follow-up: Filed GitHub #2982 for the separate destructive-cleanup gap: global per-event proof can clobber across concurrent tasks and cleanup still needs a task-bound authorization consumer. This task does not promote or broaden cleanup authority.
- 2026-08-15T04:20:30.000Z Re-review hardening: Empty install-time host discovery now remains unavailable and cannot clear activation; retained task proof is activation-bound so same-version repair cannot promote an older task; pruning avoids destructive/expensive scans; custom namespace and absolute target paths reach the ticket-intake gate. Focused coverage: 84 passing tests.
- 2026-08-15T04:32:45.000Z Final quality-review fixes: Hook writing and bootstrap reading now share one git-root resolver; SessionStart cannot clear activation when the current host is an install-time host omitted from the running list; untrusted proof has a distinct machine reason; malformed session ids degrade to unbound proof; empty-directory pruning no longer races concurrent writers; repeated identity/project discovery is eliminated. Removed the unused cleanup-authorization API so #2982 can introduce it with its consumer. Focused coverage: 86 passing tests; typecheck and ESLint pass.
- 2026-08-15T05:03:03.000Z Full-gate follow-up: The first complete run exposed stale headless/migration fixtures that treated all hook invocations as current while activation remained pending. Updated production headless verification to require stale aggregate proof for pending activation and updated unit/BDD handoff fixtures to prove an actual old-host-to-restarted-host transition. Hardened marker/receipt metadata trust, added direct older-identity coverage after marker retirement, distinguished trusted activation-pending proof from malformed proof, made project pruning concurrent-writer-safe, and pinned git-root install/observe behavior. Focused coverage: 176 passing tests; the previously failing handoff scenario passes 49/49 steps. The only dependency scanner finding remains the pre-existing Nano ID advisory tracked by #2808.
- 2026-08-15T05:50:19.000Z Verification follow-up: The second complete CLI run reached 7,942 passing tests with one unrelated load-sensitive timeout that passed 3/3 in isolation. The complete BDD run exposed two affected restart fixtures whose hand-written activation markers lacked the production file mode; both scenarios pass 86/86 steps after correcting the fixtures. Build, typecheck, lint, formatting, focused unit coverage, and affected BDD coverage are green. GitHub CI remains the authoritative complete-suite merge gate.
- 2026-08-15T06:16:51.000Z Independent review follow-up: Fixed divergent project-root derivation in the headless verifier, required an explicit capability-selected Codex executable, applied the activation-receipt timestamp boundary to aggregate cleanup proof, proved older-version reporting at the bootstrap surface, and added direct regressions for both pre-restart aggregate proof and activation-pending task proof. Documented the bounded retained history and stopped crash-left temporary directories from consuming retention slots. The first GitHub run then exposed one stale CI fixture expectation: with no live app-server, empty process discovery is correctly `unavailable`, not `observed`; updated that assertion before the next remote run.
- 2026-08-15T06:32:12.000Z Cross-environment verification: Canonicalized the shared resolved project root before comparing proof on macOS, and changed the migration integration assertion to verify the coherent observed/non-empty or unavailable/empty pair across developer and CI hosts. The affected CLI suite is green with 178/178 tests after these corrections.
