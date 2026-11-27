# Reservation rerun using recorded replies

Run on November 21, 2026 Pacific time. Three independent Docker attempts per
arm using the existing reservation prompt and verifier, Claude Code 2.1.326,
and Haiku 4.5. The arms were no Safeword, stable release 1.1.0, and unreleased
checkout `72165cde6`. Each Claude invocation used the 50-turn and $1 caps.
The relay let the same session resume after a reply.

The [decision log](reservation-decisions.md) supplied the scope and response
contract when asked. Messages with multiple questions at one stop count as
one checkpoint. There was no reply to a completed handoff or a handoff listing
only the agent's own next step. The raw checkpoint files and exact answers are
in the [local relay archive](jobs/reservation-log-relay-20261122T042149Z).

| Measure                                      | No Safeword | Stable release | Checkout |
| -------------------------------------------- | ----------: | -------------: | -------: |
| Hidden verifier passed                       |         3/3 |            1/3 |      1/3 |
| Questions answered from log                  |           0 |              1 |        3 |
| Questions escalated to the user              |           0 |              0 |        0 |
| Median turns across invocations              |           5 |             51 |       34 |
| Median reported model cost                   |      $0.023 |         $0.295 |   $0.228 |
| Authored BDD scenarios in captured artifacts |           0 |             12 |        0 |

One stable attempt passed after receiving the recorded scope and return
contract. One spent its turn budget building a separate module and left
the required entry point as a stub. The other stopped after intake with
its own next steps and no request for input.

The checkout passed one attempt after receiving the recorded scope and
shape. A second returned a stock number as `inventory`, where the starter
requires an inventory object. A third built and tested another module but
left the required entry point as a stub. Both had received the scope reply.
The return-shape answer was sent to the checkout trial that asked about
the sold-out response. The frozen task starter supplied the return shape
to all arms.

## Harbor jobs

- [No Safeword](jobs/reservation-baseline-ready-deps-human-72165cde6-20261122T042153Z/result.json)
- [Stable release](jobs/reservation-release-ready-deps-human-72165cde6-20261122T042153Z/result.json)
- [Unreleased checkout](jobs/reservation-checkout-ready-deps-human-72165cde6-20261122T042153Z/result.json)
