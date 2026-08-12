# Dimensions: Prove cross-provider review before scaling spend

The feature file uses one representative acceptance scenario per meaningful
behavioral partition. Exhaustive malformed-input permutations remain in the
ticket-local contract tests named in `test-definitions.md`.

| Dimension | Acceptance partitions and boundaries | Detailed contract coverage | Rule |
| --- | --- | --- | --- |
| Provider route | complete Terra inventory; untrustworthy inventory; one manual paid proof | provider/model/tier variants, envelope truncation/duplication/pairing, zero turns | SWM1.R1 |
| Corpus provenance | exact trusted value copied; altered or absent value rejected | mixed-case provenance, unsupported authorship claims, unknown registrations | SWM1.R1 |
| Initialization | unused authorization creates zero checkpoint | planted, partial, deleted, forged, already-consumed, unavailable upstream state | SWM1.R2 |
| Attempt limit | nine permits attempt ten; ten blocks another; same-process and resumed decisions | duplicate IDs/sequences, divergent local/upstream heads, missing intent ordering | SWM1.R2 |
| Spend limit | below $15 permits; exactly $15 blocks; simultaneous limits report both | adjacent picodollar values, above-limit resume, exhaustive reason combinations | SWM1.R2 |
| Attempt lifecycle | multiple turns count once; one provider failure is not invisibly retried | crash windows, incomplete response/cost, physical request counting | SWM1.R2 |
| Completed threshold crossing | the full started attempt is retained; only a later attempt is blocked | exact and above-threshold totals, per-turn retention and summation | SWM1.R2 |
| Invalid paid work | priceable Terra usage counts once; unpriceable usage blocks later work | route-invalid provider/tier/native-shape permutations | SWM1.R2 |
| Native pricing | 272,000 short; 272,001 long; omitted cache-write detail means zero | every component rate, cached/uncached/cache-write/output/reasoning arithmetic | SWM1.R2 |
| Authorization | exact durable authority permits; weak, replayed, mismatched, or dirty authority blocks | author, repository, corpus, output, route, code-pin, limit, and receipt mutations | SWM1.R2 |
| Corpus role | development output is diagnostic; local relabeling cannot promote it | path, marker, local-anchor, self-issued-anchor, foreign-digest, and lookup failures | SWM1.R3 |
| Confirmation positive control | independently anchored confirmation remains usable despite stale local development state | estimate/spend-action parity and lookup variants | SWM1.R3 |

Default and continuous-integration selection exclusion for `@paid-canary` and
`@manual` is a test-runner contract, not a product behavior scenario.

The first checkpoint is deliberately fixed at ten started review attempts.
Larger development checkpoints and fresh confirmatory corpus generation remain
outside this feature.
