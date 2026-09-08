# Dimensions: Separate implementation decisions from execution sequencing

| Dimension | Partitions and boundaries | Rules |
| --- | --- | --- |
| Phase responsibility | approach decision; execution sequencing; attempted leakage in either direction | TBU1.R1–R4, TBU2.R1–R5 |
| Decision completeness | complete choice; missing contract, ownership, failure, migration, rollout, rollback, or proof scope; out-of-scope proposal | TBU1.R11–R14, TBU4.R2, TBU4.R5–R8 |
| Reviewability | concise decision summary; proportionate linked detail; execution manual obscuring decisions; explicit receipt pass/fail | TBU1.R3, TBU1.R17 |
| Architecture and data routing | no applicable guidance; feature-local reversible choice; significant durable choice; each retained/retired legacy route | TBU1.R5–R9, TBU1.R18–R21 |
| Evidence trust | declared evidence; explicit no-decision skip; version or license not applicable; hostile external source; private-context egress | TBU1.R12–R13, TBU4.R12 |
| Review context | project override; installed default; missing, blank, unreadable, stale, unrelated cosmetic edit, relevant semantic edit | TBU4.R3–R4, TBU4.R9 |
| Contract identity | exact canonical bytes; edited same-version copy; stale or missing copy; generated author/reviewer parity | TBU1.R2, TBU2.R3, TBU4.R1, TBU4.R10 |
| Review availability | independent route succeeds; every route exhausted; degraded fallback; false independence claim | TBU2.R1, TBU2.R9, TBU4.R11 |
| Change and return path | behavior change; design/proof-boundary change; sequencing-only change; out-of-scope idea; upstream or downstream edit | TBU2.R4, TBU2.R11, TBU3.R11–R12 |
| Execution startability | fresh context; complete first step; unresolved decision; exact test setup/action/assertion/boundary/command | TBU2.R2, TBU2.R6–R8, TBU2.R10 |
| Work classification | qualifying patch; feature trigger; residual task; broad task split; file/surface-count re-evaluation | TBU3.R1–R7, TBU3.R14 |
| TDD behavior | behavior-changing task RED; behavior-preserving characterization; patch targeted proof; reversible local choice; feature promotion | TBU3.R8–R13 |
| User and host recovery | missing/stale/mismatched context; stale review; task promotion; human approval enabled/disabled/headless; gated and advisory hosts | TBU1.R15–R16, TBU4.R13, NTB1.R1–R4 |

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
