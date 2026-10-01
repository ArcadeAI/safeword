# Work Log: Keep the Claude plugin installable and recoverable

**Anchored to:** `.project/tickets/HX3KFQ-keep-claude-plugin-recoverable/ticket.md`

## Session: 2026-09-13

- [04:02] Read the Safeword handbook, figure-it-out, debug, ticket, planning, testing, and
  architecture guidance.
- [04:08] Confirmed issue #4519 against the checked-in Claude payload. The bundle probes a flat
  `templates/` root while generation emits a split `resources/`, `skills/`, and `runtime/hooks/`
  tree.
- [04:10] Confirmed issue #4520: every non-prompt integrity failure exits 2; Claude treats that as
  unconditional PreToolUse denial, blocking Bash/Edit/Write recovery.
- [04:14] Reproduced the analogous Codex payload gap: the sentinel resolves, then feature ticket
  creation fails because `templates/spec-template.md` was never shipped.
- [04:18] Chose canonical template packaging plus executable release checks. For cache damage,
  chose `permissionDecision: ask`: official Claude hook semantics preserve explicit user approval,
  while the dispatcher still refuses to execute unverified Safeword hooks.
- [04:56] Verification passed: 9,989 non-skipped project tests, 52 focused contract tests, 12
  Claude release tests, the three corrected Gherkin scenarios (137 steps), package and website
  builds, lint, typecheck, dependency audit, generator drift, and diff audit. The initial relay
  failures were reproduced as sandbox-only; all 199 relay tests passed with socket permissions.
- [14:24] Added explicit BDD proof for the native resource and damaged-cache recovery contracts.
  Extracted a normal-suite resource test that copies both bundles outside the checkout before
  exercising their real CLIs. Fixed generated test plans to suppress exact root-delegated workspace
  lanes while retaining non-delegated siblings and deceptive command-text cases.
- [14:58] Final current-head verification passed: 9,955 project tests, 184 focused tests, 74 release
  tests, 595 BDD scenarios with 11,100 steps, and 45 proof-tag checks. The sandboxed relay run could
  not exercise local sockets and hung after failures; the unrestricted rerun passed 198 tests with
  1 skip, confirming an environment failure rather than a product regression.
- [16:31] Completed the requested full repository audit and refactor pass. Consolidated test script
  selection, reused the shared shell tokenizer, restored and pinned the CLI build before BDD,
  centralized the canonical template payload boundary, and separated damaged-cache verification
  from protocol output. Each refactor passed focused tests and was committed independently.
- [16:31] Final verification passed 10,002 tests with 14 skips, 595 BDD scenarios with 11,100 steps,
  45 proof-tag checks, every package/site build and typecheck, Gherkin/ESLint, and five dependency
  audits. The dedicated proof lane initially could not start while another worktree held the shared
  lock; its retry passed. Independent quality review and remote GitHub verification were attempted
  but blocked by outbound/push policy; the source-backed local review found no error-level issue.
