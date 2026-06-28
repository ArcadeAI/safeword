# Impl Plan: Issue-first ticket identity + tracker-key→local-folder join reader

**Status:** planned

## Approach

**Riskiest assumption:** that a tracker-key→folder reader can resolve cleanly from data we already
keep — the `.safeword/tracker-map.json` sidecar (local↔issue refs, from `tracker-sync/tracker-map.ts`)
plus `external_issue` frontmatter — without a new index, and that "stale entry" (folder deleted) is
distinguishable from "hit." **Cheapest proof:** the SM1.AC1 unit scenarios (`known_key_resolves`,
`stale_map_entry_not_found`, `unknown_key_clean_not_found`). Build this slice first — if the existing
data can't back a clean resolver, the whole identity model is wrong and it fails on slice 1 while
cheap.

Scenario → owner → proof (highest practical scope per `testing/SKILL.md`):

| Behavior | Owner (component) | Primary proof | Why enough |
| --- | --- | --- | --- |
| SM1.AC1 join reader (hit / both shapes / unknown→null / stale→null) | new resolver in `tracker-sync/` (e.g. `resolve-by-key.ts`) over `tracker-map.json`, with `existsSync` folder check | **unit** | pure function over the sidecar + fs stat; edge cases are pure logic |
| TB1.AC1 issue-first create (mint-once, no folder at mint, one folder after; adopt via `--issue`; no-tracker characterization) | `commands/ticket-new.ts` + `utils/ticket-writer.ts`, tracker client injected (`tracker-sync/clients.ts`, `secrets.ts`) | **command-level @wiring** | real command + real ticket-writer/fs; mock only the network boundary — proves config→writer wiring |
| TB1.AC2 degrade (unreachable / rejected / missing-cred / partial-create reconcile) | same command path + `tracker-map.ts` `markPending`/record | **command-level** | failure + idempotency are observable only end-to-end (folder count, map state) |

**Build order:** (1) SM1.AC1 reader [load-bearing, dependency-free, every other child depends on
it] → (2) TB1.AC1 happy/adopt/no-tracker → (3) TB1.AC2 degrade paths (reuse the reader + map from 1).

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| -------- | ------ | ----------------------- | ---------------- |
| Join-key index source | `tracker-map.json` sidecar (authoritative local↔issue map already maintained) | scan every `ticket.md` `external_issue` frontmatter (O(n)); a new dedicated index | scan is slower + duplicates the sidecar; new index is redundant with tracker-map |
| Stale vs hit | reader `existsSync`-checks the mapped folder; missing → null sentinel | trust the map blindly | a dangling path silently breaks every downstream hook (gate found this) |
| Not-found contract | return `null` (match `resolveTicketDirectory`'s `string \| null`) | throw; return `undefined`/`""` | callers branch on a defined sentinel; throwing forces try/catch in per-turn hooks |
| Create ordering | mint issue → `markPending` in map → create folder → promote to recorded | folder-first then mint; folder-first then rename | both leave an orphan/half-state the no-orphan AC forbids (the create-then-rename hatch the gate caught) |
| Folder naming vs resolution | folder keyed to the tracker key, but resolution always goes through the reader (single point) | encode identity only in the folder name | decoupling naming from resolution lets the reader stay the one authority (epic SM2.AC6) |
| Tracker client in tests | inject the existing `tracker-sync` client; mock only the network | real network in tests | non-deterministic, rate-limited, offline-breaking |

## Arch alignment

- Honors **JS5K5G** "one-way, file-canonical; no network in the execution loop" — this child only
  adds identity minting at `ticket new` (creation, not per-turn) and a local reader; no per-turn
  network. Aligns with the epic's **Model B** (`KKNFZA`): tracker canonical for identity only.
- Reuses existing `tracker-sync` seams (`clients.ts`, `secrets.ts`, `tracker-map.ts`) rather than
  introducing a parallel mechanism.
- No formal ADR file beyond `ARCHITECTURE.md`; `skip: no dedicated ADR for tracker identity yet`
  (this plan + epic spec are the record).

## Known deviations

- This adds the **first reader** of tracker identity back into safeword (today `external_issue` is
  write-only via `tracker-sync`). That inverts the one-way *projection* for **identity resolution
  only** — not status. It is consistent with Model B (identity is canonical on the tracker) and does
  not introduce two-way *status* authority. Surfaced deliberately; acceptable.

## Assessment triggers

Revisit these choices if: a third tracker provider is added (key-shape parsing generalizes); a
ticket needs to map to multiple issues (single `external_issue` assumption breaks); `tracker-map.json`
grows large enough that linear lookup matters (add an index); or the epic's status-authority
assumption flips from "just-show" to "tracker drives safeword" (the reader/ordering assumptions
would need the cache/hydrate design instead).
