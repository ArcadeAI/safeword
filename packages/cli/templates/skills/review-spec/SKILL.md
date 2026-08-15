---
name: review-spec
description: Use when reviewing a ticket's scenarios (`.feature` source, with legacy test-definitions.md fallback) — auto-fired by the bdd scenario-gate and re-invokable after scenario edits. Runs vacuous-pass, AODI (Atomic/Observable/Deterministic/Independent), determinism, negative-case, and cross-cutting checks and produces a structured findings report. NOT for spec.md JTBD/criteria/persona framing — that is self-review.
allowed-tools: '*'
---

# Review Spec — Scenario Quality Gate

Adversarially review a ticket's scenarios: treat them as if you're trying to break them — find the one that passes for the wrong reason, the missing rejection path, the flaky assertion. This is the bdd **scenario-gate** procedure, extracted so it runs two ways:

- **Auto-fire** — the bdd flow invokes this on entering the `scenario-gate` phase.
- **Manual re-run** — invoke `/review-spec` anytime after `define-behavior` (e.g., scenarios changed during implement and you want to re-validate). Allowed on a closed ticket too — a post-hoc audit is still readable.

Read the active ticket's `.feature` source first. At review time, run
`bun .safeword/hooks/resolve-project-knowledge.ts` and read the current
`principles`, `personas`, and `surfaces` source paths and content it returns, so
the review is grounded in project knowledge rather than labels or stale intake
context. The resolver honors `paths.principles`, `paths.personas`, and
`paths.surfaces`. Also read `spec.md`. Use `test-definitions.md` only as the R/G/R ledger
and as a legacy scenario fallback when no feature source exists.
test-definitions.md is the R/G/R ledger. Run every check below against the
scenarios, and present findings in the **Findings format** at the end. **Review
every scenario on its own merits** — a fixture can hold multiple independent
defects on different scenarios, and finding one never lowers the bar for the
rest; report EACH. (This does not replace `self-review`'s `spec.md` framing
gate.)

Run the adversarial judgment through the shared coordinator, passing the
feature, ticket scope, and any legacy scenario source as bounded targets.
Resolve a review-capable Safeword CLI first; source checkouts do not guarantee
a bare `safeword` on `PATH`:

```bash
bun .safeword/hooks/run-review.ts review run scenario-gate feature-file ticket-spec [legacy-test-definitions] --agent-handoff --json
```

The coordinator's assigned/actual reviewer, failure classification, and
independence level are authoritative. Only when the typed result is
`REVIEW_ROUTES_EXHAUSTED`, invoke `/finish-review` immediately with the original
result and the same accepted targets. For every other result, return it
unchanged. Never substitute another surface-private reviewer or hand-written
independent evidence. Use the checks below as the scenario-gate rubric and to
triage the returned findings.

## Vacuous-pass test

Run this **first** — a scenario that would pass without the feature invalidates every check below it. Mentally delete the implementation and ask: _could this scenario still pass?_ If yes, it is vacuous: flag it and propose a stronger `Then`. (A good test is _behavioral_ — if the behavior changed, the result should change; a scenario that survives a deleted feature tests nothing.)

**Judge in context, not isolation.** A `Then` asserting a concrete value ("yields an empty plan", "returns 0 results") is NOT vacuous just because the value is empty or small — it is a specific, falsifiable outcome a broken implementation would get wrong. Only raise a vacuous must-fix when you can concretely name the do-nothing implementation that would pass. But a genuine vacuous defect (an existence-only or non-claim `Then` not matching a clean pattern below) IS a must-fix — do not omit it to avoid a false alarm. A false alarm and a missed defect are **both** failures; weigh them equally.

**⚠️ High false-alarm risk — these look vacuous but are almost always clean. Do NOT flag:**

- **Gate/intake** — asserts pass/deny/exit on structural preconditions ("a JTBD with numbered Rules and no ACs passes the intake gate", "…with neither is denied"). Pass vs. deny is concrete. _Exception:_ a non-claim `Then` ("nothing happens", "the system continues") IS the vacuous defect.
- **Exclusion/ignore** — "a manifest in an excluded directory is ignored"; the feature must actively exclude it.
- **Negative/rejection** — asserts denial, error, rejection; a constant "success" would fail it.
- **Empty-result on a genuine edge case** — "yields an empty plan" for a no-recognized-manifest input; a specific falsifiable value, not existence-only.
- **Concrete action/command** — "runs tox", "returns 200", "executes X"; a no-op wouldn't dispatch correctly.

Common vacuous patterns, each with its fix (apply only when you can state the do-nothing implementation that would pass **all** scenarios in the suite):

- **Existence-only `Then`** ("a response is returned") → assert the actual value, not that _something_ came back.
- **Given-echo** ("Given a row with X exists … Then a read returns X") → exercises the store, not the feature; assert what the feature computes or changes.
- **Trivially-true setup** — the `Given` already makes the `Then` true regardless of the `When` → move the real precondition out of the assertion.
- **Non-claim `Then`** ("the system remains running", "the gate is passed", "nothing happens") → assert a falsifiable outcome. "The gate is passed" is a non-claim unless it names the concrete effect; contrast "is denied" or "the plan contains step X".

**Constant-implementation lens** — sharper than deleting the feature: replace it with a _constant_ that ignores the input and always returns the asserted value. Could the scenario still pass? A non-event `Then` (nothing posted, not invoked) **with no positive sibling**, a flag asserted at a single value, or a `Scenario Outline` whose rows don't force different outputs all survive a constant. Fix: pair the assertion with the discriminating case (the input that must produce the _other_ output) in the same scenario.

## AODI validation

| Criterion         | Check                          | Red flag                        |
| ----------------- | ------------------------------ | ------------------------------- |
| **Atomic**        | Tests ONE behavior             | Multiple When/Then pairs        |
| **Observable**    | Has externally visible outcome | Internal state only             |
| **Deterministic** | Same result on repeated runs   | Time/random/external dependency |
| **Independent**   | No ordering dependency         | "After Scenario 2 runs..."      |

**Atomic** — a single `When`→`Then` is atomic even if the `Then` asserts several properties of ONE outcome ("returns 200 with body X"). Flag non-atomic only when two genuinely independent behaviors could pass/fail separately (two `When` steps or two `Then`s asserting different system-level effects) — never for a merely compound `Then`.

**Rule ownership** — review a coherent outcome under the Rule whose invariant it proves. An outcome owned by a different Rule is a lineage defect, not an atomicity defect; move or split it and report that single root cause.

**Observable** — an assertion on a user/caller-visible outcome ("is denied", "passes the gate", "the plan contains X") IS observable even if the mechanism is internal; flag non-observable only for internal-detail-only assertions ("the cache was populated", "the private field is set").

## Determinism risks

Sharpen AODI's **Deterministic** check with the patterns that actually flake in CI — each with its fix:

- **Time without a wait** — a `Then` depending on elapsed time, or asserting an async result after a fixed delay → wait on an observable condition (poll/await), never a bare `sleep`.
- **Order-dependent comparison** — asserting an unordered collection as if ordered. **The most commonly missed defect:** any `Then` asserting positional order (first/second/last, "X before Y", "[X, Y] in that order") over a collection with no spec-guaranteed sort — a set, map, or multi-language detection result — is flaky. This is a **must-fix**, not a style nit. Fix: assert membership (includes A AND B), not position.
- **Unsequenced concurrency** — a `Then` over concurrent operations with no stated ordering → assert the settled end-state, or name the ordering guarantee.

Assertion strength (weak vs strong `Then`) isn't repeated here — it is `testing` Iron Law 2, and the vacuous-pass check already coaches a stronger `Then`.

## Adversarial pass

After AODI validation, argue against your own scenario list: "What breaks that none of these scenarios catch?" Present any findings to the user.

One lens to always run — **negative-case coverage**: for each happy-path scenario, is there a rejection-path counterpart? Partitioning should already have produced the invalid-input classes; this pass is the backstop. Common pairs — create ↔ duplicate, read ↔ not-found, update ↔ not-allowed, act ↔ precondition-failed. Treat a gap as **should-strengthen**, not must-fix — a sibling AC often already covers the rejection: _"Happy path X has no rejection counterpart — add a scenario for path Z?"_ For one behavior across many inputs, use a `Scenario Outline`.

For each `Scenario Outline`, confirm its rows vary one behavioral dimension and keep the same outcome shape. Do not group unrelated defect mechanisms merely because they share a generic rejection. Keep feature scenarios representative; exhaustive parser, schema, arithmetic, malformed-field, and implementation-corruption matrices belong in table-driven lower-level tests, while externally meaningful boundaries and failure classes required by the cross-cutting checks remain acceptance scenarios.

## Cross-cutting checks

Eight lenses across the whole scenario set (not per scenario) — each asks "what's missing?":

- **Conflict** — do two scenarios contradict (one allows X, another rejects it) with no distinguishing precondition?
- **Boundary** — zero / one / max / empty / null covered where they apply?
- **Failure** — external-dependency failures covered (timeout, 5xx, malformed, partition)? Distinct from the feature's own rejections (the negative-case lens above).
- **Security** — authn/authz failures and abuse vectors covered?
- **Persona consistency** — does each scenario's triggering persona resolve in the configured personas file, and would another defined persona experience it differently?
- **Surface coverage** — does each affected surface resolve in the configured surfaces file (or stay explicitly spec-local), have a matching `@surface.<slug>` scenario tag or an explicit `skip:` reason, and are any `@surface.*` tags stale?
- **Invariant binding** — for each normative clause in `spec.md` (never / must not / always / only), name the scenario whose failure would falsify it **and** the condition under which it fails; a bare scenario reference is not a binding, it's a pointer that survives the invariant being violated. An invariant no scenario would catch is a **must-fix** — cheapest to write now, while no code exists to work around. Worse than a gap is the scenario whose title names the invariant while its `Given` establishes a weaker precondition: it reads as coverage and proves nothing, so report it as a vacuous pass, not a missing scenario. Found live in QRX2DN — the spec forbade an unbound session mutating ticket state, every row named `never_uses_a_fallback_for` bound a session id, and the no-identity case the invariant actually named shipped as a defect (#1425).
- **Wiring** — for each behavior that crosses a module/command boundary, is there a scenario exercised end-to-end through the real entry point (real config → real collaborators, mocking only the process boundary), not only via injected internals? A path reachable solely through a `provider: none`-style short circuit has no wiring coverage (see `testing/SKILL.md` → Wiring Tests).

Finish by reconciling the set instead of adding speculative cases: every
material partition retained in `dimensions.md`, affected surface, and public
command or user-visible outcome declared in ticket scope needs a scenario or an
explicit `skip: <reason>`. For each load-bearing scenario ask: _could the
proposed test pass while the user-facing claim is still broken?_ Same-process
proof cannot establish caller-exit survival; an injected fake cannot establish
real CLI wiring; a unit test cannot establish a runtime or protocol boundary.
Report a proof-boundary mismatch now so the implementation plan can correct it.

## Findings format

Report findings the way safeword talks to the user — lead with the answer, structure only because a multi-finding review earns it, end with the call:

- **Lead with a tally** — `**Findings:** N must-fix, M should-strengthen, P looks-good.`
- **Three tiers** — Must Fix (correctness/structure), Should Strengthen (clarity/specificity), Looks Good (specific acknowledgement, never padding).
- **One `####` per finding** with the scenario id + a short issue; under it, **Current** (quote the G/W/T, bold the offending phrase) → why → **Proposed** (the rewrite). Fix last, so the explanation reads as the answer. **The `Proposed` rewrite is a claim in its own right** — it must still prove the same Rule and survive the checks above (a rewrite that fixes AODI but no longer covers the criterion is a regression).
- **One finding per root cause** — raise each defect once under its most precise category; don't stack labels ("vacuous" + "non-observable") on one scenario's single structural cause. This de-dups WITHIN one scenario only — two scenarios that each carry a defect are always two separate findings.
- **Bulk** — when one pattern hits ≥3 scenarios: one header, an **Affected** id list, one **Representative** quote, one **Proposed pattern**.
- **End with `**Next:**`** — the single fix to start.

```text
**Findings:** 1 must-fix, 0 should-strengthen.

#### oauth.PO1.AC2.change_applies — Then joins two assertions with "and"
Current: "Then the config shows B and later auths use B" — two independent observables.
Proposed: "Then later authentications use User Source B."

**Next:** split the AC2 scenario, then re-run the gate.
```

## After the review

When invoked **auto-fire** from the bdd scenario-gate, hand control back to `bdd/SCENARIOS.md` for the Scenario Gate Exit (advance the phase to `plan-implementation` — the proof plan is recorded there per `bdd/PLAN_IMPLEMENTATION.md`; work-log). When invoked **manually**, stop after presenting findings — the driver decides what to fix and whether to re-run.
