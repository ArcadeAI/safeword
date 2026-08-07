# Spec: Keep Safeword recovery runnable when dependencies are broken

## Intent

Safeword's dependency-readiness guard must not trap the commands that diagnose
or repair the guarded dependency state. Recovery stays available without
weakening the guard for project tooling.

## Intake Brief

- **Requested by:** Safeword maintainers validating installation in Arcade monorepo worktrees
- **Cost of inaction:** A new or stale worktree can enter a repair loop where the hook blocks the Safeword command needed to finish setup or explain the problem.
- **Reversibility:** Two-way door; the exemption is a small command-classification policy with focused regression coverage.

## References

- [GitHub issue #1966](https://github.com/ArcadeAI/safeword/issues/1966)
- `.project/tickets/JNVP4W-worktree-auto-deps/ticket.md`
- `.project/tickets/UJSZXB-humanize-first-run-runtime/ticket.md`

## Personas

- Technical Builder (TBU)

The Non-Technical Builder is not a persona here: the blocked commands are typed
by a builder who reads the guard's denial message, and no NTB-triggered rule
distinguishes their experience.

## Surfaces

Affected:

- Claude Code — the dependency-readiness PreToolUse hook that classifies the command.
- Safeword CLI — the release parity check's recovery guidance.

Unaffected:

- OpenAI Codex, Cursor — neither wires the dependency-readiness PreToolUse hook, so there is no guard to exempt.
- Cursor Cloud Agents — the contract belongs to the installed command guard, not cloud lifecycle setup.

## Vocabulary

- **Recovery command:** A top-level Safeword command that converges configuration or reports enough state to choose the next repair action: `setup`, `status`, `doctor`, or `plan`.
- **Dependency-backed command:** A project tool whose reliable execution depends on the project's installed dependency tree.

## Jobs To Be Done

### keep-safeword-recovery-runnable.TBU1 — Recover without disabling the guard

**Persona:** Technical Builder (TBU)

> When project dependencies are missing or stale, I want Safeword's setup and
> diagnostic commands to remain available, so I can repair the project without
> bypassing or deleting its guardrails.

#### keep-safeword-recovery-runnable.TBU1.R1 — Safeword recovery remains reachable when dependency-backed commands are unavailable

#### keep-safeword-recovery-runnable.TBU1.R2 — The recovery exception does not make unrelated package executors runnable

#### keep-safeword-recovery-runnable.TBU1.R3 — Parity recovery guidance names a command that the current CLI supports

## Rave Moment

skip: table-stakes — recovery from an installation failure should simply work.

## Outcomes

- A builder can run setup or inspect Safeword health while project dependencies are broken.
- Project tests and other dependency-backed executables remain blocked until dependencies are repaired.
- A parity failure points to a real recovery command.

## Boundary

This slice changes only `bunx`, whose existing classifier guarded every package.
Equivalent Safeword invocations through `npx`, `pnpm dlx`, or `yarn dlx` remain
unclassified by this dependency-readiness guard and are outside this recovery
exception; this ticket neither allows nor denies them.

## Open Questions

None.
