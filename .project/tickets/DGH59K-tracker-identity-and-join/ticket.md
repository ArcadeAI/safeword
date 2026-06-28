---
id: DGH59K
slug: tracker-identity-and-join
type: feature
phase: define-behavior
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

- 2026-06-28T05:19:00Z define-behavior: wrote child spec.md (JTBD TB1 + SM1) and dimensions.md;
  set scope/done_when; linked to epic KKNFZA. Drafting scenarios next.
- 2026-06-28T05:18:39.762Z Started: Created ticket DGH59K
