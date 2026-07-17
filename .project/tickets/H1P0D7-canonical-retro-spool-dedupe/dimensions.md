| Dimension | Partitions | Rule |
| --- | --- | --- |
| Spool identity version | current record with canonicalSignature; legacy record without it; malformed optional field | R1, R3 |
| Match authority | exact legacy marker; canonical fallback; same-title non-match | R2 |
| Candidate eligibility | open GitHub issue; closed issue; pull request-shaped candidate | R2 |
| Exact-marker precedence | legacy marker wins when both match; canonical marker is only a fallback | R2 |
| Canonical integrity | field agrees with body marker; absent/different body marker disables canonical fallback | R1, R2 |

Boundary: an absent canonicalSignature is legacy-compatible; a present non-string
canonicalSignature is malformed rather than silently treated as legacy.

Boundary: an unmatched legacy record is filed as new; it never falls back to a
title guess.

Wiring: both shipped filer-definition formats consume the same current JSONL
shape through the executable spool reference and direct the same lookup order.
