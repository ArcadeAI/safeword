# Ticket 2YZDKQ - versioning skill surface decision

## 2026-06-14

- Started from clean branch `codex/agent-surface-refactor-followups`.
- Read AGENTS.md, .safeword/SAFEWORD.md, planning/testing guides, ticket-system skill, epic S3T6JA, and ticket 2YZDKQ.
- Evidence: `.claude/skills/versioning/SKILL.md` has `audience: maintainer`; no matching template/Codex/Cursor skill exists.
- Evidence: `packages/cli/tests/schema.test.ts` explicitly exempts maintainer-only skills from the local-skill-to-template drift test.
- Evidence: `.safeword/hooks/session-auto-upgrade.ts` and `packages/cli/tests/utils/version.test.ts` reference the versioning policy as release/auto-upgrade maintainer policy.
- Decision: keep `versioning` Claude-local maintainer-only; do not promote it into generated shared skill manifests unless a future ticket changes release tooling ownership.
