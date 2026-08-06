# Test Definitions: Keep independent reviews reliable for real ticket packets

Feature source: `packages/cli/features/reliable-reviews-for-real-packets.feature`

test-definitions.md is the R/G/R ledger.

Every scenario below is executable and green in the Cucumber acceptance lane
(`bun run --cwd packages/cli test:bdd`). The behaviour each proves was built
RED-then-GREEN in the commits cited; the acceptance steps were written last,
against the finished command, so RED for those rows is recorded as the lane
failing with the scenario undefined before its step existed.

## Rule: reliable-reviews-for-real-packets.TBU1.R1 — Every review attempt gets the same documented deadline, set well above the slowest review anyone has observed

### Scenario: A representative ticket-sized review is given time to finish

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A packet over the accepted maximum is refused rather than reviewed

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU1.R2 — A reviewer that never finishes is still stopped at its deadline and reported as a timeout

### Scenario: An explicitly configured deadline replaces the default

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A reviewer that never answers is stopped and reported as a timeout

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU1.R3 — A route's budget is split across its untried candidates, so one slow or stale executable cannot consume every other candidate's opportunity

### Scenario: A slow first reviewer executable still leaves the next one a chance

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: Every reviewer executable failing still reports a timeout

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU1.R4 — However a reviewer ends, Safe Word stops it and the descendants its platform lets it reach, never waits on what the system will not kill, never claims to have stopped what escaped, and never uses a late answer

### Scenario: Cleanup reaches every descendant the platform groups with the reviewer

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A late answer after a timeout is ignored

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU2.R1 — A reviewer that supports typed output is given the exact result contract the check will enforce

### Scenario: A Codex answer that follows the contract is accepted

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A reviewer that cannot be given the contract is not asked to review

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU2.R2 — A reviewer executable that cannot honour the result contract never costs a later candidate its turn — skipped before launch when that is knowable, failed fast when it is not

### Scenario: A reviewer executable without typed output is skipped for one that has it

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: No reviewer executable supporting typed output means no reviewer is available

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU2.R3 — A result that violates the contract is still rejected, whatever produced it

### Scenario: An answer following the contract is accepted

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: An answer using a severity outside the contract is rejected

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU3.R1 — An exhausted reviewer agent is retried on a configured alternate model before the author's own runtime

### Scenario: An exhausted reviewer agent is retried on its alternate model

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: An alternate model that fails promptly falls back to the author's own runtime

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU3.R2 — A review completed by the reviewer agent on its alternate model is still a full cross-agent check, and Safe Word's own review result names the model that reviewed

### Scenario: An alternate-model review still counts as a full independent check

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A review by the author's own runtime is not a cross-agent check

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU3.R3 — With no alternate model configured, routing is exactly what it is today, and Safe Word never supplies a model name of its own

### Scenario: A model value within the grammar is used as configured

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: An unusable configured model is treated as none configured

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU3.R4 — The default first route leaves at least the 120-second floor for a configured independent retry; every later route remains capped by the shared run bound

### Scenario: A route that uses its whole budget still leaves the next route its own

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: The preferred route leaves a fundable alternate-model retry

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU3.R5 — Every route is tried in a fixed order; the run bound stops any route whose reviewer has not exited with valid output before its deadline

### Scenario: Every route is tried, in order, before the run gives up

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: The run bound wins over trying the remaining routes

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.TBU3.R6 — The public review command carries all of this end to end, and the required-review policy decides on what it reports

### Scenario: The public review command completes through the alternate-model route

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A required review refuses an author-runtime result

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.NTB1.R1 — When both routes fail, the explanation names each route's own cause, not one generic failure

### Scenario: A timeout and a rejected answer are explained as two distinct causes

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: An exhausted run never claims a review happened

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.NTB1.R2 — An explanation never carries raw reviewer output, diagnostic noise, or credentials

### Scenario: An explanation is built only from Safe Word's own failure classification

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: Nothing a reviewer emits reaches the explanation

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Rule: reliable-reviews-for-real-packets.NTB1.R3 — A review that ran but was not independent still never satisfies a required cross-agent check

### Scenario: A preferred policy still returns a verdict labelled as not independent

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

### Scenario: A required cross-agent check is not satisfied by the author reviewing itself

- [x] RED skip: scenario reported undefined by the acceptance lane before its step definition existed
- [x] GREEN aec039245
- [x] REFACTOR skip: no structural improvement needed

## Feature-level cross-scenario refactor

- [x] cross-scenario ec724359c
