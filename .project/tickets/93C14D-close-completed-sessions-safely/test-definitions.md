# Test Definitions: Close completed sessions safely

Feature source: `features/close-completed-sessions-safely.feature`

test-definitions.md is the R/G/R ledger. Scenario Outline rows below represent
the matching executable outlines in the feature source while using the ledger's
required `Scenario:` heading grammar.

## Rule: close-completed-sessions-safely.NTB1.R1 — Completion is reported only from independently observed delivery and cleanup state

### Scenario: Current delivery evidence makes an authorized merge eligible

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Incomplete delivery evidence blocks merge and cleanup

- [x] RED 7559b2855
- [x] GREEN 681b1316e
- [x] REFACTOR skip: first slice is already one concise observation gate

### Scenario: A fully closed delivery reports every final state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: close-completed-sessions-safely.NTB1.R2 — Retrospective capture is a mandatory prerequisite to destructive cleanup

### Scenario: A completed retro permits cleanup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Incomplete retro blocks cleanup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A request to skip retro does not create a bypass

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: close-completed-sessions-safely.NTB1.R3 — An interrupted closeout resumes from observed state and reports every unresolved item

### Scenario: Closeout continues only the unfinished suffix

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A local merge-command error after remote success is partial success

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unconfirmed merge result stops safely

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocked closeout reports every simultaneous unresolved item

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Re-running a completed closeout is unchanged

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: close-completed-sessions-safely.TBU1.R1 — Merge actions never exceed the authority explicitly granted by the user

### Scenario: Explicit authority bounds the merge action

- [x] RED 2fde0446f
- [x] GREEN 28489255c
- [ ] REFACTOR

### Scenario: Normal authority never escalates to an administrative merge

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Historical or implied admin intent is insufficient

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: close-completed-sessions-safely.TBU1.R2 — Cleanup targets only the confirmed merged pull request's exact topic branch and linked worktree

### Scenario: Missing, ambiguous, or unmerged pull request identity blocks cleanup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Exact merged identity permits ordered cleanup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A squash or rebase merge can clean an exact non-ancestor branch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Already absent exact targets remain complete

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A merged topic branch with no linked worktree cleans only its exact branches

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Changed branch identity is preserved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: close-completed-sessions-safely.TBU1.R3 — Protected, dirty, locked, main, or ambiguous targets are preserved and reported instead of force-removed

### Scenario: Unsafe worktree targets are never removed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A branch used by a different worktree is preserved

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: close-completed-sessions-safely.TBU1.R4 — The same closeout contract is available through every supported local agent runtime

### Scenario: Each local host entry point drives the canonical closeout workflow

- [x] RED 7b60686d2
- [x] GREEN 33066145e
- [x] REFACTOR skip: production catalogues already centralize host generation

### Scenario: Synchronized closeout artifacts pass host parity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Closeout drift fails parity at the changed surface

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Feature-level cross-scenario refactor

- [ ] cross-scenario
