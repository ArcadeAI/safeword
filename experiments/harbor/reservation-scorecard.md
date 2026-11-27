# Reservation v2 interactive scorecard

One trial per arm on Claude Code 2.1.326 and Haiku 4.5, with fresh dependencies.
The release was 1.1.0 and the checkout was 72165cde6. The reservation prompt
gave product requirements without development process guidance.

| Measure                                             | No Safeword     | Release 1.1.0       | Checkout           |
| --------------------------------------------------- | --------------- | ------------------- | ------------------ |
| Harbor functional checks                            | Pass            | Fail                | Pass               |
| Delivery status                                     | Delivered       | Incorrect interface | Delivered          |
| BDD scenarios authored / observed passing           | 0 / 0           | 4 / 0               | 7 / 7              |
| Standalone tests authored / observed passing        | 6 / 6           | 4 / 4               | 0 / 0              |
| TDD cycles verified / cases exercised               | 0 / 0           | 0 / 0               | 1 / 7              |
| Product eval cases / graders                        | 0 / 0           | 0 / 0               | 0 / 0              |
| Human input requests / replies                      | 0 / 0           | 0 / 0               | 4 / 4              |
| Agent turns                                         | 10              | 37                  | 88                 |
| Total tokens including cached input / output tokens | 227,789 / 4,190 | 1,218,425 / 13,964  | 5,863,006 / 27,362 |
| Estimated model cost                                | $0.053          | $0.248              | $0.907             |
| Implementation lines / test and scenario lines      | 35 / 73         | 72 / 137            | 27 / 140           |

The baseline's tests ran after implementation and logged failures without
propagating a failing exit code. The release's tests passed against its own
altered interface. Harbor's documented input caused the release to crash.

The checkout's seven scenarios failed against the unimplemented function,
then passed after the fix. Its piped commands did not establish propagation
of Cucumber's exit status. The [decision log](reservation-decisions.md)
contains the four replies. See the [template](scorecard-template.md) for
counting rules.

## Quality pilot on saved artifacts

The original Harbor verdicts above are preserved. Two additional diagnostics
tested object preservation for a first sold-out request and current stock
when retrying after another successful reservation. The diff review was
performed after the arm identities were known.

| Measure                                                 | No Safeword                                                                       | Release 1.1.0                                                                                      | Checkout                                                                                                                                |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Original Harbor checks                                  | Pass                                                                              | Fail                                                                                               | Pass                                                                                                                                    |
| Sold-out leaves the whole inventory object unchanged    | Fail                                                                              | Cannot call documented interface                                                                   | Pass                                                                                                                                    |
| Retry after another reservation preserves current stock | Pass                                                                              | Cannot call documented interface                                                                   | Fail                                                                                                                                    |
| Code: public interface compatibility                    | Accepts the documented input and returns the documented shape                     | **Blocking:** expects nested Maps and returns `{ status, state }`; crashes on the documented input | Accepts the documented input and returns the documented shape                                                                           |
| Code: state and boundary behavior                       | **Major:** first sold-out request adds `_reservations` to the caller’s object     | Documented callers cannot reach the reservation logic                                              | **Major:** retrying an earlier request after another reservation returns an outdated stock count                                        |
| Code: scope and maintainability                         | One implementation file, with retry bookkeeping mixed into caller-owned inventory | Adds an inventory wrapper and a state model that callers must adopt                                | One implementation file, with a cache that stores whole inventory snapshots instead of just the information needed to recognize retries |
| Faults caught by authored checks                        | 3/3                                                                               | Not comparable                                                                                     | 3/3                                                                                                                                     |
| Faults that caused a nonzero exit                       | 0/3                                                                               | Not comparable                                                                                     | 3/3                                                                                                                                     |

The baseline writes a tracking property onto the caller's inventory even
when the first request is sold out. The checkout caches the entire returned
inventory snapshot. A retry after a later successful reservation can return
an older stock count. The release expects nested Maps and its own result
shape.

For the proof check, both compatible implementations passed their authored
suites unchanged. Disposable copies then introduced one fault per run:
a retry decrementing stock, sold-out stock becoming negative, or a result
missing the inventory field. Both suites reported all three faults. Only the
checkout's Cucumber command exited nonzero for all three. The release's own
suite passed on its altered interface and was excluded from the shared fault
comparison. The saved artifacts were exercised in network-disabled containers.
