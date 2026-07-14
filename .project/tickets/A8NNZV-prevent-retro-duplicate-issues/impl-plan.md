# Impl Plan: Prevent repeated retro findings from opening duplicate issues

**Status:** planned

## Approach

The riskiest assumption is that a repro-derived marker remains stable when only
the model's title, category, and surface differ; the cheapest proof is the
canonical-recurrence scenario with all three changed. Build in this order:

1. **Draft marker construction — unit proof.** Add a canonical signature and
   HTML marker generated from lowercased, whitespace-normalized `repro`, then
   assert fixed values and preservation of the legacy marker. Pure deterministic
   string/hash logic needs focused unit coverage.
2. **Triage fallback — integration proof.** Extend the tracker contract and
   triage flow to search the legacy signature first, then the canonical marker,
   updating the selected issue's existing ledger. The in-memory GitHub collaborator
   proves no issue is created for canonical recurrence, legacy precedence, and
   session idempotency.
3. **GitHub transport — integration proof.** Add exact body filtering for a
   canonical marker after GitHub candidate search, including a token-containing
   near miss. Mock only `fetch`; the real REST transport owns query construction
   and exact filtering.

The implementation intentionally does not add agent-filer behavior or a
command-level multi-path test: #1031 and #1035 own those contracts.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Canonical identity | Hash normalized `repro` only, namespaced as `canonical:<12-hex>` | Reuse title/category/surface signature; add a model-supplied identity key | Existing inputs are known to drift; a model-only key would have no code-owned derivation. |
| Merge authority | Search legacy signature first, then exact canonical marker | Fuzzy title/body similarity; canonical-first | Fuzzy matching can merge distinct issues; legacy-first preserves existing issue compatibility. |
| Canonical value flow | Carry the generated canonical signature on `RetroDraft` | Reparse the assembled body in triage; recompute from unavailable finding fields | An explicit field keeps the tracker contract typed and avoids parsing code-owned output. |

## Arch alignment

Honors the project's reconciliation-over-copy and schema-as-source philosophy by
keeping the marker value deterministic and code-owned at the retro draft
boundary. It also follows the existing retro boundary pattern: pure logic in
`draft.ts`, orchestration in `triage.ts`, and network details in `github-rest.ts`.

## Known deviations

skip: no deviations planned.

## Assessment triggers

- If semantically equivalent repro text needs matching, revisit exact identity
  only under #1034's related-link/fuzzy-match safety model.
- If the spooled agent filing path begins honoring canonical identity, revisit
  `RetroDraft` serialization and backward compatibility under #1031.
- If additional tracker backends are introduced, move marker-search semantics to
  a shared tracker contract with adapter conformance tests.
