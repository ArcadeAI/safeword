# Dimensions: `safeword retro` (RV9JT4)

Derived from spec.md (TB1/NTB1/SM1 ACs, done_when) + domain knowledge
(transcript I/O failure modes, deny-by-default sanitizer boundaries, GitHub
dedup against an existing corpus, idempotent occurrence ledger).

| Dimension                  | Partitions                                                                                                      | AC       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| Transcript input           | valid readable path; `--transcript` omitted; path missing/unreadable                                           | TB1.AC2  |
| Filing autonomy            | findings present → files with no approval prompt (no human gate exists in the path)                            | TB1.AC1  |
| Body assembly source       | body code-assembled from schema fields only; agent free prose never appears verbatim; stray extra field ignored | NTB1.AC1 |
| Surface resolution (fail-closed) | `safeword_surface` resolves against allowlist → kept; doesn't resolve → finding dropped, not filed         | NTB1.AC2 |
| Egress sanitization        | secret token in free text → redacted; customer abs path → redacted; safeword path → kept; clean field → unchanged | NTB1.AC2 |
| Signature namespacing      | every signature `retro:`-prefixed; never equals the spool signature for the same crash                         | SM1.AC1  |
| Draft shape                | each finding carries `{signature,title,body,labels}`                                                            | SM1.AC1  |
| Dedup vs upstream corpus   | no existing issue → create; open issue same signature → no dup; spool-filed issue same title → no dup; >5 new signatures → only 5 filed | SM1.AC2  |
| Encounter recording        | known issue first hit this session → ledger bump; same transcript re-run → no double bump (idempotent); novel manifestation → comment; non-novel recurrence → count only, no comment | SM1.AC3  |

**Test layers:**

- **Unit (pure functions):** body assembly, surface resolution, prose sanitizer,
  signature derivation, dedup decision, novelty check — assert inputs→outputs
  directly (co-located `*.test.ts`), the spool sanitizer's existing test style.
- **Command-level (wiring):** `safeword retro --transcript <tmp.jsonl>` in a temp
  dir, with **only the GitHub transport boundary mocked** (search / create /
  comment) — assert exit code, what would be filed, and that nothing is filed on
  the missing-path / unresolved-surface / dedup paths. Real config→module wiring,
  per testing/SKILL.md.
