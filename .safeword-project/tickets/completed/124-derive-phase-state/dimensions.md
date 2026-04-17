# Dimensions: Derive Phase State (#124)

## Behavioral dimensions derived from scope

| Dimension                    | Partitions                                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| Phase source                 | ticket exists + in_progress, ticket exists + other status, no ticket (cold start)                     |
| TDD step source              | test-definitions.md has active scenario, no active scenario, no test-definitions.md                   |
| Compact context source       | per-session state file exists, legacy shared quality-state.json only, neither exists                  |
| activeTicket freshness       | ticket still in_progress, ticket moved to done/backlog, ticket moved to other non-in_progress status  |
| Cache field removal          | lastKnownPhase referenced, lastKnownTddStep referenced, parseTddStep() referenced                     |
| Phase detection in post-tool | ticket.md edited (phase write path removed), test-definitions.md edited (TDD step write path removed) |

## Boundary values

- Ticket with no `phase:` field in frontmatter (malformed)
- Session state file exists but `activeTicket` is null
- `getTicketInfo()` returns all-undefined (ticket folder deleted mid-session)
- Multiple in_progress tickets (activeTicket binding is explicit, not discovered)
