# Dimensions: Keep independent reviews reliable for real ticket packets

Derived from the ticket's done-when list, the failure modes recorded in
issue 1922, and domain knowledge of the existing coordinator.

| Dimension                     | Partitions and boundaries                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Packet size                   | small single file · representative five-file (~58 KB) · at the existing size bound                                              |
| Reviewer answer timing        | answers quickly · answers after the old fixed 120 s but inside the derived budget · answers past the documented maximum · never answers |
| Budget source                 | derived from packet size · explicitly configured override                                                                       |
| Candidate set on `PATH`       | one compatible · incompatible first, compatible later · slow compatible first, compatible later · none compatible               |
| Typed-output capability       | candidate advertises structured output · candidate does not                                                                     |
| Reviewer answer conformance   | conforming · unsupported severity · extra field · not a result at all                                                           |
| Alternate model configuration | none configured · configured and it completes · configured and it also fails                                                    |
| Route outcome combination     | preferred timed out + fallback rejected · preferred missing + fallback completes · every route exhausted                        |
| Explanation content           | names each route's own cause · carries reviewer diagnostic noise or credentials (must never happen)                             |
| Review policy                 | `prefer` · `require`                                                                                                            |
| Author runtime                | Claude authored · Codex authored                                                                                                |

Partitions deliberately not enumerated as new scenarios: packet bounds,
provenance checking, and write isolation are unchanged behavior already covered
by `cross-agent-adversarial-reviews.feature`.
