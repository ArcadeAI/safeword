# Dimensions: Keep failed reviews out of benchmark scores

| Dimension | Partitions and boundaries |
| --- | --- |
| Provider completion | valid terminal response; connection/5xx failure; HTTP-200 error envelope; empty or truncated body; unexpected finish |
| Reviewer completion | expected reviewer with findings; expected reviewer with explicit empty findings; reviewer error; no reviewer routed; unexpected reviewer |
| Record integrity | complete trace/usage/provenance; missing field; mismatched frozen provenance; unknown new state |
| Retry outcome | first infrastructure failure then success; two infrastructure failures; non-infrastructure failure |
| Pair completeness | all systems/variants/trials usable; one unusable record; duplicate/missing trial |
| Spend gate | no-cost fixtures; ten-call canary passes; any canary trial fails; cumulative and per-attempt cost |
| Corpus role | diagnostic invalid corpus; disjoint calibration cases; fresh confirmatory holdout and reserves |

Boundaries: zero findings is a valid completed review; zero routed reviewers is invalid. One infrastructure retry is permitted; a second failure excludes the whole case. Ten usable paid calls is the minimum spend checkpoint.
