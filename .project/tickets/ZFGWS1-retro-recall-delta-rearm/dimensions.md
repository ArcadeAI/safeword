# Dimensions: Retro recall — delta re-arm + sonnet + async + signature dedupe (ZFGWS1)

Derived from spec.md (SM1/SM2/TB1/NTB1 ACs, done_when) + domain knowledge (delta
windowing over a byte offset, additive cadence + backstop, atomic offset state,
the inherited egress guard, GitHub signature search, async hook registration).

| Dimension                  | Partitions                                                                                                                              | AC        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Delta window slice         | fire 1 → window from offset 0 (whole transcript so far); fire N → window from offset_{N-1} − overlap to end; `buildDigest` caps window | SM1.AC1   |
| Window tiling / back half  | finding only in the back-half delta → reaches `prepareEncounters` input on fire N (not lost to the head-cap)                            | SM1.AC1   |
| Extraction model default   | no override → `sonnet` at `buildAutoExtractor` (runner) AND `runHeadlessExtraction` default; `retro.model` config override honored      | SM1.AC2   |
| Signature dedupe           | existing issue with same `retro:<hash>` in body → matched, no new issue; new signature → new issue; title differs but signature equal → matched | SM2.AC1   |
| Signature embedded+search  | `assembleBody` embeds the signature marker; `searchBySignature` queries `in:body` and exact-filters the marker                          | SM2.AC1   |
| Stable session id forward  | child env carries the resolved session id → CLI uses it (not `'unknown'`) even when `CLAUDE_SESSION_ID` is unset                        | SM2.AC2   |
| Atomic offset state        | write = temp-file then `rename`; a concurrent reader sees either old or new whole state, never torn; offset only advances               | SM2.AC3   |
| Async hook registration    | generated Claude Stop settings entry for `stop-retro.ts` carries `async: true`; NOT `asyncRewake`; inner `spawnSync` unchanged          | TB1.AC1   |
| Additive cadence + backstop| growth < `REARM_GROWTH` since last fire → hold; ≥ → re-fire; `fires ≥ MAX_FIRES` → hold (backstop); first fire gated by substance       | TB1.AC2   |
| Fail-open / guards         | retro child env → no fire (guard first); state-write throw → still fires, no throw; #563 absent → always-fire (bounded)                 | TB1.AC2   |
| Egress guard (inherited)   | secret in window-derived free text → redacted; customer path → redacted; unresolved surface → dropped; pipeline unbypassed by windowing | NTB1.AC1  |

**Test layers:**

- **Unit (pure functions):** offset-state read/record helpers (stored value + key,
  atomic-write contract via injected writer), the additive-cadence decision
  (`decideRetroRun` successor — re-fire/hold/backstop/guard-first/fail-open), the
  window slicer (offset + overlap), `retroSignature`/`assembleBody` marker, the
  model resolver. Injected-deps style matching `retro-trigger.ts`.
- **Module (wiring):** `triage` against a mock `IssueTracker` — match by signature
  not title; new signature creates; repeat signature does not. `searchBySignature`
  exact-filter logic.
- **Command-level (wiring):** `safeword retro --auto-extract --window-start N` in a
  temp dir with the `claude -p` subprocess + GitHub transport mocked — assert the
  back-half finding reaches the egress pipeline and the window (not head) is digested.
- **Config/settings:** `SETTINGS_HOOKS.Stop` retro entry carries `async: true`;
  schema-parity for the `.safeword` mirror.

**Boundaries mocked:** only process boundaries — the `claude -p` subprocess (stub
stdout findings JSON) and the GitHub transport (mock `IssueTracker` incl.
`searchBySignature`). Window slice, digest, cadence decision, offset state, egress
pipeline, and triage run real. The offset-state fs is driven through an injected
`baseDirectory`/writer like the existing sentinel tests.
