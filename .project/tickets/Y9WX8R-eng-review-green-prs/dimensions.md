# Behavioral Dimensions: eng review on green PRs

The review's externally-observable behavior varies along these independent
dimensions. Scenarios in `packages/cli/features/eng-review-green-prs.feature`
pick representative values (equivalence classes) and boundaries from each.
Judgment _quality_ (are findings insightful, is prose plain) is **not** a
deterministic dimension — it is covered by a golden-set eval deferred to
implement, not by these scenarios.

| Dimension                     | Partitions (equivalence classes)                                              | Boundary / edge                                                                   | Covered by scenario                              |
| ----------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Result parseability & verdict | parseable+valid · **invalid verdict** · **unparseable**                       | unparseable must fail closed (reject, not crash)                                  | A1; A2; unparseable                              |
| Finding well-formedness       | complete · **missing file:line** · **empty failure-mode** · **bad severity**  | empty failure-mode = the "bare adjective" boundary                                | A1; A3; A4; A5                                   |
| Next-action (non-APPROVE)     | present · **empty**                                                           | empty next-action on a blocking verdict is rejected                               | A6                                               |
| Approval freshness vs head    | fresh (same commit) · **stale (head moved)**                                  | head moving by one commit is the staleness boundary                               | B1; B2                                           |
| Review disposition            | reviewed · **skip w/ reason (break-glass)** · **skip w/ empty reason**        | valid skip permits but records distinct from approval; empty-reason skip rejected | skip_permits; skip_distinct; skip_empty_rejected |
| Gate flag                     | off · on                                                                      | off must add no blocking at all                                                   | C1; C2/C3                                        |
| Approval state under gate-on  | none · fresh-clean · **fresh-with-blocker** · **all-advisory (nit/should)**   | blocker-present vs advisory-only is the gating line                               | C2; C3; C5; C4                                   |
| Severity gating               | **blocker (gates)** · should-fix/nit (advisory)                               | exactly one blocker flips block→permit                                            | C4; C5                                           |
| Cross-model config × reviewer | on + same-model · on + different-model · **off + same-model**                 | same-model under "on" is the rejection boundary                                   | D1; D2; D3                                       |
| Finding disposition (eff-FP)  | acted-on · dismissed-as-noise                                                 | mixed set drives the rate computation                                             | E1; E2                                           |
| Diff risk                     | small low-risk · **large (over size threshold)** · **sensitive path (small)** | sensitive-path-but-small must still escalate                                      | F1; F2; F3                                       |

**Partitioning notes**

- The load-bearing boundary is **gate-on + fresh-with-blocker vs all-advisory** (C4/C5): it is the "blockers block, everything else whispers" rule that keeps effective-FP under the abandonment line. One blocker must flip permit→block; a pile of nits must not.
- **Stale approval** (B2) is the provenance boundary — a one-commit move must void the prior approval, or a green merge could reflect unreviewed code.
- **Same-model under cross-model-on** (D1) is a rejection boundary, not a happy path: the independence guarantee fails closed.
- **Sensitive-path-but-small** (F3) is a boundary that defeats a naive size-only rule: risk, not line count, escalates depth.
- **Skip is break-glass, not approval.** A deliberate skip permits merge (so the gate isn't disabled or gamed) but is recorded as a _distinct, attributed_ disposition with its reason — never as an approval. This is the break-glass / audited-waiver pattern: an inescapable gate gets bypassed secretly, so the bypass lives inside the system, visible. An empty-reason skip is rejected.
- **Unparseable result fails closed** — malformed review output is rejected as invalid, never treated as a pass; the gate degrades safe, not open.
- Not separately scenario'd (lower-risk, covered by table-driven unit assertions under GREEN): the three PM/runner-style permutations don't apply here; multiple distinct blocker findings vs one (one is enough to prove gating); exact size-threshold tuning (a config value, not a behavior).
- Judgment quality (finding insight, plain-language prose) — `eval: golden-set @ implement`, not a deterministic scenario; effective-FP rate (E2) is the online metric that quantifies it.
