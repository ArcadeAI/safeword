# Test Definitions: Keep independent reviews reliable for real ticket packets

Feature source: `packages/cli/features/reliable-reviews-for-real-packets.feature`

test-definitions.md is the R/G/R ledger.

## Rule: reliable-reviews-for-real-packets.TBU1.R1 — A review attempt's time budget scales with the size of the packet it must read, up to a documented maximum of 5 minutes

### Scenario: A representative ticket-sized review is given time to finish

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A small packet keeps a smaller budget than a large one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A packet large enough to need it gets the whole attempt maximum

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The attempt deadline is decided on a controlled clock

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A reviewer answering one tick past its budget is refused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU1.R2 — A reviewer that never finishes is still stopped inside the attempt maximum and reported as a timeout

### Scenario: A reviewer that never answers is stopped and reported as a timeout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An explicitly configured budget replaces the size-derived one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A configured budget is honoured only up to the attempt maximum

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

### Scenario: A first reviewer executable failing any way still leaves the next one a chance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every reviewer executable failing still reports a timeout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU1.R4 — A reviewer stopped for any reason leaves nothing running behind it, and nothing it says afterwards is used

### Scenario: A stopped reviewer leaves no process running

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A late answer after a timeout is ignored

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU2.R1 — A reviewer that supports typed output is given the exact result contract the check will enforce

### Scenario: The Codex reviewer is told the exact shape its answer must take

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The contract handed out names exactly the fields the check enforces

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

## Rule: reliable-reviews-for-real-packets.TBU2.R2 — A reviewer executable that cannot honor the result contract is skipped rather than tried and rejected

### Scenario: A reviewer executable without typed output is skipped for one that has it

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

## Rule: reliable-reviews-for-real-packets.TBU3.R1 — An exhausted reviewer agent is retried on a configured alternate model before the author's own runtime

### Scenario: An exhausted reviewer agent is retried on its alternate model

- [ ] RED
- [ ] GREEN
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

## Rule: reliable-reviews-for-real-packets.TBU3.R5 — Every route is tried in a fixed order and the whole run still finishes inside the run bound

### Scenario: Every route is tried, in order, before the run gives up

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A run that exhausts every route still finishes inside the run bound

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
