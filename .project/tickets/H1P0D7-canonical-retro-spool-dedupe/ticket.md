---
id: H1P0D7
slug: canonical-retro-spool-dedupe
type: feature
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1031
scope: Preserve a code-derived canonical identity in new retro spool records; direct cloud filing to check exact legacy then canonical markers; preserve legacy spool compatibility; pin the transport contract in spool, Claude/Cursor filing carriers, and Codex plugin-skill tests.
out_of_scope: Fuzzy or title-based issue matching, changing direct CLI triage, GitHub MCP implementation, and altering issue-body assembly.
done_when: A spooled draft with a canonical identity is acknowledged against an open issue with that exact canonical marker rather than opening a duplicate; an old spool record without canonical metadata continues legacy signature-only behavior; the shipped Claude/Cursor filing carriers, packaged Codex filer skill, and executable spool reference share that contract.
phase_anchors:
  - "define-behavior: .project/tickets/H1P0D7-canonical-retro-spool-dedupe/spec.md"
  - "plan-implementation: .project/tickets/H1P0D7-canonical-retro-spool-dedupe/impl-plan.md"
  - "implement: .project/tickets/H1P0D7-canonical-retro-spool-dedupe/impl-plan.md"
  - "verify: .project/tickets/H1P0D7-canonical-retro-spool-dedupe/test-definitions.md"
created: 2026-07-16T20:30:38.408Z
last_modified: 2026-07-21T22:02:00Z
---

# Keep cloud-spooled retro filing from bypassing duplicate checks

**Goal:** Ensure cloud-spooled retro drafts use the same exact canonical duplicate check as direct CLI filing.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-16T20:30:38.408Z Started: Created ticket H1P0D7
- 2026-07-16T20:35:00Z Intake: loaded Safeword Maintainer persona, retro vocabulary, and cloud/runtime surfaces. The user explicitly asked to tackle #1031 through full BDD, so the JTBD, Rules, and scope gates were auto-confirmed for this autonomous run.
- 2026-07-16T20:35:00Z Decided: new JSONL records carry optional code-owned canonicalSignature; legacy records retain signature-only lookup. The agent searches exact markers in legacy-first order and never guesses by title.
- 2026-07-16T20:50:00Z Defined and reviewed: eight atomic scenarios cover current/legacy spool compatibility, legacy-first precedence, exact canonical fallback, title/PR/closed-candidate rejection, and both shipped filer definitions. Four fresh independent reviews found and closed the initial gaps; final verdict APPROVE.
- 2026-07-16T21:25:00Z Planned: independent plan review identified canonical-field/body-marker tampering as a load-bearing integrity condition. The plan now requires canonical fallback only when that exact code-owned marker agrees; a follow-up review confirmed the design and required executable mismatch cases during implementation.
- 2026-07-17T08:55:00Z Verified: focused retro tests, lint/typecheck, build, Cucumber, dependency audit, parity, and a fresh quality re-review pass. The full Vitest wrapper reproduced its known local idle hang after startup; direct lanes are recorded in verify.md.
- 2026-07-21T21:50:00Z Replanned after rebasing through #993: Codex plugins package skills and hooks but not custom agents. The obsolete Codex agent-template assertion is replaced by a packaged `retro-filer` skill plus a Codex-specific Stop continuation; Claude/Cursor retain their isolated filer agent.
- 2026-07-21T22:02:00Z Implemented: added the canonical `retro-filer` skill, generated it into the Codex plugin, routed the Codex Stop continuation to that skill, and updated the shared inline fallback to exact legacy-first canonical matching. Focused Vitest is queued behind an unrelated idle full-suite process; lint, typecheck, BDD, formatting, generator parity, and dispatch smoke pass locally.
