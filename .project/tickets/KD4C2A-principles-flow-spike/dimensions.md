# Dimensions: Project knowledge throughout feature delivery

| Dimension | Partitions and boundaries | Rules |
| --- | --- | --- |
| Knowledge applicability | materially changes behavior/design/proof · not applicable · deliberate conflict | NTB1.R1 |
| Review-context continuity | creator and reviewer share sources · reviewer receives labels only · source changes between phases | NTB1.R2 |
| Evidence class | persona experience · per-surface execution · objective reference/trace · evidence absent or mismatched | NTB1.R3 |
| Configured-path lifecycle (principles, personas, surfaces) | default scaffold · customized default preserved · valid override · missing override · override plus orphaned default | SWM1.R1 |
| Plan-heading compatibility | canonical `Design alignment` · legacy `Arch alignment` · neither heading · both aliases present | SWM1.R2 |
| Host workflow parity | canonical template · dogfood Claude · thin Cursor reference · generated Codex asset · intentional drift | SWM1.R3 |
| Public discoverability | all project-knowledge keys and lifecycle documented · key missing · overwrite/ownership semantics unclear | SWM1.R4 |

## Boundary decisions

- A plan containing both `Design alignment` and `Arch alignment` is ambiguous
  and should fail with remediation to keep exactly one heading.
- Principle/persona/surface meaning remains a review judgment. Health and audit
  observe only path, reference, shape, and evidence-link facts.
- A surface tag records coverage intent; a verification result records actual
  execution. Neither substitutes for the other.
- Non-applicable knowledge produces no per-ticket checklist entry. A deliberate
  conflict is recorded as a deviation instead of silently ignored.
