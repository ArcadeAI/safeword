---
id: 36EEMY
slug: pr-review-distribution
type: feature
phase: intake
status: in_progress
depends_on: [G5337S, CWGYH0]
scope:
  - GitHub Action workflow template wrapping `anthropics/claude-code-action@v1` (v1.0.174 current, verified 2026-07-15).
  - Auth: WIF (GitHub OIDC, no static secret) preferred; `claude_code_oauth_token` / `anthropic_api_key` fallbacks.
  - Trigger gating — `ready_for_review` / `label_trigger` (a native input, default "claude"), NOT every `synchronize`. Noise AND cost control.
  - Fork-PR safety: no write credential while reading untrusted content; vendor pattern is base ref at workspace root, PR head in a subdirectory via `--add-dir`; never check an untrusted ref into the workspace root under `pull_request_target`.
  - Dynamic subtraction: detect the project's existing quality surface — linters, types, tests, AND peer AI reviewers (arcade already runs Cursor Bugbot) — and review only the gap.
  - `safeword setup` distribution: ownedFiles in schema.ts, template↔dogfood parity pairs.
  - Kill switch + per-project trust calibration in `.safeword/config.json` (Tricorder precedent).
out_of_scope:
  - The review judgment itself — G5337S.
  - A required status check / hard block. Warn-mode only (precedent: done-flip guard #460 held to warn-mode).
  - A server/daemon — claude-code-action runs on the customer's runners.
done_when:
  - A customer repo gets the reviewer from `safeword setup` with no hand-editing.
  - A fork PR carrying injected instructions is reviewed without those instructions taking effect and without a write token.
  - Nothing Bugbot or the project's CI already reports is surfaced again.
  - The reviewer can be disabled by config without deleting the workflow.
scope:
out_of_scope:
done_when:
parent: WAWQA6
created: 2026-07-15T14:24:45.733Z
last_modified: 2026-07-15T14:24:45.733Z
---

# pr-review-distribution

**Goal:** Ship the reviewer into a customer repo: workflow template, ownedFiles, config + kill switch, trigger gating, fork-PR safety. Serves TB1's delivery.

**Why:** Arcade is customer #1 of many, so the reviewer has to arrive as a product rather than a bespoke workflow. Fork-PR injection only becomes real at customer scale — safeword's own repo is 37/40 self-authored, so it never surfaced there.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-07-15T14:24:45.733Z Started: Created ticket 36EEMY
