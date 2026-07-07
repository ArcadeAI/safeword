# Impl Plan: Retro records filing-time provenance for reconciliation against merged state

**Status:** implemented

## Approach

**Riskiest assumption:** provenance can ride inside the existing public ledger comment through both filing paths without corrupting the live fleet of pre-provenance ledgers — proven cheapest by the "recurrence bump onto a pre-provenance ledger preserves its counts" scenario (pure ledger unit test, slice 1). If that design is wrong, everything downstream (reconcile) is moot, so it fails first and cheap.

Proof plan + build order (all vitest; the feature is `@manual` — cucumber can't drive subprocess/transport boundaries):

1. **Ledger schema extension** (`src/retro/ledger.ts`) — provenance field (sha?, version, at), coerce-everything parsing, newest-wins on bump. Primary proof: **unit** (`ledger.test.ts`) — pure data transforms, highest practical scope IS unit. Covers: pre-provenance bump back-compat, attacker-shaped coercion, newest-encounter visibility. Load-bearing slice; build first.
2. **Environment-aware capture** (`src/commands/retro.ts` + `src/retro/triage.ts` context) — `isDogfoodRepo` → short HEAD SHA via git subprocess (fail-open: omit on error), else `VERSION`; capture time from injected clock. Primary proof: **integration/wiring** through `runRetro`/`retroCommand` with only git subprocess + transport + clock mocked (the entry-point scenario "safeword retro files the encounter…"). Covers: dogfood SHA, customer version, no-customer-identifier, unresolvable-git-never-blocks.
3. **Reconcile core** (new `src/retro/reconcile.ts`) — normalize newest provenance → code-state date (SHA → capture time; version → release-tag date via transport), decision (commits touching surface since date), flag application (marker comment + label, idempotent), eligibility (open + retro label query shape), ops bound, per-issue isolation (triage precedent). Primary proof: **unit/integration** against an in-memory transport fake asserting call shapes (the SM2.R5 query-shape assertion per the ledger note). Covers all SM2 scenarios.
4. **Reconcile CLI mode** (`safeword retro --reconcile` in `commands/retro.ts` + transport additions in `github-rest.ts`) — primary proof: **wiring** test through the command with only the transport mocked (the "reconcile CLI mode runs" scenario). Transport additions (list issues, commits-by-path-since, tag→date) stay thin/untested-by-unit like the existing REST boundary.

Supporting proof: none beyond the above — no AI-output surface (no evals), and combinatorial logic (date normalization) is inside slice 3's unit coverage.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Provenance storage | Existing ledger comment JSON | Issue body field; separate comment | Body is immutable-by-convention (signature lives there); a second retro-owned comment doubles the idempotency surface; ledger already has coerce-everything parsing |
| Code-state comparison | Date-based (`since` on list-commits) | Git ancestry (`sha..HEAD`) | Dogfood SHAs are squash-merged — never ancestors of main, possibly unresolvable later |
| Environment detection | Reuse `isDogfoodRepo` | New detection | One detector, one accepted misfire risk (repo literally named `safeword`), already shipped |
| Version → date | Release-tag date via transport, skip when unresolvable | Package publish date via npm registry | New external dependency + registry availability; tags are the canonical release path (CLAUDE.md) |
| Flag idempotency | Marker in the flag comment + label presence check | Ledger-side "flagged" bit | The ledger is attacker-editable; the flag artifacts themselves are the ground truth reconcile reads |
| Stored provenance shape | Per-kind slots (`dogfood {sha,at}` / `install {version,at}`) | Single flat newest-encounter field | Flat storage lets a later encounter from an OLDER installed version clobber a newer dogfood code state — the mixed-ledger scenario fails; reconcile takes the newest date across slots |
| CLI invocation | Sibling command `safeword retro-reconcile` | `--reconcile` flag on `retro` (the intake proposal) | `retro` hard-requires `--transcript`, which a sweep doesn't have |

## Arch alignment

Honors (ARCHITECTURE.md → Key Decisions, plus module-header ADRs in the retro corpus):

- **Graceful fallback / hooks never block** — provenance capture is fail-open (omit on git failure); reconcile is a manual CLI mode, never a hook path.
- **Retro egress composition** (pipeline.ts header: schema wall → surface wall → scrub → code-assembled body) — provenance fields are code-assembled bounded tokens; nothing free-text is added.
- **Triage per-encounter isolation** (triage.ts C3) — reconcile adopts the same per-issue isolation (SM2.R7).
- **Thin untested REST boundary** (github-rest.ts header) — new transport methods stay thin; logic lives in tested modules.

## Known deviations

- Reconcile ships as `safeword retro-reconcile`, not the `retro --reconcile` flag the intake open-question proposed — `retro`'s required `--transcript` makes a flag the wrong shape (recorded in Decisions).
- The per-run bound counts *flags*, not raw API operations (actions/stale counts operations) — matches SM2.R6's wording; noted by the whole-ticket review.

## Assessment triggers

- Retro issue volume grows past the ops bound routinely → revisit bound size / pagination strategy (listing now paginates to 1000 issues with PR filtering; flagged issues remain in the listing until closed).
- `resolveTagDate`'s annotated/lightweight deref branching lives in the untested REST boundary — extract a tested pure helper if it grows (whole-ticket review item 9, deliberately deferred).
- GitHub REST changes to commits/tags endpoints or a non-GitHub tracker lands → revisit the transport seam.
- Harnesses gain a reliable session-end signal → revisit in-session reconciliation (deferred from intake).
- PNZM3B's `process/<slug>` namespace grows reconcilable semantics → revisit the SM2.R4 skip.
