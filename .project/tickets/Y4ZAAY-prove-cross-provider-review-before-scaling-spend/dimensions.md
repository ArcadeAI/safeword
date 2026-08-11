# Dimensions: Prove cross-provider review before scaling spend

| Dimension | Partitions and boundaries | Rule |
| --- | --- | --- |
| Provider route | every repository-reading and finding-verification turn has an OpenAI Terra envelope; provider/model mismatch; an unrecorded or zero-turn inventory | SWM1.R1 |
| Corpus role | anchored legacy author provenance retained; any relabeling; any attempt to treat development evidence as confirmatory | SWM1.R1, SWM1.R3 |
| Started attempts | 9 permits the tenth; 10 blocks the eleventh; an infrastructure retry increments the same durable count | SWM1.R2 |
| Observed spend before an attempt | below $15 permits; exactly $15 blocks; above $15 on resume blocks; incomplete accounting blocks | SWM1.R2 |
| Reaching spend | a completed attempt lands exactly on or crosses $15; its evidence and threshold result remain durable; no next attempt starts | SWM1.R2 |
| Context price boundary | 271,999 and 272,000 input tokens use short-context; 272,001 uses long-context | SWM1.R2 |
| Detailed usage price | uncached, cached, cache-write, and output rates in short- and long-context tiers | SWM1.R2 |
| Cost arithmetic | exact integer picodollars; exact and above-$15 classification | SWM1.R2 |
| In-attempt crossing | remaining turns of the already-started attempt complete; no later attempt starts | SWM1.R2 |
| In-flight crash | started intent is durable before provider request; unfinished attempt still consumes the cap after resume | SWM1.R2 |
| Invalid paid attempt | a route-invalid attempt is unusable but still consumes the durable cap | SWM1.R1, SWM1.R2 |
| Missing intent | retained paid usage without prior durable attempt intent blocks resume | SWM1.R2 |
| Simultaneous stops | attempt and cost stops reached together report both reasons | SWM1.R2 |
| Confirmation guard control | independently anchored confirmatory evidence is admitted; development evidence remains rejected after path, marker, label, local-anchor removal, self-issued-anchor changes, trusted-registry failure, or unknown digest | SWM1.R3 |
| Lifecycle | explicit initialization; same-process decision; resumed-process decision from ticket-scoped durable state | SWM1.R2 |
| Total ledger deletion | trusted initialization marker exists with both ledgers absent; fail closed without recreating state | SWM1.R2 |
| Route-invalid cost | native standard Terra usage stays priceable; foreign/non-native usage makes accounting incomplete | SWM1.R2 |
| Authorization | explicit durable authorization permits live execution; absence blocks before a request or attempt | SWM1.R2 |

The first checkpoint is deliberately fixed at ten started review attempts. Larger development checkpoints and fresh confirmatory corpus generation are outside this feature.
