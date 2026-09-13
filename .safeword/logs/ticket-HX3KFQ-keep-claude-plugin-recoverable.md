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
