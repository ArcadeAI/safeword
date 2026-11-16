# Test Definitions: Resolve disputed plan findings without review loops

Feature source: `features/resolve-disputed-plan-findings.feature`

OpenCode CLI/TUI/Desktop delivery and proof are excluded by the user's 2026-11-14 decision (#7491). The three OpenCode example rows were removed from the active outlines. Review added the exhausted-classification fallback example; all 27 scenario headings remain unchecked. Historical RED, failures and 33 deferred cases are unchanged.

test-definitions.md is the R/G/R ledger. The previous unchecked ledger is preserved in `historical-test-definitions.md`.

## Rule: plan-implementability.TBU5.26FK42.R1 — An originating reviewer cannot be the sole adjudicator of its disputed finding

### Scenario: A reviewer cannot unilaterally settle its own disputed finding

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Exhausted classification routes cannot reuse the originating reviewer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing reviewer provenance prevents adjudication

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A fresh adjudicator can settle optional classification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU5.26FK42.R2 — Disagreements have explicit effects on progress and user-owned scope

### Scenario: Nonblocking advice can be disputed without stopping progress

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unsupported dispute class is refused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A disputed blocking finding remains unapproved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A disagreement without supporting evidence is refused

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unrelated work continues while a blocking finding is unresolved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every change to accepted product scope belongs to the user

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Correcting an in-scope omission does not change scope

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Provenance determines review currency

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A currency dispute is settled by provenance rather than either party

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU5.26FK42.R3 — A disputed optional classification cannot make unaccepted advice blocking

### Scenario: A disputed optional classification follows the existing nonblocking rule

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocking label no longer blocks after independent optional classification

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An adjudicator cannot make unaccepted scope required

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A genuine in-scope defect cannot be dismissed as optional advice

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Calling a blocking in-scope finding optional does not approve the plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Accepted unfinished scope blocks the plan gate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU5.26FK42.R4 — Headless work records pending decisions without inventing approval

### Scenario: A headless run returns promptly with a pending decision

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A later session recovers the pending decision

2026-11-16 corrected executable-RED review ca0022ad-bfd1-47d6-845e-aee54eb9721d
attests the intended missing durable pending disposition (matched literal, exit 1,
no timeout). Independent review remains blocked on reviewer authentication, with
no verdict or GREEN authority. Full result: `2026-11-16-corrected-executable-red.json`.
Earlier lock, EPERM and unreviewed run records remain historical evidence.

2026-11-16 local persistence RED observed: corrected sandbox-compatible fixture fails
on `missing durable pending disposition`. Review 7b142a46-d0a0-4b6f-9b3a-e9f8fbf5e609
remains blocked with no independent verdict; its attested run predates the fixture
correction and failed on EPERM. See `2026-11-16-persistence-red-evidence.json` and
`2026-11-16-executable-red-failure.json`. No full-scenario RED completion or GREEN
is claimed, and native recovery remains unproven.

Task 1 local process-survival proof: `packages/cli/tests/integration/planning-dispute-persistence.test.ts`.
2026-11-14 runs exited 75 while waiting for the shared package-test lock (60 seconds,
then ten minutes); neither started a test. RED is unproven and no executable-RED
review was dispatched. This proof cannot satisfy reclaimed-cloud recovery or the
Execution Plan's native-handoff checkpoint.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An available user resolves the pending choice

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Headless unresolved correctness is not reported as approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: plan-implementability.TBU5.26FK42.R5 — A fresh review follows material correction, not silent redispatch

### Scenario: Every supported disagreement records a disposition and recovery action

Lower-level proof enumerates every supported dispute class and its typed
disposition and recovery action, including unsupported-class refusal.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A correction requires a fresh passing verdict before approval

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A review request distinguishes correction from retry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Later material corrections remain eligible for review

Lower-level proof must vary the number of prior materially corrected passes,
including large values, and verify no pass-count cap prevents fresh review.

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Local persistence evidence

This records the first local producer/consumer substep, not completion of the
multi-host recovery outline. All full-scenario checkboxes above remain unchecked.

| Step | Evidence | Limit |
| --- | --- | --- |
| RED | 3fb417805; current cross-agent Claude receipt 4000a6bb-7f86-4680-8f75-e51253c82b00 | Intended missing durable pending disposition through the real CLI; simulated reviewer process |
| GREEN | 032f5525b; 80/80 tests in the four targeted suites; typecheck and focused lint pass | Legacy no-input persistence only; explicit routing, broader key checks and admission proof remain outstanding |
| Refactoring assessment | Reused the existing atomic writer and identity owner; additional extraction skipped after lint cleanup | No full-feature refactor completion claimed |
| Native checkpoint | Missing; execution Task 3 remains required before Tasks 4–8 or the prescribed design reassessment | Main-based isolated plugin has not been overwritten with feature code; no native/cloud or NTB proof supplied |
