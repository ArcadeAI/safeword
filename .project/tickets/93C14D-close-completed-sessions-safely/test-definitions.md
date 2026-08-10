# Test Definitions: Close completed sessions safely

Feature source: `features/close-completed-sessions-safely.feature`

test-definitions.md is the R/G/R ledger. Scenario Outline rows below represent
the matching executable outlines in the feature source while using the ledger's
required `Scenario:` heading grammar.

## Rule: close-completed-sessions-safely.NTB1.R1 — Completion is reported only from independently observed delivery and cleanup state

### Scenario: Current delivery evidence makes an authorized merge eligible

- [x] RED 7559b2855
- [x] GREEN 681b1316e
- [x] REFACTOR skip: the readiness gate shares the same current-evidence predicate

### Scenario: Incomplete delivery evidence blocks merge and cleanup

- [x] RED 7559b2855
- [x] GREEN 681b1316e
- [x] REFACTOR skip: first slice is already one concise observation gate

### Scenario: A fully closed delivery reports every final state

- [x] RED 9324b87f8
- [x] GREEN 29bf0cc66
- [x] REFACTOR skip: the final report is one ordered durable-state checklist

## Rule: close-completed-sessions-safely.NTB1.R2 — Retrospective capture is a mandatory prerequisite to destructive cleanup

### Scenario: Retro extraction runs in the bound host runtime

- [x] RED skip: legacy scenario did not retain its original red commit metadata
- [x] GREEN 15c1d9dc3
- [x] REFACTOR skip: runtime selection is a small pure mapping while the real subprocess boundary test proves the environment is forwarded

### Scenario: A completed retro permits cleanup

- [x] RED 0170c9663
- [x] GREEN 4e7238eff
- [x] REFACTOR skip: the shared prerequisite states both accepted outcomes without duplication

### Scenario: Incomplete retro blocks cleanup

- [x] RED 0170c9663
- [x] GREEN 4e7238eff
- [x] REFACTOR skip: failure states share one fail-closed boundary and recovery contract

### Scenario: Filing completed retro drafts resumes without re-extraction

- [x] RED skip: the receipt behavior shipped before this scenario was added to the ledger
- [x] GREEN f6622f29d
- [x] REFACTOR skip: the recovery test keeps the runner boundary explicit and proves one extraction across filing recovery

### Scenario: A request to skip retro does not create a bypass

- [x] RED 0170c9663
- [x] GREEN 4e7238eff
- [x] REFACTOR skip: the no-bypass clause is already minimal and explicit

## Rule: close-completed-sessions-safely.NTB1.R3 — An interrupted closeout resumes from observed state and reports every unresolved item

### Scenario: Closeout continues only the unfinished suffix

- [x] RED af86a036e
- [x] GREEN e0bce09f1
- [x] REFACTOR skip: reviewed the concise state-transition guidance; no structural change improved it

### Scenario: Exact evidence is reused through preview, replay, and approved apply

- [x] RED skip: the receipt behavior shipped before this scenario was added to the ledger
- [x] GREEN f6622f29d
- [x] REFACTOR skip: the host-adapter test names each verification lane and proves the same workflow across every local runtime

### Scenario: Changed evidence invalidates the matching cached prerequisite

- [x] RED skip: the receipt behavior shipped before this scenario was added to the ledger
- [x] GREEN f6622f29d
- [x] REFACTOR skip: a focused rewrite test proves altered session context re-runs extraction while append-only continuation remains reusable

### Scenario: A local merge-command error after remote success is partial success

- [x] RED af86a036e
- [x] GREEN e0bce09f1
- [x] REFACTOR skip: fresh observation already cleanly separates remote success from local failure

### Scenario: An unconfirmed merge result stops safely

- [x] RED af86a036e
- [x] GREEN e0bce09f1
- [x] REFACTOR skip: the unknown-state stop shares the re-observation boundary

### Scenario: A blocked closeout reports every simultaneous unresolved item

- [x] RED 9324b87f8
- [x] GREEN 29bf0cc66
- [x] REFACTOR skip: all blocker collection is centralized in the report contract

### Scenario: Re-running a completed closeout is unchanged

- [x] RED af86a036e
- [x] GREEN e0bce09f1
- [x] REFACTOR skip: the already-closed terminal state is explicit and idempotent

## Rule: close-completed-sessions-safely.TBU1.R1 — Merge actions never exceed the authority explicitly granted by the user

### Scenario: Explicit authority bounds the merge action

- [x] RED 2fde0446f
- [x] GREEN 28489255c
- [x] REFACTOR skip: authority states are explicit and non-duplicative

### Scenario: Normal authority never escalates to an administrative merge

- [x] RED 2fde0446f
- [x] GREEN 28489255c
- [x] REFACTOR skip: the no-escalation rule is already one direct prohibition

### Scenario: Historical or implied admin intent is insufficient

- [x] RED 2fde0446f
- [x] GREEN 28489255c
- [x] REFACTOR skip: current-request authority is centralized and unambiguous

## Rule: close-completed-sessions-safely.TBU1.R2 — Cleanup targets only the confirmed merged pull request's exact topic branch and linked worktree

### Scenario: Missing, ambiguous, or unmerged pull request identity blocks cleanup

- [x] RED 195b7fe03
- [x] GREEN 29bf0cc66
- [x] REFACTOR skip: identity blockers share the guard's single collection path

### Scenario: Exact merged identity permits ordered cleanup

- [x] RED 195b7fe03
- [x] GREEN 29bf0cc66
- [x] REFACTOR skip: the operation union enforces one explicit order

### Scenario: A squash or rebase merge can clean an exact non-ancestor branch

- [x] RED feb055f0c
- [x] GREEN b184af7f9
- [x] REFACTOR skip: compare-and-swap update-ref deliberately avoids ancestry logic

### Scenario: Already absent exact targets remain complete

- [x] RED 195b7fe03
- [x] GREEN 29bf0cc66
- [x] REFACTOR skip: absence handling is centralized in plan completion fields

### Scenario: A merged topic branch with no linked worktree cleans only its exact branches

- [x] RED 195b7fe03
- [x] GREEN 29bf0cc66
- [x] REFACTOR skip: the same exact-target planner naturally omits the absent worktree

### Scenario: Changed branch identity is preserved

- [x] RED 195b7fe03
- [x] GREEN 29bf0cc66
- [x] REFACTOR skip: local and remote OID mismatches share the fail-closed identity check

## Rule: close-completed-sessions-safely.TBU1.R3 — Protected, dirty, locked, main, or ambiguous targets are preserved and reported instead of force-removed

### Scenario: Unsafe worktree targets are never removed

- [x] RED 195b7fe03
- [x] GREEN 29bf0cc66
- [x] REFACTOR skip: unsafe worktree states share one no-operation blocker path

### Scenario: A branch used by a different worktree is preserved

- [x] RED 195b7fe03
- [x] GREEN 29bf0cc66
- [x] REFACTOR skip: multiple branch users resolve as an ambiguous worktree blocker

## Rule: close-completed-sessions-safely.TBU1.R4 — The same closeout contract is available through every supported local agent runtime

### Scenario: Each local host entry point drives the canonical closeout workflow

- [x] RED 7b60686d2
- [x] GREEN 33066145e
- [x] REFACTOR skip: production catalogues already centralize host generation

### Scenario: Synchronized closeout artifacts pass host parity

- [x] RED 7b60686d2
- [x] GREEN 33066145e
- [x] REFACTOR skip: production generation and parity catalogues remain the single source

### Scenario: Closeout drift fails parity at the changed surface

- [x] RED 7b60686d2
- [x] GREEN 33066145e
- [x] REFACTOR skip: existing surface-specific parity failures need no duplicate mechanism

## Feature-level cross-scenario refactor

- [x] cross-scenario 635d192bb
