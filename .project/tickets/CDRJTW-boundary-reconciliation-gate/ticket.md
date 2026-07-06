---
id: CDRJTW
slug: boundary-reconciliation-gate
type: feature
phase: intake
status: in_progress
epic: "808"
external_issue: https://github.com/ArcadeAI/safeword/issues/810
scope:
  - "Reconciliation engine: a pure module composing the existing checks over a set of ticket artifacts — phase legality incl. at-rest born-past-intake (#675 via evaluateTicketWrite/evaluateBirth logic), anchor presence/format + (with resolver) reachability of the ENTERED phase only (detectUnanchoredPhaseTransition/State, #809 seam), ledger validation (validateLedger + createLedgerShaResolver), verify.md shape (checkVerifyArtifact), impl-plan shape (parseImplPlan). Reuse, never duplicate."
  - "CLI command `safeword boundary --at commit|push`: resolves which ticket artifacts are in the staged diff (commit) or outgoing range (push), runs the tier-appropriate checks — commit = pure/content-only (sub-second budget); push = + git-resolver checks — prints warnings, exits 0 ALWAYS."
  - "Audit record: append one JSONL entry per run (boundary, timestamp, HEAD, per-check verdicts) to `.safeword/boundary-audit.jsonl` (gitignored; jsonl-spool pattern). Silent no-op (no entry, no output) when no ticket artifacts are in the change."
  - "Dogfood wiring: one-line steps in this repo's .husky/pre-commit and .husky/pre-push invoking the command (shim pattern — logic stays versioned in the CLI)."
  - "Friction-register constraints as tests: entered-phase-only anchor demand (commitless multi-phase tolerated), rebase-canonicalized SHAs verify, re-advance last-wins pinned, prior-HEAD anchor semantics documented in the command's output/help."
  - "templates↔.safeword parity green; gitignore entry for the audit record."
out_of_scope:
  - "Host-repo installation (setup/upgrade emitting hook wiring, husky/lefthook/bare detection, core.hooksPath handling) — child ticket 2 of #810."
  - "Server-side required check (`--at pr` profile, workflow template, hard-block tiering, ruleset enablement docs) — child ticket 3 of #810; slice 1's exit-0 rule is absolute."
  - "Artifact precedence (#676) and impl-plan-authored-before-code timing (#666) — no existing implementation, git-archaeology false-positive traps (mtimes lie, squashes collapse order); deferred to a follow-up after the engine exists."
  - "Skill-invocation / review-stamp verification at the boundary — session-scoped local logs are not committed evidence; they physically cannot cross the push boundary and stay write-time/Stop-tier concerns."
  - "Blocking anything: no exit-1 path exists in this slice, no --strict flag, no config to make local blocking possible (prevents --no-verify culture before the server tier exists)."
  - "Running tests / evaluateDoneEvidence at any git boundary — minutes-class work is CI's job per hook-perf budgets."
out_of_scope_note: "Rejected during design: standalone hook scripts (three hook-manager worlds need one-line shims over versioned logic); trusting the local audit record as evidence (forgeable — server tier re-derives from committed artifacts instead); monolithic all-of-#810 ticket (verifiability and blast radius)."
done_when:
  - "`safeword boundary --at commit` over a staged change touching ticket artifacts prints per-check verdicts for the content-tier checks and appends an audit entry; exit 0 even with findings (command-tested against fixture repos)."
  - "`safeword boundary --at push` additionally verifies anchor + ledger SHAs against reachable history via the injected resolver, honoring rebase canonicalization and entered-phase-only (command-tested with a real temp git repo)."
  - "A change with no ticket artifacts produces no output, no audit entry, exit 0, sub-second (tested)."
  - "The at-rest born-past-intake gap (#675) is detected at the boundary (unit + command test)."
  - ".husky/pre-commit and .husky/pre-push in this repo invoke the command (dogfood; visible in a real commit of this ticket's own work)."
  - "Audit entries accumulate in .safeword/boundary-audit.jsonl and the file is gitignored."
  - "Full /verify + /audit pass; verify.md written; parity green."
created: 2026-07-06T04:17:13.186Z
last_modified: 2026-07-06T04:17:13.186Z
---

# Boundary reconciliation gate — engine + local hook (slice 1 of #810)

**Goal:** Re-run the workflow's evidence checks at commit and push — the moments a session cannot skip — warn-and-record through one versioned CLI command, dogfooded on safeword's own repo.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Design Decisions (from /figure-it-out, 2026-07-06)

- **D1 — one CLI command, thin shims** (`safeword boundary --at commit|push`): the only shape surviving husky's core.hooksPath world, lefthook, and bare git is a one-line shim over versioned logic (commitlint/gitleaks pattern). Rejected: standalone hook scripts (three divergent code paths).
- **D2 — slice 1 = engine + command + dogfood**: #810 is three coupled stories (engine/local, host install, server-side) with descending verifiability from a cloud session; slice 1 is independently valuable and live-tests the engine on safeword itself before any customer.
- **D3 — defer #676/#666, include #675**: the deferred two have no existing implementation and known git-archaeology false-positive traps; born-past-intake at rest is nearly free.
- **D4 — audit record is context, not evidence**: `.safeword/boundary-audit.jsonl`, gitignored like all transient state. Its forgeability is irrelevant because nothing trusts it — the future server tier re-derives from committed artifacts, which also cleanly bounds what can ever hard-block.
- **Tier budgets from research**: pre-commit sub-second (pure checks only), pre-push may touch git subprocess, minutes-class stays in CI. The TB promise ("never block hand-written commits") is enforced structurally: no exit-1 path exists.

## Work Log

- 2026-07-06T04:17:13.186Z Started: Created ticket CDRJTW
- 2026-07-06T04:45:00.000Z Intake: framed via explorer map (7 folded checks: all pure cores exist; #675/#676/#666 net-new; husky-emission seam dormant; check-pr-ticket-done is CI beachhead) + /figure-it-out (D1–D4 above) + hook-perf and rulesets research. spec.md authored + self-reviewed (leak fixed, re-stamped).
