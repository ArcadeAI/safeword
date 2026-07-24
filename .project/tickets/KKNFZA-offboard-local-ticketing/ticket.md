---
id: KKNFZA
slug: offboard-local-ticketing
type: feature
phase: intake
status: in_progress
scope:
  - Tracker is system of record for IDENTITY (issue-first; key = ticket id), provider-neutral GitHub/Linear
  - status/phase stay locally canonical in tracked ticket.md; gates read them as today (offline)
  - kill the real churn: stop last_modified-per-Stop and INDEX generation; relocate last_modified's 2 readers
  - one-way status mirror to the tracker (reuse sync-tracker, allow-listed payload)
  - tracker-key → local-folder join reader (build-new); retire dup-ID guard
  - content artifacts stay git-tracked & reviewable
  - optional non-authoritative upstream status heads-up at session boundary
  - back-compat read of existing tickets; provider:none unchanged
out_of_scope:
  - making the tracker AUTHORITATIVE for status (two-way / driving safeword) — re-introduces the trilemma
  - full field parity (assignee/priority/body two-way) — M1FGRJ
  - dependency-graph projection (sub-issues/relations/topo-sort) — M1FGRJ
  - new providers beyond GitHub/Linear (Jira/Slack)
  - rewriting BDD/TDD gate mechanics themselves
  - legacy-project workflows (per user)
done_when:
  - a session adds no per-Stop (last_modified) churn and no INDEX churn; remaining diffs are real transitions + content
  - status/phase stay locally canonical; gates pass/fail identically offline (no per-turn network)
  - identity is tracker-minted; ticket new fails safely (no orphan/dupe) when the tracker is unreachable
  - status is visible in the tracker via the one-way mirror without running safeword
  - last_modified's readers (active-ticket recency, replan) are relocated and still work
  - Cursor done-gate and CI check-pr-ticket-done still fire (status/phase remain in ticket.md)
  - existing tickets and provider:none installs are unaffected
created: 2026-06-27T21:35:47.369Z
last_modified: 2026-06-28T05:04:00.000Z
---

# Off-board local ticketing: tracker canonical for identity + status mirror; status/phase stay tracked

**Goal:** Make the tracker canonical for ticket identity and a one-way status mirror, kill the real
churn (last_modified-per-Stop + INDEX), and keep status/phase in tracked files so gates work
offline and every consumer keeps firing.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-28T05:04:00Z /figure-it-out on the durability trilemma → chose **Model B** and rewrote the
  spec. Tracker is canonical for IDENTITY + a one-way status mirror; status/phase STAY locally
  canonical in tracked ticket.md. This dissolves the trilemma (no per-turn network, no git-ignored
  durability hole, no fail-open) and preserves the Cursor done-gate / CI guard / context-anchor /
  resume / review-trigger BY CONSTRUCTION, since status/phase never leave the file. Churn target
  narrowed to last_modified-per-Stop + INDEX (the real noise); status/phase transition diffs (a few
  per ticket) are accepted as legitimate history. Evidence: GitHub/Linear ~5k req/hr; GitHub can't
  cleanly hold phase; git-bug validates local-state+bridge. Revises the earlier "tracker = system of
  record for status" decision (status: canonical→mirror). AskUserQuestion to confirm authority
  couldn't be delivered (tool stream closed) → proceeding with recommended just-show; reversible.
- 2026-06-28T04:44:00Z /quality-review (adversarial verification of the audit) — found the audit
  was INCOMPLETE + partly WRONG. Confirmed: (1) `last_modified` is functional, not just churn
  (active-ticket selection + replan baseline) → relocate, don't delete; (2) `phase` is NOT derivable
  and a git-ignored cache loses it cross-machine, inverting phase-keyed gates to FAIL-OPEN. Missed
  consumers added: pre-tool phase-diff gates, Cursor done-gate edit-trigger (gate-adapter.ts, no
  Stop fallback — parity-critical), CI check-pr-ticket-done.ts, session-compact/cursor-stop.
  Corrected my own wrong claim: statusline/reentry.ts reads re-entry.md, NOT status/phase. Added
  SM2.AC7 (cross-harness/CI consumers) + fail-closed invariant to AC3 + trigger note to AC5 + "no
  reader today" to AC6. ELEVATED a BLOCKING open question: status/phase durability trilemma
  (tracked=churn / git-ignored=not durable+fail-open / tracker-only=per-turn network). Recommend a
  focused /figure-it-out before define-behavior. Intake is NOT done until that lands.
- 2026-06-28T04:34:00Z Existing-system JTBD audit → added SM2 JTBD (6 ACs) for the must-preserve
  set: context anchor (AC1), done-invariant vs external close (AC2), local hierarchy execution
  (AC3), resume/re-entry/replan (AC4), review-ledger rekey (AC5), tracker-key→folder join key
  (AC6). Audit's two linchpins (status/phase home; join key) marked resolved in Open Questions.
  Added child ⑥ "preserve the execution workflow" to decomposition; scope + done_when updated.
  Jobs that the tracker serves better (ID minting, human index) or that survive unchanged (work
  logs, decide-to-build triage, PR-scope, backlog) need no new AC.
- 2026-06-28T04:30:00Z Applied remaining minor fixes (user asked for all): added Outcomes rows for
  INDEX-no-churn and safe-ticket-new (done_when↔Outcomes symmetry); disambiguated "legacy" in
  SM1.AC3 (reads old on-disk ID formats vs legacy-project workflows out of scope). Kicked off an
  audit of the existing ticket system's JTBDs to build a must-preserve list for the new design.
- 2026-06-28T04:27:00Z Dupe/conflict audit: fixed two real issues — (1) restored the
  Implementation-decomposition section in spec.md (the work-log pointer referenced "5 child
  tickets" but the rewrite had dropped it; now matches the content-vs-lifecycle model), (2) TB1
  JTBD "one place work is tracked" contradicted the two-plane model → reworded to "team tracks
  status in one place, work stays reviewable in the repo". Also retitled TB1.AC2 to cover both its
  claims. Accepted (not fixing): Outcomes/done_when minor asymmetry (INDEX-retire, safe-ticket-new
  are mechanisms); "legacy" appears in two senses (read legacy ID formats vs legacy-project
  workflows out of scope) — defensible. Heavy scope≈ACs≈done_when≈Outcomes overlap is the template
  by design.
- 2026-06-27T23:10:00Z /quality-review (independent reviewer + web research): GitHub & Linear both
  cap ~5k authenticated req/hr (GitHub Actions token only 1k/hr/repo) → verified support for
  "no network in per-turn loop" + session-boundary reconciliation. Fixed REQUEST-CHANGES findings:
  reframed AC2 to an observable allow-list; added TB1.AC6 (ticket-new tracker-unreachable /
  partial-create / secrets / egress) and SM1.AC4 (parallel-session runtime-cache races); added
  done_when rows for INDEX-retire and safe ticket-new; resolved A/B → PR-review default, approval
  gate deferred to a follow-up child ticket. Marked the two entries below SUPERSEDED.
- 2026-06-27T23:00:00Z Intake PIVOT (user: "avoid git-ignore on all this stuff"): dropped the
  git-ignored ephemeral-cache pillar. New model = content vs lifecycle state. Content artifacts
  (spec/design/impl-plan/test-defs/verify/work-log) stay git-TRACKED & reviewable; churn reduction
  comes from moving lifecycle state (status→tracker, phase/derived→git-ignored runtime cache) and
  killing INDEX, not from hiding files. Dissolves the re-hydration problem and persistArtifacts.
  Makes teammate review of the plan trivial (normal PR). Rewrote spec.md (TB1.AC1–AC5, SM1.AC1–AC3).
  Churn metric: "zero bookkeeping diffs" not "zero tracked files". Open: PR-review-only vs add a
  tracker-side approval gate (A/B).
- [SUPERSEDED by 23:00 pivot — describes the dropped git-ignored ephemeral-cache model]
  2026-06-27T22:52:00Z Intake: resolved artifact routing (TB1.AC5–AC7). Durable prose
  (spec/design) → docs path via persistArtifacts, never tracker. Gate-fuel (test-definitions,
  verify, impl-plan, dimensions) → ephemeral, never projected raw. Work log → local; summary to
  issue at Stop only. Legacy projects out of scope (user) → dropped legacy test-def carve-out.
- [SUPERSEDED by 23:00 pivot — "ephemeral cache" no longer the model] 2026-06-27T21:40:00Z Intake:
  wrote spec.md (intent, intake brief, 2 JTBDs / 8 ACs, outcomes) and set engineering scope.
  Decision via /figure-it-out: off-board coordination plane to tracker, demote execution plane to
  ephemeral cache. Decomposition (5 child tickets) in spec.md.
- 2026-06-27T21:35:47.369Z Started: Created ticket KKNFZA
