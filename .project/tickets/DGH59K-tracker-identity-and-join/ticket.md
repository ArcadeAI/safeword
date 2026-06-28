---
id: DGH59K
slug: tracker-identity-and-join
type: feature
phase: implement
status: in_progress
epic: offboard-local-ticketing
parent: KKNFZA
scope:
  - ticket new is issue-first when a tracker is connected: tracker mints the key, it becomes the ticket id, the local folder is keyed to it
  - degrade safely: tracker unreachable → fail loud, no orphan folder; partial-create (issue minted, record failed) → reconcile, never duplicate
  - tracker-key → local-folder join reader: resolve a ticket's folder from its tracker key (not only the {ID}-{slug} prefix)
  - provider:none → identity is local exactly as today (back-compat)
out_of_scope:
  - status/phase home, churn removal, INDEX retire, status mirror (other KKNFZA children)
  - dependency-graph projection / field parity (M1FGRJ)
  - tracker write payload semantics beyond minting identity (epic TB1.AC5 child)
done_when:
  - with a tracker connected, ticket new creates/adopts the issue first and keys the folder to the issue key
  - tracker-unreachable leaves no orphan folder; a re-run after partial-create reconciles to the same issue (no duplicate)
  - a hook can resolve the local folder for a ticket from its tracker key (clean not-found on miss)
  - provider:none ticket new behaves exactly as today (local id), proven by an unchanged-path test
created: 2026-06-28T05:18:39.762Z
last_modified: 2026-06-28T05:18:39.762Z
---

# Issue-first ticket identity + tracker-key→local-folder join reader

**Goal:** Make ticket identity tracker-minted (issue-first, folder keyed to the issue) and add the
reader that resolves a ticket's local folder from its tracker key — KKNFZA TB1.AC1 + SM2.AC6.

**See:** parent epic [../KKNFZA-offboard-local-ticketing/spec.md](../KKNFZA-offboard-local-ticketing/spec.md);
scenarios in [./test-definitions.md](./test-definitions.md); feature source
`features/tracker-identity-and-join.feature`.

## Work Log

- 2026-06-28T15:02:00Z implement: issue-first core GREEN (b38565c). createIssueFirstTicket mints
  identity (injected source = network boundary) before any folder; failed mint → no orphan.
  Extracted writeTicketContents (shared local + issue-first). Covers TB1.AC1.connected_mints +
  TB1.AC2.unreachable_fails_no_orphan. Remaining figureable (command wiring): provider routing
  (no_tracker vs issue-first), adopt (--issue), credential degrade + secret redaction.
  BLOCKER reached → TB1.AC2.partial_create_reconciles: see decision note below; need product call
  on the idempotency mechanism before building it (and it shapes the create flow).
- 2026-06-28T05:40:00Z implement: SM1.AC1 join reader GREEN (58d70c8). resolveFolderByTrackerKey
  (tracker-sync/resolve-by-key.ts) + TrackerMap.findTicketIdByRefId; 5 unit tests (known, both key
  shapes, id≠key legacy, unknown, stale) pass. Not-found sentinel = undefined (package lint
  unicorn/no-null; feature/ledger wording aligned). 4 SM1.AC1 ledger scenarios checked off.
  Next: TB1.AC1 issue-first `ticket new` (command-level @wiring, inject tracker client).
- 2026-06-28T05:25:00Z scenario-gate PASS (independent review, 2 rounds — round 1 CHANGES-REQUIRED
  4 must-fix/4 should-strengthen, all applied; round 2 PASS, 0 blockers). Stamp recorded for
  scenario-gate. Advanced to implement.
  Proof plan / sequencing (outside-in TDD):
    1. SM1.AC1 join reader (unit) FIRST — pure resolver tracker-key→folder over external_issue /
       tracker-map; other epic children depend on it. Scenarios: known_key, both_key_shapes,
       unknown_key (null sentinel), stale_map_entry.
    2. TB1.AC1 issue-first `ticket new` (command-level @wiring: real command + real ticket-writer/fs,
       inject tracker client mocking only the network) — connected_mints (count+emptiness),
       existing_issue adopt (--issue), no_tracker characterization.
    3. TB1.AC2 degrade paths — unreachable, rejected/missing credential (secret redaction),
       partial-create reconcile via pending tracker-map entry.
- 2026-06-28T05:19:00Z define-behavior: wrote child spec.md (JTBD TB1 + SM1) and dimensions.md;
  set scope/done_when; linked to epic KKNFZA. Drafting scenarios next.
- 2026-06-28T05:18:39.762Z Started: Created ticket DGH59K
