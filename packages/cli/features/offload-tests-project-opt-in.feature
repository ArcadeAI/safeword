@wip
Feature: Configure remote verification for a project

  @offload-tests.TBU1.R1
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R1 — Projects use remote verification only after an explicit opt-in

    @public-cli @surface.safeword-cli
    Scenario Outline: Project execution mode is durable reconciled and status-visible
      Given the project begins with <starting-state> and no authenticated pending request blocks reconciliation
      When the builder runs <mode-command>
      Then <mode-outcome>
      Examples:
        | starting-state | mode-command | mode-outcome |
        | local mode with no managed installation | `safeword project test-execution set remote-preferred` | requested intent is published durably before standard setup reconciliation atomically installs the exact managed workflow and identity, the command exits zero only after installed identity makes remote-preferred effective, and status reports configured and effective `remote-preferred` |
        | remote-preferred with an unchanged managed installation | `safeword project test-execution set local` | standard disable reconciliation transactionally removes requested intent, workflow and identity, the command exits zero only after local is effective, and status reports configured and effective `local` |
        | remote-preferred requested but installation incomplete or conflicted | `safeword project test-execution status` | the command exits zero without mutation and separately reports configured `remote-preferred`, effective `local`, and the exact setup recovery action |
        | complete local mode with no managed installation | `safeword project test-execution status` | the command exits zero without mutation and reports configured `local`, effective `local`, GitHub provider `not installed`, and no recovery action |
        | complete remote-preferred mode with the exact installed identity | `safeword project test-execution status` | the command exits zero without mutation and reports configured `remote-preferred`, effective `remote-preferred`, GitHub provider `installed`, the managed identity version, and request-specific eligibility still evaluated per run |

    @public-cli @surface.safeword-cli
    Scenario Outline: An optional personal config chooses the contributor default without owning project installation
      Given the project has <project-state> and the resolved namespace root's `personal/config.json` is <personal-state>
      When the builder runs `safeword project test --lane <lane>` without an execution override and then runs `safeword project test-execution status`
      Then <personal-outcome>, the test command reports command scope `absent` and its winning source, and project configuration and managed workflow bytes remain unchanged
      And status exits zero and reports scopes in exact highest-first order as command `not applicable`, personal, project, and built-in `local`, with each exact origin, value, and winning source
      Examples:
        | project-state | personal-state | lane | personal-outcome |
        | effective remote-preferred with exact GitHub installation | absent | full | project mode wins, one remote dispatch is accepted, and no local plan starts |
        | effective remote-preferred with exact GitHub installation | exact schema version 1 with `testExecution` set to `local` | done | personal mode wins, no dispatch is attempted, and the local test plan runs once |
        | effective remote-preferred with exact GitHub installation | exact schema version 1 with `testExecution` set to `remote-preferred` | full | personal mode wins, one remote dispatch is accepted, and no local plan starts |
        | project local with no managed GitHub installation | exact schema version 1 with `testExecution` set to `remote-preferred` | done | personal preference is reported but cannot install or activate GitHub, proven-no-dispatch fallback runs the local test plan once, and status names provider `not installed` |
        | project local with no managed GitHub installation | absent | full | project local mode wins, no dispatch is attempted, and the local verify plan runs once |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Personal execution config is optional strict contained and local to the worktree
      Given project remote-preferred mode is installed and the resolved namespace-root personal path has <personal-boundary>
      When the builder runs `safeword project test-execution status` and then `safeword project test --lane done`
      Then <personal-contract>
      Examples:
        | personal-boundary | personal-contract |
        | no file | status exits zero with personal source `absent`, the project mode remains effective, and the test request follows it |
        | exact regular JSON file `{"schemaVersion":1,"testExecution":"local"}` below the resolved namespace root | status exits zero naming that exact origin and local wins without changing project bytes |
        | malformed JSON | both commands exit nonzero with SAFEWORD_TEST_EXECUTION_INVALID, name the exact personal origin, send no dispatch, run no local plan and mutate nothing |
        | duplicate raw keys | both commands exit nonzero with SAFEWORD_TEST_EXECUTION_INVALID, name the exact personal origin, send no dispatch, run no local plan and mutate nothing |
        | an unknown key | both commands exit nonzero with SAFEWORD_TEST_EXECUTION_INVALID, name the exact personal origin, send no dispatch, run no local plan and mutate nothing |
        | a missing required key | both commands exit nonzero with SAFEWORD_TEST_EXECUTION_INVALID, name the exact personal origin, send no dispatch, run no local plan and mutate nothing |
        | a wrong JSON type for `schemaVersion` or `testExecution` | both commands exit nonzero with SAFEWORD_TEST_EXECUTION_INVALID, name the exact personal origin, send no dispatch, run no local plan and mutate nothing |
        | wrong schema version | both commands exit nonzero with SAFEWORD_TEST_EXECUTION_INVALID, name the exact personal origin, send no dispatch, run no local plan and mutate nothing |
        | mode outside `local\|remote-preferred` | both commands exit nonzero with SAFEWORD_TEST_EXECUTION_INVALID, name the exact personal origin, send no dispatch, run no local plan and mutate nothing |
        | a file of exactly 65537 bytes | both commands fail closed with SAFEWORD_TEST_EXECUTION_INVALID before execution or mutation |
        | an unreadable regular file | both commands fail closed with SAFEWORD_TEST_EXECUTION_INVALID before execution or mutation |
        | a directory | both commands fail closed with SAFEWORD_TEST_EXECUTION_INVALID before execution or mutation |
        | a special file | both commands fail closed with SAFEWORD_TEST_EXECUTION_INVALID before execution or mutation |
        | a symlink | both commands fail closed with SAFEWORD_TEST_EXECUTION_INVALID without following the unsafe object, execution or mutation |
        | a hard link with link count above one | both commands fail closed with SAFEWORD_TEST_EXECUTION_INVALID without overwriting the alias, execution or mutation |
        | a path escaping the resolved namespace root | both commands fail closed with SAFEWORD_TEST_EXECUTION_INVALID without reading outside the namespace root, execution or mutation |
        | the leaf is replaced between classification and open | the pinned-object identity check fails both commands closed with SAFEWORD_TEST_EXECUTION_INVALID, zero execution and zero mutation |
        | the leaf identity changes between open, read and final verification | the pinned-object identity check fails both commands closed with SAFEWORD_TEST_EXECUTION_INVALID, zero execution and zero mutation |
        | a parent directory is replaced between resolution, child open and final verification | the pinned-parent identity check fails both commands closed with SAFEWORD_TEST_EXECUTION_INVALID, zero execution and zero mutation |
        | a valid file in the current worktree while another worktree has a different valid file | each status and request uses only its own resolved worktree origin and never silently shares personal mode across worktrees |

    @rejection @public-cli @surface.safeword-cli @proof.pending-vitest
    Scenario: The personal-config boundary manifest is complete and executes every fixture independently
      Given the personal-config manifest assigns stable IDs to absence and both valid modes
      And it covers JSON grammar, keys, types, values, byte limits, and read failures
      And it covers object kinds, links, namespace escape, replacement races, and worktree separation
      When an independent manifest parser compares those IDs with the generated fixtures and runs each ID in one isolated process without importing production parser tables
      Then generated and executed fixture IDs exactly equal the manifest
      And every fixture reaches its prescribed output, execution, mutation, and origin result
      And missing, extra, collapsed, skipped, or early-terminated fixtures fail the proof

    @public-cli @surface.safeword-cli
    Scenario Outline: Each request resolves the project mode and a non-persistent execution override
      Given the project has <configured-state>
      When the builder runs <test-command>
      Then <execution-outcome> and project configuration remains byte-identical
      Examples:
        | configured-state | test-command | execution-outcome |
        | effective local mode | `safeword project test --lane done` | no dispatch is attempted and the done lane runs locally once |
        | effective remote-preferred mode and an eligible checkout | `safeword project test --lane full` | the full lane dispatches remotely and no local plan runs before acceptance |
        | effective remote-preferred mode | `safeword project test --lane done --execution local` | no dispatch is attempted and the done lane runs locally once as an explicit override |
        | effective remote-preferred mode and an eligible checkout | `safeword project test --lane full --execution remote-preferred` | the full lane dispatches remotely without changing the durable mode |
        | configured local mode with no installed workflow | `safeword project test --lane done --execution remote-preferred` | Safeword reports remote execution is not installed, proves no dispatch exists, and safely runs the done lane locally once without opting in or creating managed files |
        | project remote-preferred with personal local mode | `safeword project test --lane full --execution remote-preferred` | command scope wins, the full lane dispatches remotely, and personal and project bytes remain unchanged |
        | project remote-preferred with personal remote-preferred mode | `safeword project test --lane done --execution local` | command scope wins, no dispatch is attempted, the done lane runs locally once, and personal and project bytes remain unchanged |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Execution-mode commands reject an open-ended grammar without execution or mutation
      Given project configuration and managed paths are captured byte-for-byte
      When the builder runs <invalid-command>
      Then the command exits nonzero with SAFEWORD_TEST_EXECUTION_INVALID, starts no local plan, sends no dispatch, and configuration and managed paths remain byte-identical
      Examples:
        | invalid-command |
        | `safeword project test-execution set remote` |
        | `safeword project test-execution set auto` |
        | `safeword project test-execution set remote-preferred local` |
        | `safeword project test-execution set remote-preferred --unknown` |
        | `safeword project test --lane verify` |
        | `safeword project test --lane done --lane full` |
        | `safeword project test --lane done --execution remote` |
        | `safeword project test --lane done --execution local --execution remote-preferred` |
        | `safeword project test --lane done --unknown` |
        | `safeword project test done` |

    @public-cli @surface.safeword-cli
    Scenario: Explicit opt-in persists before managed installation
      Given a project explicitly enables GitHub-hosted Safeword verification
      When the public Safeword CLI reconciles project setup
      Then a test-owned filesystem event recorder observes requested opt-in write, file fsync, rename and parent-directory fsync before any workflow or identity path mutation

    @public-cli @surface.safeword-cli
    Scenario: Setup gitignores personal configuration without overwriting authored ignore rules
      Given the resolved namespace root has byte-recorded authored ignore rules and may use the default, legacy or custom configured path
      When `safeword setup` runs twice
      Then the first run adds one anchored `/personal/` ignore entry without changing authored lines
      And the second run is byte-idempotent and creates no personal directory or config file
      And an already tracked personal file is preserved while status warns that it is not private

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Requested opt-in publication failures leave only an absent or complete intent
      Given workflow and identity paths are absent and requested-intent publication encounters <intent-failure>
      When public invocation `failed-setup` attempts setup
      Then `failed-setup` records its own nonzero exit, error output, filesystem trace, and zero network trace
      And no workflow or identity mutation occurs
      And requested intent is absent or complete according to the frozen observed rename state
      Examples:
        | intent-failure |
        | permission failure before write |
        | ENOSPC before write |
        | short configuration write |
        | configuration-file fsync failure |
        | configuration rename failure |
        | configuration parent-directory fsync failure |
        | process crash before rename |
        | process crash after rename but before directory fsync |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Setup safely retries from the frozen requested-intent state
      Given `failed-setup` encountered <intent-failure> and the recorder froze its absent-or-complete requested-intent state
      When public invocation `retry-setup` restarts without the fault
      Then `retry-setup` has a separately captured exit, output and mutation trace and safely resumes only from the frozen observed state without changing `failed-setup` evidence
      Examples:
        | intent-failure |
        | permission failure before write |
        | ENOSPC before write |
        | short configuration write |
        | configuration-file fsync failure |
        | configuration rename failure |
        | configuration parent-directory fsync failure |
        | process crash before rename |
        | process crash after rename but before directory fsync |

    @public-cli @surface.safeword-cli
    Scenario: Opted-in setup commits one exact workflow identity pair
      Given project configuration durably records requested opt-in
      And an independent interceptor enumerates every production initial-install durability site
      And a literal manifest maps both restart boundaries to exact workflow, identity, configuration, staged, and journal states
      When the harness enumerates production sites, generates both restart boundaries for each, and runs each public CLI restart in isolation
      Then production-site and restart-result labels have exact set and cardinality equality with the literal manifest, and each result enters its manifested row before the final three members agree and the journal is removed

    @public-cli @surface.safeword-cli
    Scenario: Repeating opted-in setup is byte-idempotent
      Given opted-in setup completed with an agreeing workflow and recorded identity
      When the public Safeword CLI reconciles setup again
      Then configuration, workflow and identity bytes are unchanged and no transaction journal remains

    @rejection
    Scenario Outline: Opted-out setup preserves absent or unowned workflow and identity paths
      Given a project has not enabled remote verification, has byte-recorded configuration and a customer-authored workflow, and the identity path is <identity-state>
      When the public Safeword CLI reconciles setup
      Then configuration and workflow remain byte-identical, the identity path remains <identity-outcome>, no managed identity is adopted, and the project remains opted out
      Examples:
        | identity-state | identity-outcome |
        | absent | absent |
        | occupied by stale or hostile unowned bytes | byte-identical to those unowned bytes |

    @rejection
    Scenario Outline: An opted-out test request sends no dispatch
      Given a project has not enabled remote verification
      When the builder runs `safeword project test --lane <lane>` without an execution override
      Then it resolves <plan-kind> through the real local plan resolver, invokes the unchanged deterministic plan exactly once, accounts for every descendant, propagates its exact exit, and sends no GitHub dispatch
      Examples:
        | lane | plan-kind |
        | done | `test` |
        | full | `verify` |

    @public-cli @surface.safeword-cli
    Scenario: Disabling an unchanged managed installation removes it transactionally
      Given an enabled project has exact managed workflow and identity bytes and no pending request
      When the public Safeword CLI disables remote verification and reconciles setup
      Then opt-in configuration, workflow and identity are removed as one journaled transition and a second reconciliation changes nothing

    @rejection @public-cli @surface.safeword-cli
    Scenario: Disabling preserves customer-modified workflow bytes
      Given an enabled project's live workflow differs from its recorded installed base
      When the public Safeword CLI disables remote verification and reconciles setup
      Then configuration and live artifacts remain byte-identical and output reports a no-mutation conflict with recovery guidance

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Disable never removes an installation needed by an authenticated pending record
      Given byte-recorded exact installed configuration, workflow and identity, an absent reconciliation journal, and pending records that include <pending-dependency>
      When the public Safeword CLI requests disable before and after an injected restart
      Then <disable-dependency-outcome>
      Examples:
        | pending-dependency | disable-dependency-outcome |
        | one open authenticated record referencing the installed identity | disable is refused and every recorded byte remains unchanged |
        | multiple records with one open dependency and other closed or unrelated records | disable is refused and every recorded byte remains unchanged |
        | only closed records or open records referencing another retained identity | disable proceeds without changing any pending-record bytes |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Interrupted disable resumes to one complete state
      Given disable stopped with <observed-state>, no pending identity dependency, and no hostile or replaced path
      When the public Safeword CLI resumes reconciliation
      Then <disable-outcome>
      Examples:
        | observed-state | disable-outcome |
        | an authenticated durable removal journal recording exact old workflow, identity and configuration bytes and exact absent new state, with all three live members still matching old | removal rolls back to the exact enabled set, preserves opt-in configuration, removes unused transaction artifacts, and removes the journal last |
        | the same authenticated journal, with workflow absent and live identity and configuration exactly matching recorded old bytes | identity removal completes and configuration disables before journal removal |
        | the same authenticated journal, with workflow and identity absent and live configuration exactly matching recorded old bytes | configuration disables and journal removal completes without recreating artifacts |
        | the same authenticated journal, with at least one live member matching neither its recorded old bytes nor absent new state | all live bytes and opt-in configuration remain unchanged and setup reports conflict with the journal retained |
