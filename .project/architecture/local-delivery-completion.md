# Local delivery completion extension

**Status:** Accepted
**Date:** 2026-09-18
**Ticket:** `PY73VN`

- **What:** Before a supported local agent runs `gh pr ready` or a
  ready-by-default `gh pr create` (including its documented `gh pr new` alias),
  the local shell hook rechecks the resolved ticket and its verification artifact and can block the command. Verified ticket closure writes one ignored, worktree-local `readiness-ticket.json` receipt bound to the
  full current HEAD. Active ticket state takes precedence over recent completed
  session state, which takes precedence over the durable receipt. Draft creation
  remains available for CI and review evidence. Claude Code, OpenAI Codex, and
  Cursor use the same evaluator through native adapters.
- **Why:** The [remote readiness status](deterministic-readiness-evidence-status.md) can prove that PR-body evidence is current,
  but it cannot prevent a local agent from requesting review before delivery is
  complete. Ticket status, `verify.md`, and local HEAD are readable at the
  irreversible command boundary, so the shell hook can enforce this rule before the command runs.
- **Trade-off:** The receipt restores one temporary, schema-owned file inside the project namespace. It survives agent sessions in one worktree
  but not another clone or worktree, and any later commit invalidates it until
  verification runs again. Shell wrappers that hide `gh` in nested command
  text, the web UI, `gh api`, direct REST/GraphQL, and cloud-agent mutations
  remain outside this local boundary. The remote freshness observer remains
  separate and unchanged.
- **Alternatives considered:** Guidance alone was rejected because it is
  bypassable. Blocking every PR command was rejected because Draft evidence is
  part of delivery. Profile-global state was rejected because it crosses
  worktree identity. Reusing the remote PR-body status was rejected because it
  observes a different trust boundary and cannot validate local ticket closure.
- **Implementation:** `packages/cli/templates/hooks/lib/pr-readiness-guard.ts`,
  `packages/cli/templates/hooks/pre-tool-quality.ts`,
  `packages/cli/templates/hooks/post-tool-quality.ts`, generated host adapters,
  schema registration, and the `pr-readiness-*` plus
  `delivery-continuation-contract` tests.
- **Reassess when:** GitHub adds another first-class Ready mutation, a supported
  host loses its blockable local shell boundary, or readiness must transfer
  across worktrees or machines.
