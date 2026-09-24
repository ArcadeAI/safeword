# Dimensions: Separate implementation decisions from execution sequencing

| Dimension | Partitions and boundaries | Rules |
| --- | --- | --- |
| Phase responsibility | approach decision; execution sequencing; attempted leakage in either direction | TBU1.R1–R4, TBU2.R1–R5 |
| Product definition | accepted persona success; refusal; failure; trust; approval; recovery; explicit inapplicability; known fact versus assumption or unresolved decision; technical-choice leakage | Product Bet, TBU1.R25, TBU4.R14, TBU4.R16 |
| Decision completeness | complete choice; missing contract, ownership, failure, migration, rollout, rollback, or proof scope; out-of-scope proposal | TBU1.R10–R14, TBU4.R2, TBU4.R5–R8 |
| Reviewability | concise decision summary; proportionate linked detail; execution manual obscuring decisions; explicit receipt pass/fail | TBU1.R3, TBU1.R17 |
| Architecture and data routing | no applicable guidance; feature-local reversible choice; significant durable choice; state, transition, authority, crash, retry, and evidence decisions; each retained/retired legacy route | TBU1.R5–R9, TBU1.R18–R22 |
| Evidence trust | declared evidence; explicit no-decision skip; version or license not applicable; hostile external source; private-context egress | TBU1.R12–R13, TBU4.R12 |
| Review context | project override; installed default; missing, blank, unreadable, stale, unrelated cosmetic edit, relevant semantic edit | TBU4.R3–R4, TBU4.R9 |
| Contract identity | exact canonical bytes; edited same-version copy; stale or missing copy; generated author/reviewer parity | TBU1.R2, TBU2.R3, TBU4.R1, TBU4.R10 |
| Review availability | independent route succeeds; every route exhausted; degraded fallback; false independence claim | TBU2.R1, TBU2.R9, TBU4.R11 |
| Change and return path | behavior change; design/proof-boundary change; sequencing-only change; out-of-scope idea; upstream or downstream edit | TBU2.R4, TBU2.R11, TBU3.R11–R12 |
| Plan repair | incomplete approach; incorrect approach; multiple simultaneous defects; corrected exact bytes; pending external authority | TBU1.R11, TBU1.R17, TBU1.R28 |
| Implementation-time replan | accepted design changes; execution-only mechanics change; still-valid proof; first invalidated obligation | TBU2.R11, TBU2.R17 |
| Execution startability | fresh context; complete first step; unresolved decision; exact test setup/action/assertion/boundary/command | TBU2.R2, TBU2.R6–R8, TBU2.R10 |
| Delivery truth | proposed decision; current implementation; target work; known defect; pending authority; retrofit discrepancy; current, earlier, partial, structural, or missing proof; downstream approval overclaim | TBU1.R26–R27, TBU2.R12–R14, TBU4.R14 |
| Complete feature journey | plain feature prompt; explicit workflow commands; contract-quality three plans; verified review-ready PR; human merge authority | TBU1.R29 |
| Measurement ownership | product outcome and target; design validity and failure behavior; instrumentation and evidence work | TBU1.R23, TBU2.R15 |
| Contribution completion | feature checklist; task or patch checklist; applicable, inapplicable, human-owned; one PR or ordered slices | TBU2.R13, TBU3.R15 |
| Finding dispute | cited contract, Rule, scenario, or decision; defect; optional strengthening; user-owned scope; currency; correctness; upheld, reclassified, rejected, pending, unresolved | TBU4.R15, TBU5.R1–R5 |
| Shared contract shape | purpose; entry; required and prohibited content; review question; approval meaning; invalidation; return path | TBU4.R14 |
| Work classification | qualifying patch; feature trigger; residual task; broad task split; file/surface-count re-evaluation | TBU3.R1–R7, TBU3.R14 |
| TDD behavior | behavior-changing task RED; behavior-preserving characterization; patch targeted proof; reversible local choice; feature promotion | TBU2.R16, TBU3.R8–R12 |
| User and host recovery | missing/stale/mismatched context; stale review; task promotion; human approval enabled/disabled/headless; pending scope or dispute; gated and advisory hosts; M2 delivery and justified host skip | TBU1.R15–R16, TBU1.R24, TBU4.R13, NTB1.R1–R4 |

## Boundaries carried into scenarios

- Every numbered Rule receives a lineage-tagged scenario.
- Rejection behavior is paired with a discriminating accepted case instead of
  relying on a constant-allow or constant-deny implementation.
- The fresh-context startability proof receives explicit Rule lineage rather
  than living only in the Killer Demo.
- Shared behavior carries the affected host tags once at the real delivery
  boundary; host-specific limitations remain separate scenarios or declared
  surface skips.
- Exhaustive malformed-field matrices stay in lower-level tests; feature
  scenarios cover the externally meaningful valid, stale, missing, mismatched,
  and unsupported classes.
