# PRINCIPLES.md taxonomy draft — for review

**Placement:** subsection of §1 ("Structure enforces; instructions suggest"), inserted after the testing paragraph, before the `---`. NOT a 6th principle — §5 caps the count, and this refines §1's "Independent observation" tier (item 2 of the enforcement hierarchy). Applied to the live file on this branch; this copy is the reviewable source of record.

**Why here:** the existing hierarchy already lists "Independent observation — a separate process verifies (Haiku judge, test suite, artifact parsing)." That single line silently merges three different mechanisms with three different threat models. This subsection splits them.

---

**Match the reviewer to the threat.** "Independent observation" is not one mechanism. What it should be depends on what the check defends against:

| The check is…                                                       | Threat                 | Reviewer                                                                                                                    |
| ------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Your own _judgment/work_ (spec, scenarios, code, design)            | correlated blind spots | independent **review** — fresh-context sub-agent, **never weaker** than the author, a _different model_ when stakes warrant |
| An _observable fact_ (tests pass, types check, citation present)    | self-report bias       | cheap **observation** — test suite, parser, or a small judge; a weaker model is fine, even preferred                        |
| _New candidates_ (design options, refactor smells, research angles) | narrow framing         | **producer** fan-out — varied or cheaper models on purpose; the no-weaker rule does **not** apply                           |

One question routes it: _is the reviewer checking work it (or a peer model) produced?_ Yes → review. Checking an observable → observation. Making new candidates → producer. Only the review class earns the no-weaker / cross-model rule; applying it to the other two wastes tokens (cross-modeling a test run is meaningless) or collapses the angle diversity that is the whole point of fan-out.

---

## Surface → class mapping (the realignment work this taxonomy enables)

| Surface                        | Class today                           | Class it should declare | Action                                                            |
| ------------------------------ | ------------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `quality-review`               | review (fork + no-weaker)             | review                  | reference implementation — no change                              |
| `review-spec` (scenario-gate)  | review (fork, cross-model via 7A0B2K) | review                  | reference implementation — no change                              |
| arch-review-gate (impl-plan)   | review (cross-model opt-in)           | review                  | reference implementation — no change                              |
| **`spec.md` self-review**      | self-review (Tier 1)                  | **review**              | **gap — add independent cross-model-when-on gate**                |
| **`tdd-review`**               | advisory self-check                   | review (advisory)       | label as class-1; lean keep-advisory (boundary cadence covers it) |
| `verify`                       | mechanical                            | **observation**         | tag class-2; cross-model is a category error                      |
| **`audit`**                    | single-agent                          | **split**               | dead-code/dep-drift → observation; architecture-judgment → review |
| `figure-it-out` domain fan-out | producer (already correct)            | producer                | no change — already states no-weaker excluded                     |
| `refactor` discovery sweep     | producer (already correct)            | producer                | no change — already states coverage-diversity lever               |

The one genuine judgment call is **audit**: it does both observation (dead code, dep drift) and review (is the architecture sound?). Recommendation is to split rather than force it into one class.
