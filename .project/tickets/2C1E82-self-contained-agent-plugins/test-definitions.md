# Test Definitions: Make each agent plugin fully self-contained

Feature source: `packages/cli/features/self-contained-agent-plugins.feature`

test-definitions.md is the R/G/R ledger.

## Rule: self-contained-plugins.TBU1.R1 — every advertised agent workflow executes from its one declared runtime authority without borrowing another delivery

### Scenario: A plugin-backed agent executes quality review in a runtime-free enrolled project

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A plugin-backed agent ignores a complete legacy project runtime

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A packaged audit helper preserves its shared-shell contract

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Cursor executes from its selected project authority without another host

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Mixed hosts execute only from their own declared authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An incomplete agent authority fails in a bounded way for every host

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.TBU1.R2 — invoking an agent workflow never requires a broader installation solely to recover executable code already owned by its delivery authority

### Scenario: Codex audit does not escalate a missing project helper into installation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Claude rejects installer escalation as plugin capability recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.TBU1.R3 — agent execution reads enrolled project knowledge and writes project workflow state without turning either into a second runtime distribution

### Scenario: Every host adapter enforces the enrollment boundary for lifecycle state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An agent workflow uses project knowledge without project executable files

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An enrolled lifecycle event performs its declared state effect

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unenrolled repository does not gain invented project knowledge or state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A workflow invocation does not silently enroll a repository

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Malformed enrollment is preserved rather than repaired as runtime state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Missing authored knowledge is not invented during lazy state initialization

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.TBU1.R4 — a workflow creates its missing framework-owned runtime state on demand without requiring an install or upgrade

### Scenario: Every host initializes a missing state file and parent directory

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Existing runtime state is reopened without replacement

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unwritable state path does not escalate to lifecycle installation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.TBU1.R5 — lazy initialization adds any required narrow gitignore rule idempotently while preserving existing project ignore content

### Scenario: Every host adds one precise ignore rule on first state initialization

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: First state initialization creates a missing project ignore file

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: State initialization appends a precise rule without replacing customer ignore content

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repeated state access does not duplicate or broaden ignore policy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A broader customer ignore rule is preserved without adding a narrower duplicate

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unwritable ignore file prevents unignored transient state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reconciliation preserves lazily initialized state policy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.NTB1.R1 — selecting one agent never proposes another agent's files, skills, hooks, configuration, or dependencies

### Scenario: A single-agent plan contains no other agent delivery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A plugin-backed agent plan contains no project runtime copy

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unselected host asset makes a single-agent plan invalid

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.NTB1.R2 — an installation plan distinguishes the minimal shared project substrate from selected-agent delivery and optional workflow tooling, and explains why each effect is required

### Scenario: A native-plugin plan classifies every project effect by owner

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Declining optional workflow tooling produces no tooling effects

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A monorepo plan excludes unrelated language-tool fan-out

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.NTB1.R3 — a single missing plugin capability fails with one bounded recovery action rather than expanding into repository-wide setup

### Scenario: Missing packaged audit support reports one capability recovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Capability recovery cannot invoke the full project installer

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.NTB1.R4 — automatic state initialization is silent when successful and names the exact state path and recovery when it cannot be created

### Scenario: Successful state initialization does not interrupt the workflow

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Failed state initialization does not masquerade as missing installation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.SWM1.R1 — each host's delivery contract explicitly classifies executable runtime, shared project substrate, authored state, and host-specific assets

### Scenario: Managed assets use their required lifecycle class

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every managed asset has exactly one lifecycle class

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unclassified executable asset fails contract validation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An asset with two lifecycle classes fails contract validation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.SWM1.R2 — selecting multiple agents produces the union of their declared requirements without duplicate runtime authorities or order-dependent output

### Scenario: Every mixed-agent selection produces an order-independent plan

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Every mixed-agent selection contains the complete authority union

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Mixed selection cannot duplicate or replace Cursor's authority

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repeated reconciliation has no additional effects

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.SWM1.R3 — release and parity checks reject any agent workflow that references an executable outside its declared runtime authority

### Scenario: Complete agent catalogues pass executable-reference validation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A cross-authority executable reference blocks release

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A plugin executable version mismatch blocks release

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: self-contained-plugins.SWM1.R4 — upgrades and uninstalls remove only proven host-owned runtime while preserving authored, ambiguous, and other selected-host content

### Scenario: Proven plugins retire recognized obsolete project runtime

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Plugin cleanup preserves selected Cursor delivery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Uninstall removes only the selected host's owned delivery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unsafe legacy cleanup remains blocked

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
