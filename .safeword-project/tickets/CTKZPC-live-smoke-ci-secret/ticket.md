---
id: CTKZPC
slug: live-smoke-ci-secret
type: task
phase: intake
status: backlog
created: 2026-06-05T15:02:30.310Z
last_modified: 2026-06-05T15:02:30.310Z
---

# Wire test:smoke:live into CI + provision an Anthropic API key secret

**Goal:** Run safeword's live real-model smoke (`test:smoke:live`) automatically in CI — on-demand and/or nightly — so the one test that proves a real Claude agent gets steered isn't manual-only.

**Why:** `test:smoke:live` (ticket 0WQA9V) is the _only_ test that runs real Claude Code and confirms safeword's hooks steer a live agent — and it's also the fidelity check that the deterministic tiers' hand-fed event JSON still matches what real Claude sends. Today it only runs when a human runs `bun run test:smoke:live` locally with a key, so a real-agent-steering regression (a Claude Code update breaks hook firing; the event schema drifts) would not be caught automatically.

## Findings (2026-06-05)

- No repo-level secret: `gh secret list` is empty.
- No existing workflow references `ANTHROPIC` / `CLAUDE_*` / a key secret.
- Org-level secrets unverifiable from here (`gh secret list --org ArcadeAI` → HTTP 403, needs org admin) — but since no workflow consumes one, CI effectively has no Anthropic key today.

## Scope

- **Provision the secret** (the blocker): add `ANTHROPIC_API_KEY` (or an org-scoped equivalent) as a secret available to this repo's GitHub Actions. **Org/repo-admin action** — can't be done from the CLI.
- **Add `.github/workflows/smoke-live.yml`**: `workflow_dispatch` (manual "Run workflow") plus optionally a nightly `schedule`. Steps: checkout → bun + build (`dist` for nothing here, but `tsup` keeps parity) → install a **pinned** claude via `curl -fsSL https://claude.ai/install.sh | bash -s <version>` → run `ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }} bun run test:smoke:live` (the test resolves `claude` on PATH and skips if absent).
- Keep cost bounded: the test already pins Haiku + `--max-budget-usd 0.10` and is a single ~1.5¢ run.

## Out of scope

- Running the live tier on **every PR** — it spends tokens; keep it on-demand / scheduled only.
- The Phase-0 _guidance-drift_ eval harness (separate, statistical, not a binary test).
- Changing the test itself — `test:smoke:live` is built and verified (0WQA9V); this is pure CI plumbing + a secret.

## Done when

- An Anthropic key secret is available to this repo's Actions.
- A manual `workflow_dispatch` run of `smoke-live` is **green** in CI (real agent → intake-phase gate denied).
- The live tier does **not** run on normal PRs (no token spend on routine CI).

## Related

- **0WQA9V** (the smoke test itself — fast/e2e/live tiers + drift guard, merged). This ticket finishes its one out-of-scope item.

## Work Log

- 2026-06-05T15:02:30.310Z Started: Created ticket CTKZPC
- 2026-06-05T15:02:30.310Z Filed (backlog): out-of-scope follow-up from 0WQA9V. CI has no Anthropic key today (no repo secret; no workflow consumes one; org secrets need admin to verify). Blocked on secret provisioning (org/repo admin). Proceeding manual-only (`bun run test:smoke:live` with a local key) until this lands. Sized **task** (CI workflow + a secret; no product behavior).
