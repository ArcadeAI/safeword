# Historical eligibility: nested project generated marker

Review only the named CKWE2D scenario. `eligibility-first.json` is the review
target and contains the exact baseline source excerpts, baseline and current
Git blob identities, scenario body excerpt, and the baseline test excerpt. Its
`baselineTestRun` reports a fresh, isolated run of the cutoff source, with the
currently installed dependency tree; it is corroborating evidence rather than
a claim about an original RED run.

At fixed cutoff `690536ec56c07c2b042108d9c31d28bc3bc82619`, the
`packet.ts` baseline uses the nested project's repository prefix for the
committed Git attribute query, yet reports exclusions relative to the project.
The cutoff test invokes the public command from that nested project and passes
with exit zero, its generated target excluded, and authored content in the
reviewer prompt. The current test adds exact packet and empty-error assertions;
its blob differs from the cutoff test, and the claim records both identities.

The historical RED, GREEN, and REFACTOR rows remain unchecked. There is no
recorded original failing RED run, so none is claimed. Eligibility only says
the actor-facing behavior existed at the cutoff. A separate current passing
and behavior-removal proof is still required for VERIFIED.
