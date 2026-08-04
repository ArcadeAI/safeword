# Test Definitions: Keep independent reviews reliable for real ticket packets

Feature source: `packages/cli/features/reliable-reviews-for-real-packets.feature`

test-definitions.md is the R/G/R ledger.

## Rule: reliable-reviews-for-real-packets.TBU1.R1 — A review's time budget scales with the size of the packet it must read, up to a documented maximum

### Scenario: A representative ticket-sized review is given time to finish

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A small packet keeps a smaller budget than a large one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A reviewer answering past the documented maximum is still stopped

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU1.R2 — A reviewer that never finishes is still stopped inside that maximum and reported as a timeout

### Scenario: A reviewer that never answers is stopped and reported as a timeout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An explicitly configured budget replaces the size-derived one

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU1.R3 — One slow or stale reviewer executable cannot consume every other installed candidate's opportunity

### Scenario: A slow first reviewer executable still leaves the next one a chance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every reviewer executable failing still reports a timeout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.TBU2.R1 — A reviewer that supports typed output is given the exact result contract the check will enforce

### Scenario: The Codex reviewer is told the exact shape its answer must take

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The contract handed out matches the contract enforced

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

### Scenario: An answer using a severity outside the contract is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An answer carrying an extra field is rejected

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

## Rule: reliable-reviews-for-real-packets.TBU3.R4 — Each attempted route gets its own bounded budget, so an exhausted first attempt cannot leave the retry with no time to run

### Scenario: The alternate-model retry gets its own budget

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every route exhausting its own budget ends the run

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

### Scenario: An exhausted run never claims a review happened

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: reliable-reviews-for-real-packets.NTB1.R2 — An explanation never carries raw reviewer output, diagnostic noise, or credentials

### Scenario: Reviewer diagnostic noise never reaches the explanation

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
