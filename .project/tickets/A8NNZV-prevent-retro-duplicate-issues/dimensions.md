# Dimensions — Prevent repeated retro findings from opening duplicate issues

Derived from the approved scope: preserve exact legacy compatibility, add an
exact repro-derived canonical marker, and never use fuzzy matches as merge
authority.

## Behavioral dimensions

| Dimension | Partitions |
| --- | --- |
| Marker type on existing issue | matching legacy signature; matching canonical marker; legacy only; no marker match |
| Finding metadata | unchanged; changed title; changed category; changed surface; all three changed |
| Repro identity | exact normalized match; different normalized value; reworded but non-equal value |
| Search result body | exact requested marker; different marker containing a similar token; no result |
| Encounter ledger state | new session; already recorded in the same session |

## Boundary cases

- An old issue carries only the legacy signature marker: it still matches before canonical search.
- A canonical marker is searched by its hash token but accepted only when the full marker is present.
- A reworded repro is not an exact canonical match and remains a new issue; #1034 owns related-link behavior.
- A same-session canonical recurrence does not double-count the occurrence ledger.

## Rule mapping

- Marker type × finding metadata × repro identity → **Rule: A canonical repro identity ignores model-assigned classification drift**
- Marker type × search result body → **Rule: Exact compatibility precedes canonical lookup and does not merge near matches**
- Canonical marker × encounter ledger state → **Rule: Canonical matches retain ordinary recurrence accounting**

## Out-of-scope dimensions

- Spool serialization and agent-filed drafts — #1031.
- Fuzzy candidate search, related links, and semantic repro matching — #1034.
- Closing duplicate issues — #1033.

## Card-ratio self-check

- **Rules:** 3. Each has 1-3 scenarios.
- **Target scenarios:** 6.
- **Open questions remaining at this phase:** 0; semantic repro rewording is intentionally deferred to #1034.
