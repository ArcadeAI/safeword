# User Story: Keep retro dedup stable during issue closure

As a Safeword maintainer
I want retro marker enumeration to remain complete while issues change state
So that a recurrence cannot silently open a duplicate issue.

## Acceptance Criteria

- The enumerated page membership does not change when an issue closes or reopens.
- Only open issues can satisfy an exact legacy or canonical marker lookup.
- Pull requests cannot satisfy an issue marker lookup.
- An unread tail still fails closed instead of authorizing creation.

## Out of Scope

- Atomic protection against simultaneous creators.
- Changing how closed recurrences are handled.
- Guaranteeing stability when an administrator permanently deletes an issue.

## INVEST

- Independent: limited to the REST dedup enumeration.
- Negotiable: the implementation follows the smallest verified API contract.
- Valuable: prevents silent duplicate tracker issues.
- Estimable: one transport and its focused tests.
- Small: no new dependency or entry point.
- Testable: each acceptance criterion has an observable transport result.
