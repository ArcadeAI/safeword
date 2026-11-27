# Code review category pilot

This spot check reviewed saved baseline and release artifacts from the
regression-proof and eval-proof tasks. The reviewer knew the arm labels.
Follow-up probes ran the saved public entry points. Original Harbor scores
are unchanged.

| Category                         | Discount rounding                                                                                                        | Decision normalizer                                                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compatibility                    | Both patches preserve `discount(price, percent)`.                                                                        | Baseline preserves `decide(output)`. Release tests a new entry point and leaves `decide(" APPROVE ")` returning `"escalate"`.                              |
| Correctness and failure handling | Both passing patches calculate $0.14 for $0.29 at 50% off. Half-up rounding of the exact $0.145 gives $0.15.             | Baseline accepted a padded uppercase label and escalated prose and null on replay. The release's public failure is the entry point issue already recorded. |
| Maintainability                  | Both keep the calculation in one expression. The release adds parameter comments without explaining the rounding policy. | Baseline handles input validation and normalization in the existing function. Release leaves two decision functions with different return shapes.          |
| Scope and complexity             | Both retain one production function and add no production dependencies in the saved patch.                               | Release adds a second module and a reason field beyond the existing interface. This is part of the compatibility finding, not another independent failure. |

The four categories hold up across these examples. A small patch can have no
material scope issue and still fail a numeric boundary case. An implementation
can be readable in isolation and still fail to integrate with its caller.
