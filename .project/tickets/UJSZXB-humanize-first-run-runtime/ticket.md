---
id: UJSZXB
slug: humanize-first-run-runtime
parent: K6CAJN-ntb-experience-epic
type: task
phase: intake
status: backlog
created: 2026-06-21T14:24:00Z
last_modified: 2026-06-21T14:24:00Z
---

# Humanize first-run runtime and dependency failures

**Goal:** Make the first thing an NTB can hit — a missing-bun or deps-not-installed block — readable and safety-framed instead of a shell-jargon wall.

**Why (audit H2):** `hooks/session-bun-check.sh:14-20` exits non-zero with "not found in PATH… quality gates inactive… `curl -fsSL https://bun.sh/install | bash`"; `hooks/pre-tool-dependency-readiness.ts` denies with "dependencies are not installed in this worktree. Run `bun ci`." These fire on stderr / permission-deny before the agent reliably translates, and `/explain` is unreachable because the runtime that powers it is the missing piece. Highest single point of NTB abandonment, at the worst moment.

## Scope sketch

- Give each failure a plain-English lead + safety framing ("Safeword needs a small one-time tool called **bun** to run its safety checks — here's the one command"). Drop or gloss "PATH", "worktree", "ci".
- Consider a `setup`-time preflight so the NTB meets this in prose, not mid-session stderr.
- Files: `session-bun-check.sh`, `pre-tool-dependency-readiness.ts` / `session-dependency-readiness.ts`, message helpers in `hooks/lib/` — templates + byte-identical dogfood copies.
- Out of scope: changing what the checks require (bun is still required); only the messaging + optional preflight.

## Work Log

- 2026-06-21T14:24:00Z Created from PRODUCT-AUDIT-ntb.md H2.
