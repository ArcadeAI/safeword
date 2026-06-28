---
id: 01EAKC
slug: surface-orphan-tracker-issues
type: task
phase: intake
status: blocked
epic: offboard-local-ticketing
parent: KKNFZA
depends_on: [DGH59K]
created: 2026-06-28T15:11:43.896Z
last_modified: 2026-06-28T15:11:43.896Z
---

# Surface orphaned tracker issues (created issue, no local ticket)

**Goal:** Detect and surface tracker issues that safeword created but whose local ticket never
landed (a partial-create crash between issue-create and recording), so the rare orphan isn't lost.

**Why:** The DGH59K Decision C accepts that issue-first `ticket new` does not auto-reconcile a
partial-create crash (no local id exists pre-issue; auto-reconcile adds scope + ambiguity). The
safety net is detection, not reconciliation: an issue with safeword's create-signature but no
matching local folder / tracker-map entry should be surfaced (e.g. via `safeword check` or the
optional upstream heads-up KKNFZA SM1.AC2), where the user links or closes it.

**Scope note (from DGH59K /quality-review):** the partial-create window was narrowed — a `pending`
tracker-map entry is now written before the local folder, so any folder on disk implies a map
entry (`sync-tracker` reconciles, no double-create). The residual orphan this ticket must surface
is therefore the **no-local-footprint** shape: an issue minted on the tracker with **no** local
folder and **no** map entry (process killed between the tracker create and the first local write).
Detection must scan the tracker side (issues bearing safeword's create-signature) against local
tickets, since there is nothing local to key off.

## Work Log

- 2026-06-28T15:11:43.896Z Started: Created ticket 01EAKC (follow-up from DGH59K Decision C)
