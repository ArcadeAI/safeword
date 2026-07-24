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

**Related edge (from PR #548 audit, deferred here):** re-adopting an already-adopted key with a
**different slug** (`ticket new newslug --issue ENG-45` after `ticket new oldslug --issue ENG-45`)
is not guarded — the differing folder name dodges the EEXIST collision check, so a second local
folder is created for the same tracker key and the map entry is repointed to it. Same coherence
family as the orphan (tracker-map ↔ local folders drift); a reconcile/`check` pass that detects
"two local folders claim one issue" belongs with this work. Low severity (user-error, no data
loss), so it rides along here rather than gating the PR.

**Exotic `--issue` inputs (from PR #548 /quality-review, deferred):** the adopt key normalizer
strips one leading `#` but does not trim surrounding whitespace, so `--issue ' #4'` adopts the
literal `' #4'` and `--issue '##5'` adopts `'#5'` — neither matches a bare numeric id the GitHub
create path can mint (`/^\d+$/`), so they can never join to a real synced issue. Exotic (CLI args
need quoting to carry a leading space) and low severity; trim + collapse at the adopt boundary
when this ticket hardens key handling.

## Work Log

- 2026-06-28T15:11:43.896Z Started: Created ticket 01EAKC (follow-up from DGH59K Decision C)
- 2026-06-29T00:00:00.000Z Noted the re-adopt-different-slug duplicate edge (PR #548 audit, deferred)
