# Spec: Retro records filing-time provenance for reconciliation against merged state

## Intent

Retro files issues eagerly at Stop events, mid-development, and never looks back — so an issue filed from an intermediate session state stays open even when the same session's PR merges with the behavior fixed or intentional. Nothing records *what code state* a finding was captured against, so separating "still broken" from "already fixed" costs git-log archaeology. Record commit provenance with every encounter, and add a reconcile sweep that flags open retro issues whose surface changed since their last recorded encounter as possibly-resolved.

## Intake Brief

- **Requested by:** the retro pipeline itself (auto-filed upstream issue #791); motivated by four concrete stale issues (#707, #708, #710, #766) that each needed manual archaeology to close; triaged by the maintainer (alex@arcade.dev).
- **Cost of inaction:** every development-session retro keeps minting issues that describe pre-fix intermediate states; triage cost grows with retro adoption; stale noise erodes trust in the retro tracker signal, which undermines the whole self-report loop.
- **Reversibility:** two-way door. Provenance is additive JSON fields in the code-assembled ledger comment (parseLedger already coerces unknown/missing fields safely); the reconcile sweep only comments/labels — it never closes anything — so switching it off leaves no damage.

## References

- Upstream issue: ArcadeAI/safeword#791
- `packages/cli/src/retro/ledger.ts` — occurrence ledger (sessionId/harness/manifestation today)
- `packages/cli/src/retro/triage.ts` — filing + recurrence bumps
- `packages/cli/src/commands/retro.ts` — CLI wrapper (runs in the project directory; can resolve HEAD)
- `packages/cli/src/retro/github-rest.ts` — REST transport (reconcile needs list-open-issues + commits-touching-path queries)

## Personas

- Safeword Maintainer (SM)

## Surfaces

Affected:

- Claude Code — skip: change lives in the harness-neutral pipeline core; scenarios exercise the shared code path, not per-harness installs
- Claude Code on the Web — skip: same shared pipeline core
- OpenAI Codex — skip: same shared pipeline core

## Jobs To Be Done

### retro-filing-provenance.SM1 — know what code state a finding was captured against

**Persona:** Safeword Maintainer (SM)

> When I open a retro-filed issue, I want to see the commit state each encounter was captured against, so I can check whether the code has changed since without reconstructing session timelines from git log.

#### retro-filing-provenance.SM1.R1 — Every encounter recorded on an issue carries the commit provenance (short SHA, branch) current at capture time, newest encounter visible

#### retro-filing-provenance.SM1.R2 — Provenance fields are code-assembled and bounded, so no free-text or leakable shape reaches the public ledger comment

### retro-filing-provenance.SM2 — separate still-broken from already-fixed without archaeology

**Persona:** Safeword Maintainer (SM)

> When I triage open retro issues after a session's PR has merged, I want issues whose surface changed since their last recorded encounter flagged as possibly-resolved, so I start from a shortlist instead of auditing every issue by hand.

#### retro-filing-provenance.SM2.R1 — A reconcile sweep marks an open retro issue possibly-resolved when its surface was touched by commits after the issue's newest recorded provenance

#### retro-filing-provenance.SM2.R2 — Reconcile never closes an issue — it only flags; a human (or a later verification pass) decides

#### retro-filing-provenance.SM2.R3 — Reconcile is idempotent: re-running against unchanged state adds no duplicate flags or comments

#### retro-filing-provenance.SM2.R4 — An issue without recorded provenance (filed before this feature) is left untouched, never guessed at

## Rave Moment

skip: internal maintainer plumbing — no persona-facing peak to name.

## Outcomes

- Newly filed/bumped retro issues show which commit each encounter saw.
- Running reconcile after a merge produces a `possibly-resolved` shortlist that matches issues whose surface actually changed; re-running produces nothing new.
- The #707-style manual archaeology (2 days open, git-log spelunking) becomes: read the flag, verify, close.

## Open Questions

- How is reconcile invoked — a `safeword retro --reconcile` CLI mode only, or also wired into this repo's CI on merge to main? (Proposal: CLI mode in scope; CI wiring is a one-line follow-up outside this ticket.)
- Within-session staleness (a finding fixed later in the same session, before any merge) — out of scope here? (Proposal: yes; the reconcile sweep catches it once the fix merges, and in-session deferral is a separate design with its own Stop-timing tradeoffs.)
