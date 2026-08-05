# Test Definitions: Keep independent reviews reliable for real ticket packets

Feature source: `packages/cli/features/reliable-reviews-for-real-packets.feature`

test-definitions.md is the R/G/R ledger.

## Rule: reliable-reviews-for-real-packets.TBU1.R1 — Every review attempt gets the same documented deadline, set well above the slowest review anyone has observed

### Scenario: A representative ticket-sized review is given time to finish

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every attempt gets the same deadline whatever the packet holds

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A packet over the accepted maximum is refused rather than budgeted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The attempt deadline is decided on a controlled clock

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An answer already complete when the deadline fires wins the tie

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A reviewer answering one tick past its budget is refused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU1.R2 — A reviewer that never finishes is still stopped at its deadline and reported as a timeout

### Scenario: A reviewer that never answers is stopped when its budget expires

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An explicitly configured deadline replaces the default

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configured deadline is honoured only up to the run bound

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A meaningless configured budget is ignored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU1.R3 — A route's budget is split across its untried candidates, so one slow or stale executable cannot consume every other candidate's opportunity

### Scenario: A slow first reviewer executable still leaves the next one a chance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A hanging candidate is stopped at its own share of the route budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Three candidates each get a real turn

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Each candidate's share is recalculated from what is left

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A first reviewer executable failing any way still leaves the next one a chance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every reviewer executable failing still reports a timeout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU1.R4 — However a reviewer ends, Safe Word stops it and the descendants its platform lets it reach, never waits on what the system will not kill, never claims to have stopped what escaped, and never uses a late answer

### Scenario: A reviewer stopped for any reason leaves nothing running

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cleanup reaches every descendant the platform groups with the reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A descendant that escapes into its own session is not claimed to be stopped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A reviewer the system will not kill is abandoned, not waited on

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A late answer after a timeout is ignored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU2.R1 — A reviewer that supports typed output is given the exact result contract the check will enforce

### Scenario: The Codex reviewer is told the exact shape its answer must take

- [x] RED cd4d474a6
- [x] GREEN 4df19fd02
- [ ] REFACTOR

### Scenario: The contract handed out names exactly the fields the check enforces

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The contract handed out pins every field's shape

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The contract handed out permits exactly the severities the check accepts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A Codex answer that follows the contract is accepted

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A reviewer that cannot be given the contract is not asked to review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU2.R2 — A reviewer executable that cannot honour the result contract never costs a later candidate its turn — skipped before launch when that is knowable, failed fast when it is not

### Scenario: A reviewer executable without typed output is skipped for one that has it

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A candidate that cannot honour the contract never costs the next one its turn

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A capability question that hangs is abandoned quickly

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: No reviewer executable supporting typed output means no reviewer is available

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU2.R3 — A result that violates the contract is still rejected, whatever produced it

### Scenario: Any answer outside the contract is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An answer that does not belong to this request is refused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU3.R1 — An exhausted reviewer agent is retried on a configured alternate model before the author's own runtime

### Scenario: An exhausted reviewer agent is retried on its alternate model

- [x] RED e8b1a6bdd
- [x] GREEN 5f4ec9fd6
- [ ] REFACTOR

### Scenario: An alternate model that also fails falls back to the author's own runtime

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU3.R2 — A review completed by the reviewer agent on its alternate model is still a full cross-agent check, and the result names the model that actually reviewed

### Scenario: An alternate-model review still counts as a full independent check

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Safe Word's own result reports routing in named fields

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Naming the model never widens what a reviewer may answer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A required cross-agent check is satisfied by an alternate-model review

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An alternate model of the author's own runtime is not a cross-agent check

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU3.R3 — With no alternate model configured, routing is exactly what it is today, and Safe Word never supplies a model name of its own

### Scenario: No configured alternate model keeps today's routing

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Safe Word never chooses a model on the builder's behalf

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unusable configured model is treated as none configured

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A model value within the grammar is used as configured

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The accepted model grammar is exactly the stated one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configured model reaches the reviewer as one literal value

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU3.R4 — Each attempted route gets its own attempt budget, so an exhausted first route cannot leave the retry with no time to run

### Scenario: A route failing any way still leaves the next route its own budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A route cannot borrow time from the next route's budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU3.R5 — Every route is tried in a fixed order; the run bound stops any route that has not answered yet, while an answer already complete when the bound fires still counts

### Scenario: The run bound wins over trying the remaining routes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A route considers at most the first eight candidate executables

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every route is tried, in order, before the run gives up

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Review work stops by the run bound however its routes fail

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An answer landing exactly on the run bound wins the tie

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An answer landing on the run bound is still checked before it counts

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The command returns by the bound plus its cleanup budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A run is stopped at the run bound when no answer has landed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU3.R6 — The public review command carries all of this end to end, and the required-review policy decides on what it reports

### Scenario: The public review command completes through the alternate-model route

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A required review accepts an alternate-model cross-agent result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A required review refuses an author-runtime result

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.NTB1.R1 — When both routes fail, the explanation names each route's own cause, not one generic failure

### Scenario: A timeout and a rejected answer are explained as two distinct causes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A missing reviewer and a timed-out fallback are explained as two distinct causes

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: All three routes failing keeps all three causes distinct

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Three different causes still yield exactly one thing to do next

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An exhausted run offers one thing to do next

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The offered next step matches what actually went wrong

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An exhausted run never claims a review happened

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.NTB1.R2 — An explanation never carries raw reviewer output, diagnostic noise, or credentials

### Scenario: An explanation is built only from Safe Word's own failure classification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Nothing a reviewer emits reaches the explanation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A rejected answer is never echoed back to the builder

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.NTB1.R3 — A review that ran but was not independent still never satisfies a required cross-agent check

### Scenario: A required cross-agent check is not satisfied by the author reviewing itself

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A preferred policy still returns a verdict labelled as not independent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
