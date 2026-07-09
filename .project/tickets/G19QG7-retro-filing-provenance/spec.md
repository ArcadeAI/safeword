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

#### retro-filing-provenance.SM1.R1 — Every encounter records environment-aware provenance: a dogfood session records the safeword repo's short HEAD SHA, a customer install records the installed safeword version — both with the capture time, newest encounter visible

#### retro-filing-provenance.SM1.R2 — Provenance fields are code-assembled and bounded, and never carry a customer repo identifier (no customer SHA, branch, or repo name), so no free-text or leakable shape reaches the public ledger comment

### retro-filing-provenance.SM2 — separate still-broken from already-fixed without archaeology

**Persona:** Safeword Maintainer (SM)

> When I triage open retro issues after a session's PR has merged, I want issues whose surface changed since their last recorded encounter flagged as possibly-resolved, so I start from a shortlist instead of auditing every issue by hand.

#### retro-filing-provenance.SM2.R1 — A reconcile sweep marks an open retro issue possibly-resolved when its surface was touched by commits after the issue's newest recorded code state — a dogfood SHA's capture time, or a customer version's release-tag date — never by ancestry from a possibly-unreachable SHA

#### retro-filing-provenance.SM2.R2 — Reconcile never closes an issue — it only flags; a human (or a later verification pass) decides

#### retro-filing-provenance.SM2.R3 — Reconcile is idempotent: re-running against unchanged state adds no duplicate flags or comments

#### retro-filing-provenance.SM2.R4 — An issue that cannot be reconciled — no recorded provenance (pre-feature), no file-path surface (`process/<slug>`), or version provenance whose release-tag date cannot be resolved — is left untouched, never guessed at

#### retro-filing-provenance.SM2.R5 — The sweep considers only open, retro-labeled issues; anything else is never touched

#### retro-filing-provenance.SM2.R6 — The sweep bounds its API operations per run; every flag it does apply lands complete (comment + label together), and the remainder waits for a later run

#### retro-filing-provenance.SM2.R7 — A transport failure on one issue never sinks the rest of the sweep and never produces a flag from partial data

## Rave Moment

skip: internal maintainer plumbing — no persona-facing peak to name.

## Outcomes

- Newly filed/bumped retro issues show which commit each encounter saw.
- Running reconcile after a merge produces a `possibly-resolved` shortlist that matches issues whose surface actually changed; re-running produces nothing new.
- The #707-style manual archaeology (2 days open, git-log spelunking) becomes: read the flag, verify, close.

## Environment split (figure-it-out, 2026-07-06)

Retro files from two environments, and provenance means different things in each:

- **Dogfood repo** (`isDogfoodRepo` — `templates/hooks/lib/dogfood.ts`): the session's repo IS safeword, so the meaningful code state is the repo's short HEAD SHA at capture. The installed version is useless here — development happens between releases, so the version doesn't advance while the bug is being introduced/fixed (the actual #791 case).
- **Customer install**: safeword is an installed npm package + materialized `.safeword/`; the customer's HEAD SHA says nothing about safeword's code state and customer repo identifiers must never reach the public ledger. The meaningful code state is the installed safeword version (`packages/cli/src/version.ts` `VERSION`), which maps to a release tag (releases are tag-driven per CLAUDE.md) and thus to a date. Prior art: crash reporters (Sentry) key regression/resolution tracking to the app's release version, not the host machine's state (training-data claim, unverified — verify at implement if load-bearing).
- **Mixed ledgers are normal** — the same upstream issue can be encountered from both environments. Reconcile therefore normalizes every encounter to a *code-state date* (dogfood SHA → its capture time; version → its release-tag date) and flags when the surface was touched on the default branch after the newest such date (`GET /repos/{o}/{r}/commits?path=&since=` — confirmed in GitHub REST docs).
- **Why date-based, not ancestry-based:** dogfood captures happen on feature branches that squash-merge — the recorded SHA is never an ancestor of main and may become unresolvable after branch deletion, so the capture time is recorded alongside and the SHA is informational.
- **Why an old-version encounter doesn't reset freshness:** a customer on v0.50 hitting the bug *today* reports an old code state (the v0.50 tag date), not today — so it correctly stays flaggable as possibly-resolved-by-a-newer-release. This is why wall-clock capture time alone is the wrong key for version encounters.
- **Tag-date resolution is fallible** (quality review 2026-07-06): the git tag-object endpoint supports annotated tags only; lightweight tags need a different ref→commit shape, and a recorded version may have no tag at all (dev/unpublished builds, forks). Safeword's release path is annotated `v*` tags, but reconcile runs against whatever a ledger recorded — an unresolvable tag date makes the issue unreconcilable (SM2.R4), never guessed.
- **`since` semantics assumption:** the list-commits `since` filter is committer-date-based (GitHub docs are ambiguous; git's own `--since` is committer date). Committer date is what we want — a squash-merged fix's committer date is merge time, so post-capture fixes land after the capture time even when authored earlier. Clock skew between capture-time and committer clocks is tolerated because reconcile is flag-only and human-verified.
- **Forged-ledger accepted risk:** the ledger comment is publicly editable, so crafted provenance dates can steer the flag decision. Parse-side coercion (SM1.R2) bounds *shape*, not truth; flag-only + human verification bounds the damage. Accepted, not designed around.

## Open Questions

All resolved at the intake gates (2026-07-06):

- Reconcile ships as a CLI mode only; CI wiring is a follow-up outside this ticket.
- Within-session staleness is out of scope — the sweep catches it once the fix merges.
- `process/<slug>` surfaces (PNZM3B) are unreconcilable-by-path and skipped (folded into SM2.R4).
