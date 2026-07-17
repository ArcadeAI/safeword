# Impl Plan: Keep cloud-spooled retro filing from bypassing duplicate checks

**Status:** implemented

## Approach

The riskiest assumption is that an optional field can preserve canonical identity
without making legacy JSONL lines invalid. Prove it first with the spool
round-trip and malformed-field unit tests. Then update the two shipped prompts
and their parse/contract test, followed by the executable posting seam test that
proves the field reaches the transport unchanged.

1. Add `canonicalSignature?: string` to `SpooledDraft`, accepting absent values,
   rejecting present non-strings, and disabling canonical fallback when it does
   not match the exact code-owned marker in the sealed body; unit tests are the
   highest practical proof for deterministic JSONL parsing.
2. Serialize the optional value and prove a current `RetroDraft` survives the
   real spool read/write boundary while an old four/five-field record remains
   unchanged; this is the wiring test across CLI draft and spool.
3. Update Markdown and TOML filer definitions to prescribe legacy-first,
   optional-canonical fallback, `is:issue is:open`, exact marker verification,
   and no title fallback. Extend definition tests to parse both assets and pin
   this complete contract.
4. Extend `fileSpooledDrafts` coverage so the preserved canonical field reaches
   its post boundary intact. The mocked process boundary remains the poster.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Spool identity | Optional explicit `canonicalSignature` field validated against body marker | Derive marker from body at filing time | Makes the agent parse/infer opaque identity and weakens legacy handling |
| Matching | Exact legacy then optional canonical markers | Exact title fallback | Title drift or collision can merge unrelated findings |
| Candidate scope | Open issues only | Generic issue/PR search | GitHub issue searches can include pull requests |

Evidence: GitHub documents `is:issue` filtering; JSON Lines supports independent
records with optional properties; #1032 is the direct CLI contract this mirrors.

## Arch alignment

Honors the template/source-first reconciliation model and the retro subsystem's
code-owned draft assembly. No architecture decision changes: this is a local
feature implementation rather than a new project-wide pattern.

## Known deviations

skip: no deviations planned.

## Doc impact

skip: internal transport/prompt contract; README and website behavior do not change.

## Assessment triggers

Revisit if a non-agent filer consumes the JSONL spool, GitHub search semantics
change, or canonical identity becomes a public tracker API.
