# Dimensions: MBGQ89 — cross-ticket dependency/pairing fields

Derived from `done_when` + scope + domain knowledge of safeword's ticket reader and hook surfaces.

| Dimension                    | Partitions                                                                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase transition gate (hook) | intake→other w/ all blocked_on done; intake→other w/ any blocked_on in_progress; intake→other w/ no blocked_on; non-phase frontmatter edit while blocked_on unmet; non-intake→non-intake edit (grandfather case) |
| Reference resolution         | resolves to same-repo ticket; references nonexistent same-repo id; bare id that does not resolve in same repo (cross-repo opaque); empty/missing/null                                                            |
| Cycle topology (blocked_on)  | self-cycle (A→A); 2-node cycle (A→B→A); N-node cycle (A→B→C→A); long chain, no cycle                                                                                                                             |
| paired_with symmetry         | symmetric (A↔B); A says B but B silent; A says B but B says C; A says cross-repo opaque                                                                                                                          |
| Field shape coercion         | blocked_on as scalar string; blocked_on as YAML array; both depends_on shapes; missing/null                                                                                                                      |
| epic plurality               | singular id/slug (accepted); array form (rejected as v1 violation)                                                                                                                                               |
| Documentation surface        | doc-templates/ticket-template.md documents all 5 new fields with examples and marks them optional                                                                                                                |

## Notes

- depends_on cycle detection is **out of scope** for v1 — done_when only mentions blocked_on cycles. depends_on is documentation, not enforcement.
- Cross-repo references can't be distinguished from typos at validation time. This is an accepted tradeoff documented in the design — users see an info-level note rather than an error for unresolvable bare ids.
- Field-shape coercion: accept both scalar string and array form for blocked_on/depends_on (YAML convention; reduces friction in single-dep cases).
- The hook fires on Write/Edit to ticket.md. It checks the new (proposed) frontmatter, not the old, so the trigger is "phase value about to change to non-intake with unmet blocked_on."
- `safeword check` is the validation entry point; it walks all tickets in `.safeword-project/tickets/` once per invocation.
