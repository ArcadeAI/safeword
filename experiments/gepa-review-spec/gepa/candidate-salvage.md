---
name: review-spec
description: Use when reviewing a ticket's scenarios (`.feature` source, with legacy test-definitions.md fallback) — auto-fired by the bdd scenario-gate and re-invokable after scenario edits. Runs vacuous-pass, AODI, determinism, negative-case, and cross-cutting checks and produces a structured findings report. NOT for spec.md JTBD/criteria/persona framing — that is self-review.
allowed-tools: '*'
---

# Review Spec — Scenario Quality Gate

Adversarially review a ticket's scenarios: treat them as if you're trying to break them — find the one that passes for the wrong reason, the missing rejection path, the flaky assertion. This is the bdd **scenario-gate** procedure, extracted so it runs two ways:

- **Auto-fire** — the bdd flow invokes this on entering the `scenario-gate` phase.
- **Manual re-run** — invoke `/review-spec` anytime after `define-behavior` (e.g., scenarios changed during implement and you want to re-validate). Allowed on a closed ticket too — a post-hoc audit is still readable.

Read the active ticket's `.feature` source first; use `test-definitions.md` only as the R/G/R ledger and as a legacy scenario fallback when no feature source exists. test-definitions.md is the R/G/R ledger. Run every check below against the scenarios, and present findings in the **Findings format** at the end. **Review every scenario on its own merits** — a fixture can contain multiple independent defects on different scenarios, and finding one never lowers the bar for the rest; report EACH independent defect you find. (Not a `spec.md` framing review — JTBD/criteria/persona checks live in `self-review`.)

## Vacuous-pass test

Run this **first** — a scenario that would pass without the feature invalidates every check below it. Mentally delete the implementation and ask: _could this scenario still pass?_ If yes, it is vacuous: flag it and propose a stronger `Then`, not just a warning. (A good test is _behavioral_ — if the behavior changed, the result should change; a scenario that survives a deleted feature tests nothing.)

**Critical calibration — judge in context, not in isolation.** Before flagging a scenario as vacuous, ask: _would a do-nothing (constant or no-op) implementation actually satisfy this `Then`?_ A `Then` that asserts a concrete value (e.g., "yields an empty plan", "returns 0 results", "produces exactly these steps") is NOT vacuous just because the asserted value happens to be empty or small — an empty plan is a specific, falsifiable outcome that a broken implementation would not return correctly for all inputs. Only raise a vacuous must-fix when you can concretely describe the do-nothing implementation that would pass. Calibrate against the specific clean patterns below — but a genuine vacuous defect (an existence-only or non-claim `Then` that does NOT match one of those patterns) is a real must-fix; do NOT omit it to avoid a false alarm. A false alarm on a clean scenario and a missed real defect are BOTH failures — weigh them equally.

**⚠️ HIGH FALSE-ALARM RISK — read before flagging vacuous:** The following scenario types are frequently mis-flagged as vacuous but are almost always clean:

- **Gate/intake scenarios** asserting pass/deny/exit based on structural preconditions (e.g., "A JTBD declaring numbered Rules and no ACs passes the intake-exit gate", "A JTBD with neither ACs nor Rules nor a skip line is denied") — these assert concrete, falsifiable outcomes (pass vs. deny) that a no-op implementation would not produce correctly across all inputs. Do NOT flag these as vacuous unless the `Then` is a non-claim (e.g., "Then nothing happens" or "Then the system continues") — in that case the non-claim is the vacuous defect, not the gate structure itself.
- **Exclusion/ignore scenarios** asserting that something is absent (e.g., "A manifest inside an excluded directory is ignored") — a no-op implementation would not handle the exclusion logic correctly for all inputs across the suite. Do NOT flag these.
- **Negative/rejection scenarios** asserting denial, error, or rejection — a no-op that always returns "success" would fail these. Do NOT flag these.
- **Empty-result scenarios** where the `Given` describes a genuine edge-case input — "yields an empty plan" when given a no-recognized-manifest input is specific and falsifiable. Do NOT flag these.
- **Concrete action/command scenarios** where the `Then` asserts a specific observable outcome (e.g., "runs tox", "returns status 200", "executes command X") — these are NOT vacuous. A do-nothing implementation would not correctly dispatch to `tox` (or the correct command) for all inputs. Do NOT flag these as vacuous just because the assertion seems simple or the expected value seems obvious.

Common vacuous patterns, each with its fix (apply **only** when you can state the concrete do-nothing implementation that would pass **all** scenarios in the suite):

- **Existence-only `Then`** ("a response is returned") → assert the actual value, not that _something_ came back.
- **Given-echo** ("Given a row with X exists … Then a read returns X") → that exercises the store, not the feature; assert something the feature must compute or change.
- **Trivially-true setup** — the `Given` already makes the `Then` true regardless of the `When` → move the real precondition out of the assertion.
- **Non-claim `Then`** ("the system remains running", "the gate is passed", "nothing happens") → assert a falsifiable outcome the feature produces. **Note:** "the gate is passed" IS a non-claim if it doesn't specify what the gate-pass means concretely; contrast with "is denied" (concrete rejection) or "the plan contains step X" (concrete value).

**Constant-implementation lens** — sharper than deleting the feature: replace it with a _constant_ that ignores the input and always returns the asserted value. Could the scenario still pass? A non-event `Then` (nothing posted, not invoked) **with no positive sibling** in the same scenario, a flag asserted at a single value, or a `Scenario Outline` whose rows don't force different outputs all survive a constant — none of them show the result varying with the input. Fix: pair the assertion with the discriminating case (the input that must produce the _other_ output) in the same scenario, so the constant is forced to fail.

**Boundary cases that look vacuous but aren't** — "yields an empty plan" or "returns no results" when the `Given` describes a genuine edge-case input (no recognized manifest, excluded directory, empty collection) is a concrete, falsifiable claim: a buggy implementation might return a non-empty plan or an error instead. These are NOT existence-only assertions — they assert a specific value. Do not flag them.

**Negative/exclusion scenarios** — a scenario asserting that something is _absent_ or _ignored_ (e.g., "a manifest inside an excluded directory is ignored") is testing real behavior: the feature must actively exclude it. A no-op implementation would not handle the exclusion logic correctly for all inputs across the suite. Judge the scenario in the context of the whole feature — if sibling scenarios require the feature to _include_ similar inputs in other circumstances, then the exclusion scenario is discriminating and clean.

### Vacuous-pass self-check (mandatory before any must-fix vacuous finding)

Run ALL four steps before finalising ANY must-fix vacuous finding. A finding that fails its self-check must be downgraded to should-strengthen or dropped entirely.

1. **State the do-nothing implementation explicitly.** "A no-op that always returns X would pass this scenario." If you cannot state it concretely, do not flag.
2. **Check sibling scenarios.** Does the suite as a whole force the feature to do real work? If sibling scenarios cover the non-empty/non-excluded/non-trivial cases, an empty-result or exclusion scenario is discriminating — it is clean.
3. **Re-read the `Then`.** Does it assert a specific concrete value (even if that value is empty, zero, or absent)? Specific concrete values are falsifiable — they are not existence-only assertions. Does it assert a concrete command, tool, or action? That is also falsifiable.
4. **Gate/intake/denial check.** Does the scenario assert a pass/deny/gate outcome? Ask: is the `Then` a non-claim ("the gate is passed", "the system continues") or a concrete outcome ("is denied", "the plan contains X", "runs tox")? Only flag a gate scenario if the `Then` is genuinely a non-claim with no falsifiable assertion.
5. **Apply the bar:** only flag if a broken or missing implementation would _still_ pass this scenario across all inputs — but when it genuinely would (an existence-only or non-claim `Then` not matching the clean patterns above), flag it must-fix. Do NOT downgrade a genuine vacuous defect to should-strengthen to avoid a false alarm.

## AODI validation

Validate each scenario against four criteria:

| Criterion         | Check                          | Red flag                        |
| ----------------- | ------------------------------ | ------------------------------- |
| **Atomic**        | Tests ONE behavior             | Multiple When/Then pairs        |
| **Observable**    | Has externally visible outcome | Internal state only             |
| **Deterministic** | Same result on repeated runs   | Time/random/external dependency |
| **Independent**   | No ordering dependency         | "After Scenario 2 runs..."      |

**Atomicity calibration — do not conflate structural atomicity with assertion strength.** A scenario with a single `When` and a single `Then` is atomic, even if the `Then` asserts multiple properties of the same observable outcome (e.g., "returns status 200 with body X"). Only flag non-atomic when the scenario tests genuinely independent behaviors that could pass/fail independently — e.g., two separate `When` steps, or two `Then` steps that assert different system-level effects. Do NOT flag a scenario as non-atomic solely because its `Then` is complex or mentions multiple attributes of one outcome.

**Observable calibration — internal state vs. external outcome.** A scenario that asserts only on internal implementation details (e.g., "the cache was populated", "the private field is set") with no externally visible effect is non-observable. However, scenarios that assert on the outcome visible to a user or caller (e.g., "is denied", "passes the gate", "the plan contains X") ARE observable — even if the underlying mechanism is internal. When flagging non-observable, also check: could the scenario be BOTH non-observable AND have another issue (e.g., non-observable)? If so, flag the primary issue (non-observable) but do NOT additionally flag it as vacuous — these are distinct findings. Raising both against the same scenario for the same root cause is a duplicate.

### Atomicity self-check (mandatory before any must-fix non-atomic finding)

1. **Count the independent behaviors.** Does the scenario test two things that could pass or fail independently? Or does it test one behavior with a rich assertion?
2. **Check for multiple `When` steps.** A single `When` followed by a single `Then` (even if the `Then` is compound) is structurally atomic.
3. **Ask: would splitting improve coverage?** If splitting into two scenarios would not add any new failure modes, the scenario is atomic — splitting is cosmetic, not a correctness fix.
4. **Apply the bar:** only flag non-atomic if a defect in behavior A could be masked by behavior B passing. If the `Then` asserts two properties of the same observable output, do NOT flag.

## Determinism risks

Sharpen AODI's **Deterministic** check with the patterns that actually flake in CI — each with its fix:

- **Time without a wait** — a `Then` that depends on elapsed time, or asserts an async result after a fixed delay → wait on an observable condition (poll/await the state), never a bare `sleep`.
- **Order-dependent comparison** — asserting an unordered collection as if it were ordered → sort, or compare as a set, before asserting. **This is one of the most commonly missed defects: any scenario that asserts positional order (first/second/last) over a collection whose ordering is not guaranteed by the spec is flaky.** Fix: assert membership (includes A AND B), not position.
- **Unsequenced concurrency** — a `Then` over concurrent operations with no stated ordering → assert on the settled end-state, or name the ordering guarantee the scenario relies on.

**Order-dependent comparison — detection guidance:** When you see a `Then` that references ordered positions ("the first result is X", "lists X before Y", "returns [X, Y] in that order"), immediately ask: _does the spec guarantee this ordering?_ If the underlying data is a set, map, or multi-language detection result with no explicit sort rule, the ordering is implementation-defined and the scenario is flaky. This pattern is a **must-fix** determinism defect, not merely a style issue.

Assertion strength (weak vs strong `Then`) isn't repeated here — it is `testing` Iron Law 2, and the vacuous-pass check above already coaches a stronger `Then`.

### Determinism self-check (mandatory before any must-fix determinism finding)

1. **Identify the collection and its ordering.** Is the collection ordered by spec, or is ordering an implementation detail?
2. **Check the assertion.** Does the `Then` assert positional order (first/second/last/before/after) over an unordered collection? If yes, this is a concrete flakiness risk — flag it.
3. **Propose the fix precisely.** The fix is always: replace positional assertion with membership assertion (assert that the collection _includes_ the expected elements, not that they appear in a specific position).
4. **Do not conflate with vacuous.** An order-dependent scenario is not vacuous — it tests real behavior. It is a determinism defect.

## Adversarial pass

After AODI validation, argue against your own scenario list: "What breaks that none of these scenarios catch?" Present any findings to the user.

One lens to always run — **negative-case coverage**: for each happy-path scenario, is there a rejection-path counterpart? Partitioning should already have produced the invalid-input classes (equivalence partitioning covers invalid ranges, not only valid ones); this pass is the backstop. Common pairs — create ↔ duplicate, read ↔ not-found, update ↔ not-allowed, act ↔ precondition-failed. Treat a gap as **should-strengthen**, not must-fix — a sibling AC often already covers the rejection: _"Happy path X has no rejection counterpart — add a scenario for path Z?"_ For one behavior across many inputs, use a `Scenario Outline`.

## Cross-cutting checks

Six lenses across the whole scenario set (not per scenario) — each asks "what's missing?":

- **Conflict** — do two scenarios contradict (one allows X, another rejects it) with no distinguishing precondition?
- **Boundary** — zero / one / max / empty / null covered where they apply?
- **Failure** — external-dependency failures covered (timeout, 5xx, malformed, partition)? Distinct from the feature's own rejections (the negative-case lens above).
- **Security** — authn/authz failures and abuse vectors covered?
- **Persona consistency** — is each scenario's triggering persona clear, and would another persona experience it differently?
- **Surface coverage** — if `spec.md` lists affected surfaces, does each affected surface have a matching `@surface.<slug>` scenario tag or an explicit `skip:` reason, and are any `@surface.*` tags stale?
- **Wiring** — for each behavior that crosses a module/command boundary, is there a scenario exercised end-to-end through the real entry point (real config → real collaborators, mocking only the process boundary), not only via injected internals? A path reachable solely through a `provider: none`-style short circuit has no wiring coverage (see `testing/SKILL.md` → Wiring Tests).

## Findings format

Report findings the way safeword talks to the user — lead with the answer, structure only because a multi-finding review earns it, end with the call:

- **Lead with a tally** — `**Findings:** N must-fix, M should-strengthen, P looks-good.`
- **Three tiers** — Must Fix (correctness/structure), Should Strengthen (clarity/specificity), Looks Good (specific acknowledgement, never padding).
- **One `####` per finding** with the scenario id + a short issue; under it, **Current** (quote the G/W/T, bold the offending phrase) → why → **Proposed** (the rewrite). Fix last, so the explanation reads as the answer, not justification. **The `Proposed` rewrite is a claim in its own right** — it must still prove the same Rule and survive the checks above (a rewrite that fixes AODI but no longer covers the criterion is a regression). PRINCIPLES §1, _verify the remedy, not just the finding_.
- **Bulk** — when one pattern hits ≥3 scenarios: one header, an **Affected** id list, one **Representative** quote, one **Proposed pattern**.
- **End with `**Next:**`** — the single fix to start.

```text
**Findings:** 1 must-fix, 0 should-strengthen.

#### oauth.PO1.AC2.change_applies — Then joins two assertions with "and"
Current: "Then the config shows B and later auths use B" — two independent observables.
Proposed: "Then later authentications use User Source B."

**Next:** split the AC2 scenario, then re-run the gate.
```

## Duplicate-finding self-check (mandatory before finalising full findings list)

Run this before presenting findings:

1. **Scan for scenarios flagged under multiple categories.** If the same scenario appears as both vacuous AND non-observable (or any other pair), ask: are these truly independent defects, or is one the root cause and the other a symptom?
2. **Apply the rule:** raise each distinct defect once under its most precise category. Do not raise both "vacuous" and "non-observable" for the same scenario when the root cause is a single structural issue (e.g., the `Then` asserts internal state — that is non-observable; it may or may not also be vacuous, but pick the primary finding). This de-dups multiple LABELS on ONE scenario's single root cause — it NEVER merges defects across different scenarios: two scenarios that each carry a defect are always two separate findings.
3. **Exception:** if splitting into two findings genuinely improves the proposed fix (different rewrites needed), both are acceptable — but explicitly note the relationship.

## After the review

When invoked **auto-fire** from the bdd scenario-gate, hand control back to `bdd/SCENARIOS.md` for the Scenario Gate Exit (advance the phase to `plan-implementation` — the proof plan is recorded there per `bdd/PLAN_IMPLEMENTATION.md`; work-log). When invoked **manually**, stop after presenting findings — the driver decides what to fix and whether to re-run.
