---
id: GH628F
slug: retro-filer-subagent-gate
type: feature
phase: done
status: done
parent: RV9JT4-retro-transcript-mining
depends_on: [BNGK9W, CDX602]
external_issue: https://github.com/ArcadeAI/safeword/issues/628
scope: |
  Make cloud retro filing reliable and invisible: at Stop, when unfiled retro
  drafts exist, each harness's sanctioned continuation channel (Claude
  decision:"block", Codex decision:"block" continuation, Cursor followup_message)
  dispatches ONE action — invoke the shipped `safeword-retro-filer` subagent with
  the spool path. The subagent (own context; parent sees only a one-line summary)
  reads the spool, dedups by signature/title, files verbatim to ArcadeAI/safeword
  (5-issue cap), and drains the spool as the ack. The gate retries until the spool
  drains, capped at 2 attempts per batch, then degrades to the existing muted
  UserPromptSubmit nudge. Design decided on issue #628 (figure-it-out pass +
  maintainer steers: subagent filing, uniform across harnesses, invisibility).
out_of_scope: |
  - Fixing resolveGitHubToken token-shape validation (#634, separate).
  - Signature dedupe false-miss on same friction (#628 "related data point").
  - The final-turn async extraction gap on Claude (accepted residual, in #628).
  - Background subagent dispatch (foreground only; notifications re-open turns).
done_when: |
  - A session with unfiled spooled drafts gets, at its next Stop, a single
    continuation instructing exactly one dispatch to safeword-retro-filer with
    the spool path — on Claude via decision:block, Codex via decision:block,
    Cursor via followup_message (yielding to quality-review/architecture nudges).
  - The gate fires at most twice per unfiled batch (attempt marker), never when
    the spool is drained, resets when the batch gains a draft, and honors
    selfReport.file=false and stop_hook_active.
  - safeword-retro-filer definitions ship to .claude/agents/, .cursor/agents/
    (markdown) and .codex/agents/ (TOML) via the template install machinery, with
    the filing procedure (dedup, verbatim, cap, drain-as-ack, can't-file fallback,
    one-line summary, silence contract) in the agent prompt.
  - self-report-filing.md documents subagent-primary filing with drain-as-ack;
    the muted nudge mentions the filer agent, still statement-phrased.
created: 2026-07-03T03:08:00Z
last_modified: 2026-07-03T03:08:00Z
---

# Retro filer subagent gate: reliable, invisible cloud filing

**Goal:** Spooled retro findings get filed to the upstream tracker without human
intervention and without polluting the user's conversation (visually or in
context).

**Why:** In cloud sessions — the majority case — the REST transport can't
authenticate and the muted fire-once nudge is routinely ignored, so findings sit
unfiled until a human intervenes or the container is reclaimed (#628).

**GitHub:** [#628](https://github.com/ArcadeAI/safeword/issues/628) — problem
statement, design decision, and refinements are in the issue comments.

## Work log

- 2026-07-03: Design converged on #628 (Stop-gate dispatch → foreground
  safeword-retro-filer subagent on all three harnesses; drain-as-ack; 2-attempt
  cap). Implementation started on branch claude/github-issue-628-nm8qf1.
- 2026-07-03 (verify): /verify + /audit run for real. Full `bun run test` caught
  two regressions the targeted rings missed — agent defs were in managedFiles
  (reset left `.cursor/` behind) and stop-retro-filing.ts lacked a smoke
  exemption. Both fixed (5c953b6). Cross-scenario refactor deduped the draft
  fixture (8 files → tests/helpers, 8e9efcf). BDD lane 181/181, typecheck +
  eslint + depcruise + sync-config clean; knip/jscpd findings are pre-existing
  baseline. Session-process audit filed as #644.
- 2026-07-03: Implemented. New `lib/retro-filing-gate.ts` (decision + attempt
  marker + dispatch text), new Claude `stop-retro-filing.ts` (sync, decision:block)
  wired in SETTINGS_HOOKS.Stop, codex/stop.ts post-extraction gate (architecture
  nudge keeps precedence), cursor/stop.ts filing-over-nudge priority, filer agent
  definitions shipped to .claude/.cursor (md) + .codex (toml), guide rewritten
  (subagent-primary, drain-as-ack), nudge mentions the filer. Tests: unit gate
  suite + integration suites for all three adapters green; typecheck clean;
  targeted setup/reset/check/retro suites green. R/G/R ledger fully checked.
- 2026-07-03 (done): PR #659 merged to main (42d0772). Verify/audit/quality-review
  stamps logged; follow-ups tracked in #658 (GH644A) and #634.
