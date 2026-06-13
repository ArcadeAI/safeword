# /quality-review vs /audit Roles

Covers: quality-review skill, audit skill, refactor close step, skill chaining convention.

## The Convention

Safeword has an implicit but consistent split for the two deep-review skills:

| Skill             | When invoked           | Where                                   |
| ----------------- | ---------------------- | --------------------------------------- |
| `/quality-review` | **Pre-implementation** | tdd-review RED gate (conditional)       |
| `/audit`          | **Post-completion**    | bdd done, refactor done (unconditional) |

No safeword skill chains `/quality-review` as a post-completion closer. If you find yourself adding one, you're likely making the mistake below.

## The Trap

Surface-level reasoning: "deep review = better, so add `/quality-review` to refactor's close." This _feels_ like defense-in-depth but is a category error.

- **Refactor** preserves external behavior by definition (Fowler, _Refactoring_ 2/e). Dependency surface unchanged → version/deprecation/CVE checks don't bite.
- **Refactor's actual residue** is structural: dead code, new cycles, new duplication. That maps to `/audit`'s tooling (knip, depcruise, jscpd), not `/quality-review`'s web research.
- **`/quality-review`'s headline value** — ecosystem freshness — pays off when you're _committing_ to a new API or pattern (i.e., before writing the test that pins it down). That's the tdd-review RED slot.

## Why the wrong synthesis is sticky

When I first investigated, I (and a sub-agent) concluded "adding /quality-review to refactor matches the bdd precedent." It doesn't — bdd's closers are `/verify` + `/audit`, not `/quality-review`. The bdd precedent actually _argues against_ chaining /quality-review at any post-completion step.

## Rule of thumb

- Post-completion closer? → `/audit`.
- Pre-commitment grounding (writing a spec, picking a library, adopting a pattern)? → `/quality-review`.
- Don't add `/quality-review` to a skill's close just because "more review is better."
