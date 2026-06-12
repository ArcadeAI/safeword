# Dimensions: Independent evidence-backed architecture gate

The gate extends #204's `stop-quality.ts → checkImplPlanArtifact`, firing at the implement→verify/done exit. Two new checks (cited evidence, design-review stamp) plus a config flag and an optional cross-model posture.

| Dimension                | Partitions                                                                 | Notes                                                                        |
| ------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Review-gate flag         | enabled / disabled / config absent / config malformed                      | Mirrors `reviewGate`; absent & malformed ≡ disabled (fail-safe off)           |
| Impl-plan well-formedness| present-valid / present-malformed (parse error) / Decisions section absent / plan absent | New checks layer on #204; existence + parse errors fire first    |
| Decisions evidence       | URL/marker citation / uncited prose / `skip: <reason>` / bare `skip:` / `skip:`+trailing content | "Cited" = URL or `[n]` marker; multi-line skip is content   |
| Design-review stamp      | present-matching / absent / same-stamp-after-edit / other-ticket-same-hash / `skip:` | Content-hash AND ticket bound via `reviewScope(ticket,'impl-plan',hash)` |
| Reviewer-model posture   | cross-model off (floor) / cross-model required                             | Opt-in ceiling-raiser; off is the default                                    |
| Recorded model tags      | same / different / same-differing-case / author-tag-absent                 | Gate compares trimmed case-insensitive tags; author absent fails closed      |
| Ticket type + flow       | feature new-flow (spec.md) / feature grandfathered (no spec.md) / task     | Inherited #204 routing — gate fires for new-flow features only               |
| Phase at gate            | implement→verify exit / done / pre-implement                              | Required from implement exit onward; pre-implement is never gated            |

**Pruning:** The two checks (evidence, stamp) share one enabled/disabled code path, so the flag partitions are exercised once each rather than crossed with every evidence/stamp state. Stamp-model is sampled only under `cross-model required` (its only load-bearing context); under the default floor a same-model stamp simply passes. Type+flow exemptions are sampled at the boundaries (task, grandfathered) rather than crossed with every cell — same rationale as XDNSZA's dimensions.
