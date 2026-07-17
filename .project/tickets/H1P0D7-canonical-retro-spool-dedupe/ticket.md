---
id: H1P0D7
slug: canonical-retro-spool-dedupe
type: feature
phase: verify
status: in_progress
external_issue: https://github.com/ArcadeAI/safeword/issues/1031
scope: Preserve a code-derived canonical identity in new retro spool records; direct the cloud filer to check exact legacy then canonical markers; preserve legacy spool compatibility; pin the transport contract in spool and agent-definition tests.
out_of_scope: Fuzzy or title-based issue matching, changing direct CLI triage, GitHub MCP implementation, and altering issue-body assembly.
done_when: A spooled draft with a canonical identity is acknowledged against an open issue with that exact canonical marker rather than opening a duplicate; an old spool record without canonical metadata continues legacy signature-only behavior; the shipped Claude/Cursor and Codex filer definitions and the executable spool reference share that contract.
phase_anchors:
  - "define-behavior: .project/tickets/H1P0D7-canonical-retro-spool-dedupe/spec.md"
  - "plan-implementation: .project/tickets/H1P0D7-canonical-retro-spool-dedupe/impl-plan.md"
  - "implement: .project/tickets/H1P0D7-canonical-retro-spool-dedupe/impl-plan.md"
created: 2026-07-16T20:30:38.408Z
last_modified: 2026-07-16T20:30:38.408Z
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
