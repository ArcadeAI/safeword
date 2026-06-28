---
id: KKNFZA
slug: offboard-local-ticketing
type: feature
phase: intake
status: in_progress
scope:
  - Tracker becomes system of record for identity + status (provider-neutral, GitHub/Linear)
  - issue-first ticket creation; status transitions written to the issue
  - lifecycle state (status/phase/last_modified, INDEX) leaves tracked files → tracker + git-ignored runtime cache
  - content artifacts (spec/design/impl-plan/test-definitions/verify/work-log) stay git-tracked & reviewable
  - retire INDEX generation and dup-ID guard when tracker is canonical
  - session-boundary status reconciliation (issue = read-authority)
  - back-compat read of existing tickets; provider:none unchanged
  - PRESERVE local execution jobs (audit): context anchor, done-invariant vs external close, blocked_on/cascade/next-nav, resume/re-entry/replan, review-ledger rekey, tracker-key→folder join key
out_of_scope:
  - full field parity (assignee/priority/body two-way) — M1FGRJ
  - dependency-graph projection (sub-issues/relations/topo-sort) — M1FGRJ
  - new providers beyond GitHub/Linear (Jira/Slack)
  - live per-turn two-way sync
  - rewriting BDD/TDD gate mechanics themselves
  - legacy-project workflows (per user)
done_when:
  - with a tracker connected, a full create→work→close session adds zero bookkeeping diffs (no status/phase/last_modified rewrites, no INDEX)
  - content artifacts stay tracked and reviewable in a normal PR
  - identity + status are observable in the tracker without running safeword
  - gates pass/fail identically offline (no per-turn network)
  - INDEX generation and the dup-ID guard are retired when the tracker is canonical
  - ticket new fails loudly and leaves no orphan/duplicate when the tracker is unreachable
  - existing tickets and provider:none installs are unaffected
  - loop-prevention context anchor still derives from local state with no per-turn network
  - "never done without user confirmation" survives an external issue close
  - blocked_on gate, parent cascade, next-ticket nav, and cross-session resume still work locally
created: 2026-06-27T21:35:47.369Z
last_modified: 2026-06-27T23:10:00.000Z
---

# Off-board local ticketing: external tracker as system of record, local artifacts stay tracked

**Goal:** Make the customer's tracker canonical for ticket identity + status and move lifecycle
bookkeeping (status/phase rewrites, INDEX) off the repo, while content artifacts stay git-tracked
and reviewable and gates keep reading local files.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

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
