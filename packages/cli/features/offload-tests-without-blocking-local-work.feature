Feature: Offload tests without blocking local work

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

    @rejection @public-cli @surface.safeword-cli
    Scenario: The personal-config boundary manifest is complete and executes every fixture independently
      Given `packages/cli/tests/fixtures/test-execution-personal-config-v1.json` is a test-owned literal manifest with stable fixture IDs for absence, both valid modes, every raw JSON syntax and duplicate-key defect, each required or unknown key, every JSON type and unsupported value for each field, byte limits, read failures, every regular or special object kind, symlink and hard-link states, namespace escape, leaf and parent replacement points, and cross-worktree separation
      When an independent manifest parser compares those IDs with the generated fixtures and runs each ID in one isolated process without importing production parser tables
      Then expected ID set and cardinality equal generated and executed result sets and cardinalities, every ID reaches its one prescribed output, execution, mutation and origin result, and missing, extra, collapsed, skipped or early-terminated cases fail the test

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
      Then the first run adds exactly one anchored `/personal/` ignore entry under a Safeword comment without changing existing lines, the second run is byte-idempotent, no personal directory or config file is created, and an already tracked personal file is preserved but status warns it is not private

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Requested opt-in publication failures leave only an absent or complete intent
      Given workflow and identity paths are absent and requested-intent publication encounters <intent-failure>
      When public invocation `failed-setup` attempts setup
      Then `failed-setup` has its own captured nonzero exit, error output, filesystem trace and zero network trace; zero workflow or identity mutation occurred; and requested intent is either absent or complete according to the frozen observed rename state
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
      Given project configuration durably records requested opt-in, an independent syscall interceptor enumerates every production initial-install durability site, and a literal manifest maps before-and-after restart at each site to exact observed workflow, identity, configuration, staged and journal states
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

  @offload-tests.TBU1.R2
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R2 — Remote verification runs the requested Safeword test-plan lane against a clean commit confirmed as its same-repository branch tip immediately before workflow checkout

    @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario Outline: Each supported lane dispatches its resolved identity at the immutable pushed tip
      Given clean local HEAD is the same-repository remote branch tip
      When the builder runs `safeword project test --lane <lane>` under effective remote-preferred mode
      Then it selects remote plan kind <plan-kind> without locally invoking the plan resolver or any plan command before POST, and the observed dispatch contains exactly that lane, full local commit SHA, canonical branch ref, its SHA-256 digest and request token
      Examples:
        | lane | plan-kind |
        | done | test |
        | full | verify |

    @surface.github-actions-execution-sandbox
    Scenario: The workflow binds dispatch identity before immutable checkout
      Given a managed run received the exact dispatched lane, full SHA, branch ref and token
      When its trusted pre-check sequence executes
      Then it confirms the same branch tip immediately before one checkout of that full SHA using only GitHub's contents-read job token with credential persistence disabled

    @surface.github-actions-execution-sandbox
    Scenario Outline: Remote execution preserves each resolved-plan field
      Given a hand-authored test manifest and checked-out fixture independently record the exact expected value for <plan-field>
      When the exact pinned Safeword CLI resolves the dispatched lane inside the remote checkout and executes that plan
      Then the raw process event trace matches <expected-observation> without a transported or translated command table
      Examples:
        | plan-field | expected-observation |
        | exact UTF-8 command field interpreted as trusted POSIX shell source | the pinned shell executable and fixed option argv receive the exact independently recorded rendered-script bytes as their one script argument with no normalization or reparsing by Safeword |
        | exact environment contract | the child environment equals the independently recorded inherited-and-managed allowlist with no dispatch field interpolated into shell source |
        | working directory | each child cwd is byte-equal to its independently recorded canonical expected directory |
        | availability behavior | the exact independently named available-entry set starts once and the exact unavailable-entry set records unavailable with zero starts |
        | entry order | keyed monotonic start events have exact sequence equality with the independently recorded configured entry-ID order |
        | per-entry exit | every keyed raw child status equals its independently predetermined numeric or signal result |
        | aggregate exit | all-zero fixtures map exactly to step zero and workflow success, while predetermined first nonzero 23 or SIGTERM maps to step 23 or 143 and workflow failure with no later entry start |

    @rejection @process @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario Outline: Abnormal plan process boundaries terminate once without leaks or reruns
      Given the <execution-plane> executor has one deterministic plan entry and process evidence keys its wrapper, shell process, output pipes and descendants
      When the entry encounters <process-boundary>
      Then <terminal-contract>, the aggregate stops according to first-failure ordering, the entry is not rerun, every opened pipe is closed, and teardown proves no shell or descendant process remains
      Examples:
        | execution-plane | process-boundary | terminal-contract |
        | explicit local | shell spawn returns ENOENT before a child exists | the public CLI exits 127 with SAFEWORD_TEST_PLAN_START_FAILED and records zero child starts |
        | explicit local | shell spawn returns EACCES before a child exists | the public CLI exits 126 with SAFEWORD_TEST_PLAN_START_FAILED and records zero child starts |
        | remote workflow | shell spawn returns ENOENT before a child exists | the plan step exits 127 with SAFEWORD_TEST_PLAN_START_FAILED and the workflow concludes failure |
        | remote workflow | shell spawn returns EACCES before a child exists | the plan step exits 126 with SAFEWORD_TEST_PLAN_START_FAILED and the workflow concludes failure |
        | explicit local | the exact shell child terminates by SIGTERM | the public CLI exits 143 and reports signal SIGTERM without translating it to a configured numeric child exit |
        | remote workflow | the exact shell child terminates by SIGTERM | the plan step exits 143, the workflow concludes failure, and the watching CLI reports the authoritative remote failure |
        | explicit local | the wrapper receives cancellation while the child and one descendant are active | the wrapper terminates its execution container, proves it empty, and exits 130 |
        | remote workflow | the job receives cancellation while the child and one descendant are active | job teardown terminates and proves the process group empty before GitHub records cancelled |
        | explicit local | stdout or stderr forwarding returns a deterministic broken-pipe error | the wrapper terminates the execution container and exits 74 with SAFEWORD_TEST_EXECUTION_IO |
        | remote workflow | stdout or stderr forwarding returns a deterministic broken-pipe error | the step terminates the execution container, exits 74 with SAFEWORD_TEST_EXECUTION_IO, and the workflow concludes failure |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Repository plan changes flow through the remote resolver only
      Given a hand-authored literal test manifest has a successful control and a second checkout independently <plan-mutation>
      When the exact pinned Safeword CLI resolves both plans inside their immutable remote checkouts
      Then the control trace remains exact and the changed trace has only <exact-outcome>
      Examples:
        | plan-mutation | exact-outcome |
        | removes one configured plan entry | that entry absent |
        | adds a duplicate configured entry | that entry executed twice in configured positions |
        | reorders two configured entries | those two execution events reordered |
        | changes one command's bytes | that command event changed byte-for-byte |
        | changes one working directory | that entry's working-directory event changed |
        | changes one availability condition to false | that entry reported unavailable and was not executed |
        | changes one command from zero to nonzero exit | the internal process trace records that exact child and aggregate numeric status and the public job conclusion changes to failure |

    @rejection
    Scenario Outline: A checkout that is not an eligible same-repository branch tip preserves either requested lane locally
      Given a valid <lane> request and the local checkout is <state>
      When a valid remote request is evaluated
      Then remote dispatch is not attempted and the public CLI resolves <plan-kind>, reports local HEAD and dirty state, fingerprints both invocation boundaries, invokes that unchanged plan once, and applies fingerprint precedence to its exit
      Examples:
        | lane | plan-kind | state |
        | done | test | dirty |
        | full | verify | dirty |
        | done | test | unpushed |
        | full | verify | unpushed |
        | done | test | detached |
        | full | verify | detached |
        | done | test | valid but tracking an upstream branch in a different canonical GitHub repository |
        | full | verify | valid but tracking an upstream branch in a different canonical GitHub repository |

  @offload-tests.TBU1.R3
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R3 — An accepted dispatch immediately derives its correlated run destination from trusted repository identity and finishes with an authoritative result

    @live @real-github @public-cli @surface.safeword-cli
    Scenario: The disposable GitHub dispatch returns its authoritative run identity
      Given a disposable real GitHub repository is configured through the public Safeword CLI with the exact managed workflow and an independent transport recorder captures the raw response bytes
      When it dispatches through GitHub API version 2026-03-10
      Then it observes HTTP 200, parses the raw response's one canonical integer `workflow_run_id` byte-for-byte into the same exact int64 value persisted in the authenticated pending record without numeric rounding, and derives API and HTML URLs containing that exact decimal ID from the frozen canonical owner and repository rather than any response URL

    @live @real-github @public-cli @surface.safeword-cli
    Scenario Outline: Live contract evidence distinguishes product incompatibility from fixture unavailability
      Given the harness independently records live authentication, repository provisioning, canonical request bytes and raw response evidence
      When <live-condition>
      Then <gate-outcome>
      Examples:
        | live-condition | gate-outcome |
        | prerequisites succeed and canonical GitHub differs from the versioned HTTP 200 run-ID contract | the product contract fails with captured request and response evidence |
        | authentication, provisioning, DNS or GitHub availability prevents the canonical request | the gate reports explicit infrastructure unavailability and remains incomplete rather than passing or silently skipping |

    @live @real-github @public-cli
    Scenario Outline: A live accepted run exposes each independent trust source
      Given a disposable real GitHub run was accepted
      When the public CLI compares frozen <field> with <independent-source>
      Then captured raw evidence exactly matches that field's frozen control and proceeds to the next ordered check
      Examples:
        | field | independent-source |
        | canonical repository owner | authenticated run API repository owner object |
        | canonical repository name | authenticated run API repository name |
        | canonical API origin | system-trust-validated TLS request origin captured by the HTTP transport |
        | workflow ID | run API workflow ID |
        | workflow path | workflow metadata API path |
        | workflow-source SHA | immutable run workflow-source SHA |
        | actor ID | run API actor ID |
        | actor login | run API actor login |
        | trusted workflow hash | independently decoded contents-API bytes at workflow-source SHA plus bundled literal hash |
        | managed workflow version | bundled literal version manifest plus supported pending reader |
        | pending-record schema | local authenticated record bytes parsed by versioned schema reader |
        | CLI compatibility | local record CLI version parsed by compatibility table |
        | request token | canonical run-name token compared with authenticated record bytes |
        | run-name target-ref digest | canonical run-name digest compared with SHA-256 of authenticated target-ref bytes |
        | run-name full SHA | canonical run-name SHA compared with authenticated record bytes |
        | lane | canonical run-name lane compared with authenticated record bytes |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Each isolated trust-source mismatch stops at its own boundary
      Given a recorded live accepted-run control and a test-owned adapter perturb only <field> at <independent-source>
      When the public CLI inspects that isolated response sequence
      Then it stops with that field-specific error, sends no later authority request, persists no terminal result, leaves pending bytes unchanged, and starts no fallback
      Examples:
        | field | independent-source |
        | canonical repository owner | authenticated run API repository owner object |
        | canonical repository name | authenticated run API repository name |
        | canonical API origin | system-trust-validated TLS request origin captured by the HTTP transport |
        | workflow ID | run API workflow ID |
        | workflow path | workflow metadata API path |
        | workflow-source SHA | immutable run workflow-source SHA |
        | actor ID | run API actor ID |
        | actor login | run API actor login |
        | trusted workflow hash | independently decoded contents-API bytes at workflow-source SHA plus bundled literal hash |
        | managed workflow version | bundled literal version manifest plus supported pending reader |
        | pending-record schema | local authenticated record bytes parsed by versioned schema reader |
        | CLI compatibility | local record CLI version parsed by compatibility table |
        | request token | canonical run-name token compared with authenticated record bytes |
        | run-name target-ref digest | canonical run-name digest compared with SHA-256 of authenticated target-ref bytes |
        | run-name full SHA | canonical run-name SHA compared with authenticated record bytes |
        | lane | canonical run-name lane compared with authenticated record bytes |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Noncanonical run names never supply frozen target identity
      Given an accepted run exposes <run-name-form>
      When Safeword parses correlation identity
      Then the run is not accepted as authoritative and no local fallback or redispatch occurs
      Examples:
        | run-name-form |
        | a malformed token |
        | a malformed target-ref digest |
        | a malformed SHA |
        | a malformed lane |
        | an abbreviated SHA |
        | a differently cased identity |
        | a percent-encoded identity |
        | duplicate token fields |
        | duplicate target-ref digest fields |
        | duplicate SHA fields |
        | duplicate lane fields |
        | an extra ambiguous separator |
        | an extra field |

    @rejection @public-cli @surface.safeword-cli
    Scenario: The run-identity mutation manifest covers every field-defect cell
      Given a test-owned literal field inventory contains
        | field |
        | repository owner |
        | repository name |
        | canonical API origin |
        | workflow ID |
        | workflow path |
        | workflow-source SHA |
        | actor ID |
        | actor login |
        | trusted workflow hash |
        | managed workflow version |
        | pending-record schema version |
        | compatible CLI version |
        | request token |
        | run-name target-ref digest |
        | run-name full SHA |
        | lane |
      And a test-owned raw-defect inventory contains
        | defect |
        | omitted |
        | duplicated with equal values |
        | duplicated with unequal values |
        | type-changed |
        | noncanonically encoded |
        | canonically encoded but mismatched |
      And an independent applicability manifest marks every field-defect cell applicable or impossible with a fixed reason and defines one concrete raw-source adapter for each applicable cell
      When the harness enumerates generated fixture IDs without invoking product authority decisions
      Then exact set and cardinality equality prove every applicable cell appears once, every impossible reason is asserted, and any collapsed, missing, extra or skipped applicable cell fails the harness

    @rejection @public-cli @surface.safeword-cli
    Scenario: Each complete run-identity mutation fixture fails authority independently
      Given the run-identity mutation manifest passed its independent completeness check and one accepted control
      When the harness starts one isolated public-CLI process per applicable cell while all other fields remain at control values
      Then it emits one uniquely labeled result per cell, result-label set and cardinality equal the manifest, and each result alone preserves pending recovery, rejects authority, and sends neither POST nor fallback without early-loop termination

    @live @real-github @public-cli
    Scenario: Interrupted correlation paginates to one exact visible run
      Given a disposable real GitHub request was interrupted before run-ID persistence and its exact run is beyond the first result page
      When the public CLI resumes within the filtered-result limit
      Then pages of 100 select exactly the run matching every frozen identity field by page 10 and send no POST

    @rejection
    Scenario Outline: Pagination and visibility stop at their exact boundaries
      Given an authenticated pending record has no run ID
      When <visibility-boundary>
      Then <visibility-outcome> and neither dispatch POST nor local fallback occurs
      Examples:
        | visibility-boundary | visibility-outcome |
        | the exact run is the final item on page 10 | that one run is accepted |
        | no exact run appears in the first 1,000 filtered results | the request remains pending with manual run-ID recovery |
        | no exact run appears before 60 seconds of injected monotonic visibility budget | the request remains pending with the resume command |

    @live @real-github @public-cli
    Scenario: Live GitHub rate-limit metadata reaches the production retry controller
      Given a disposable real GitHub run is accepted
      When the public CLI performs one observation GET
      Then a test-owned wire recorder verifies GitHub's real rate-limit header shape is parsed into the same production retry-controller input used by bounded tests

    @public-cli @surface.safeword-cli
    Scenario Outline: Injected rate-limited observation has one bounded terminal behavior
      Given an accepted run and injected production-HTTP responses, monotonic clock and backoff events
      When the public CLI applies bounded idempotent GET backoff and <retry-state>
      Then <rate-outcome> and no dispatch POST is sent
      Examples:
        | retry-state | rate-outcome |
        | the fifth GET succeeds within the two-minute budget | the exact run's observation continues to its terminal result |
        | five attempts or two minutes are exhausted | the pending record remains open and output gives the exact resume command |
        | Retry-After exceeds the remaining two-minute budget | the pending record remains open without waiting past budget and output gives the exact resume command |

    @public-cli
    Scenario Outline: HTTP 200 preserves every accepted int64 run-ID boundary exactly
      Given preflight froze trusted github.com repository and workflow identity
      When versioned dispatch returns HTTP 200 with workflow run ID <run-id>
      Then Safeword persists the exact decimal value without IEEE-754 rounding, derives its URLs from frozen identity, and watches that exact run
      Examples:
        | run-id |
        | 1 |
        | 9007199254740991 |
        | 9007199254740992 |
        | 9007199254740993 |
        | 9223372036854775807 |

    @public-cli
    Scenario Outline: Benign JSON framing does not change an exact run ID
      Given preflight froze trusted github.com repository and workflow identity
      When HTTP 200 contains run ID 9007199254740993 with <benign-framing>
      Then Safeword persists exact run ID 9007199254740993 and ignores only the unrelated framing
      Examples:
        | benign-framing |
        | legal leading and trailing JSON whitespace |

    @public-cli
    Scenario Outline: The pinned HTTP 200 response-member allowlist is independently frozen
      Given `packages/cli/tests/fixtures/github-dispatch-response-2026-03-10.json` is a literal manifest containing the exact typed members `workflow_run_id`, `run_url`, and `html_url` plus 26 stable fixture IDs: one control, three omissions, one `unexpected`-member addition, six equal-or-unequal member duplications, and fifteen replacements of each member by each other JSON type
      When an independent raw-token enumerator that imports no production allowlist compares production acceptance with <manifest-mutation>
      Then expected fixture ID set and cardinality equal generated and executed result sets and cardinalities, only the control is accepted, every member remains unique and correctly typed, and both response URLs are ignored in favor of URLs derived from frozen canonical identity and the exact run ID
      Examples:
        | manifest-mutation |
        | the unchanged literal manifest |
        | each one-member omission |
        | each one-member addition |
        | a duplicate of each member with equal or unequal values |
        | each member changed to every other JSON type |

    @rejection
    Scenario Outline: A response without one canonical positive int64 run ID is never accepted
      Given Safeword sent one valid dispatch request
      When it receives <response>
      Then the result is indeterminate, the authenticated pending record remains open, and Safeword neither follows another host, infers a run, redispatches, nor falls back locally
      Examples:
        | response |
        | HTTP 200 without a run ID field |
        | HTTP 200 with numeric run ID 0, the first value below the accepted domain |
        | HTTP 200 with raw numeric run ID `-0` |
        | HTTP 200 with a leading-zero numeric token such as `01` |
        | HTTP 200 with a negative run ID |
        | HTTP 200 with a fractional run ID |
        | HTTP 200 with a string-encoded run ID |
        | HTTP 200 with run ID 9223372036854775808 |
        | HTTP 200 whose raw JSON contains duplicate run ID keys with different values |
        | HTTP 200 whose raw JSON contains duplicate run ID keys with the same value |
        | HTTP 200 whose raw JSON contains duplicate unrelated member keys |
        | HTTP 200 with one unique response member not in the pinned API-version allowlist |
        | HTTP 200 with `Workflow_Run_Id` instead of canonical `workflow_run_id` |
        | HTTP 200 with `workflowRunId` instead of canonical `workflow_run_id` |
        | HTTP 200 with a whitespace-altered run-ID key instead of canonical `workflow_run_id` |
        | HTTP 200 with a run ID in exponent notation |
        | HTTP 200 with malformed JSON |
        | HTTP 204 |

  @offload-tests.TBU1.R4
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R4 — A valid request that is remotely ineligible or explicitly rejected resolves and runs the same Safeword test-plan lane locally while identifying the local revision and dirty state

    @public-cli @surface.safeword-cli
    Scenario Outline: Conclusive remote unavailability falls back through the real plan resolver
      Given a valid <lane> request has <unavailability>
      When the public Safeword CLI establishes that no remote run was created
      Then it resolves <plan-kind>, reports local fallback with HEAD and dirty state, invokes the unchanged plan command once, and exits with that evidence-qualified local result
      Examples:
        | lane | plan-kind | unavailability |
        | done | test | missing authentication at preflight |
        | full | verify | missing authentication at preflight |
        | done | test | configured or required proxy use detected before POST |
        | full | verify | configured or required proxy use detected before POST |
        | done | test | missing managed workflow at preflight |
        | full | verify | missing managed workflow at preflight |
        | done | test | a parsed GitHub 400 rejection with request ID |
        | full | verify | a parsed GitHub 400 rejection with request ID |
        | done | test | a parsed GitHub 401 rejection with request ID |
        | full | verify | a parsed GitHub 401 rejection with request ID |
        | done | test | a parsed GitHub 403 rejection with request ID |
        | full | verify | a parsed GitHub 403 rejection with request ID |
        | done | test | a parsed GitHub 404 rejection with request ID |
        | full | verify | a parsed GitHub 404 rejection with request ID |
        | done | test | a parsed GitHub 422 rejection with request ID |
        | full | verify | a parsed GitHub 422 rejection with request ID |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Only a direct canonical GitHub rejection proves no run was created
      Given v1 established a direct system-trust-validated TLS connection to canonical `api.github.com` with redirects and proxies disabled
      When the response has <authority-defect>
      Then dispatch remains indeterminate, the authenticated pending record stays open, and neither local fallback nor redispatch occurs
      Examples:
        | authority-defect |
        | an allowlisted status with no GitHub request-ID header |
        | an allowlisted status with an empty request-ID header |
        | an allowlisted status with a malformed request-ID header |
        | an allowlisted status with duplicate request-ID headers |
        | an allowlisted status observed only through a proxy or TLS intermediary |
        | a non-allowlisted status carrying a syntactically valid request ID |
        | an allowlisted status with a schema-incompatible or malformed body |

    @public-cli @surface.safeword-cli
    Scenario Outline: One exact raw rejection response authorizes fallback
      Given direct canonical TLS returns status <status>, one case-insensitive `X-GitHub-Request-Id` header whose trimmed value matches `[A-Za-z0-9:-]{1,256}`, `Content-Type: application/json`, and a body of at most 65536 bytes with required nonempty string `message`, optional opaque string `documentation_url`, and optional canonical ASCII `status` equal to <status>
      When the public CLI raw-token parser parses that valid control response
      Then it classifies one conclusive rejection, closes pending dispatch recovery, and invokes the selected lane locally once
      Examples:
        | status |
        | 400 |
        | 401 |
        | 403 |
        | 404 |
        | 422 |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Every malformed rejection response remains indeterminate
      Given direct canonical TLS returns an allowlisted status and <malformed-response>
      When the public CLI parses raw headers and body
      Then pending recovery remains open, no local fallback or redispatch occurs, and output reports indeterminate response evidence
      Examples:
        | malformed-response |
        | a missing GitHub request-ID header |
        | an empty GitHub request-ID header |
        | a request-ID header containing an invalid grammar character |
        | equal duplicate GitHub request-ID headers |
        | unequal duplicate GitHub request-ID headers |
        | a missing, non-JSON or duplicate Content-Type header |
        | a body larger than 65536 bytes |
        | duplicate equal or unequal raw JSON keys |
        | a top-level array or nested object |
        | null or a non-string member value |
        | missing or empty `message` |
        | non-string `documentation_url` |
        | noncanonical or HTTP-mismatched `status` string |
        | any undocumented body member |
        | obsolete folded header continuation bytes |
        | a request-ID or Content-Type header containing a control byte |
        | multiple raw header lines hidden as one normalized client-library value |
        | conflicting Content-Length and Transfer-Encoding framing |
        | a body truncated before the declared framing boundary |
        | invalid UTF-8 in a JSON string or member name |

    @public-cli @surface.safeword-cli
    Scenario Outline: Rejection authority accepts exact limits and rejects the first excess
      Given direct canonical TLS returns an allowlisted status with <raw-boundary>
      When the public CLI parses the exact raw headers and body bytes
      Then <authority-outcome>
      Examples:
        | raw-boundary | authority-outcome |
        | a one-character request ID in the allowed grammar | conclusive rejection is allowed |
        | a 256-character request ID in the allowed grammar | conclusive rejection is allowed |
        | an empty request ID after trimming optional whitespace | response is indeterminate |
        | a 257-character request ID | response is indeterminate |
        | leading and trailing optional HTTP whitespace around a valid ID | the trimmed ID is accepted |
        | internal whitespace or the first character outside `[A-Za-z0-9:-]` | response is indeterminate |
        | a one-character nonempty message and body one byte below 65536 | conclusive rejection is allowed |
        | a body exactly 65536 bytes with valid padding in an allowed string field | conclusive rejection is allowed |
        | a body exactly 65537 bytes | response is indeterminate |
        | an empty message | response is indeterminate |
        | canonical status strings `400`, `401`, `403`, `404` or `422` matching HTTP status | conclusive rejection is allowed |
        | status string with leading zero, sign, surrounding whitespace or non-ASCII digit | response is indeterminate |
        | any JSON string in optional `documentation_url`, including empty, relative, userinfo, fragment, percent or Unicode text | it is ignored as opaque and conclusive rejection is allowed |

    @public-cli @surface.safeword-cli
    Scenario Outline: Rejection Content-Type parsing has one canonical policy
      Given direct canonical TLS returns an otherwise valid allowlisted rejection with <content-type>
      When the public CLI parses the raw Content-Type header
      Then <content-type-outcome>
      Examples:
        | content-type | content-type-outcome |
        | `application/json` | conclusive rejection is allowed |
        | case-insensitive `Application/JSON` | conclusive rejection is allowed |
        | legal leading and trailing optional whitespace around `application/json` | conclusive rejection is allowed |
        | `application/json;charset=utf-8` | response is indeterminate because parameters are not canonical in v1 |
        | `application/json; charset="utf-8"` | response is indeterminate because quoted parameters are not canonical in v1 |
        | a missing or empty header | response is indeterminate |
        | equal duplicate headers | response is indeterminate |
        | unequal duplicate headers | response is indeterminate |
        | a comma-combined value | response is indeterminate |
        | a media type other than application/json | response is indeterminate |
        | a charset other than UTF-8 | response is indeterminate |
        | a repeated parameter | response is indeterminate |
        | an unknown parameter | response is indeterminate |
        | invalid media-type syntax | response is indeterminate |

    @rejection
    Scenario: Accepted dispatch cannot enter local fallback
      Given dispatch returned HTTP 200 with a positive run ID
      When subsequent remote observation fails
      Then the local plan resolver is not invoked automatically

  @offload-tests.TBU1.R5
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R5 — An indeterminate dispatch is reported for recovery and never automatically duplicated locally

    @public-cli @surface.safeword-cli
    Scenario Outline: Ambiguous dispatch preserves pending recovery without fallback
      Given a valid dispatch request was attempted once
      When the public Safeword CLI receives <ambiguous-outcome>
      Then it exits indeterminate, preserves the authenticated pending record, prints its resume command, and sends neither another POST nor a local plan invocation
      Examples:
        | ambiguous-outcome |
        | a timeout |
        | a transport error |
        | a proxy response without a GitHub request ID |
        | an HTTP redirect |
        | HTTP 204 |
        | HTTP 429 |
        | HTTP 500 |
        | HTTP 200 without a positive run ID |

    @rejection
    Scenario: Indeterminate dispatch is never retried automatically
      Given a pending request has no conclusive acceptance or rejection
      When the command exits or is resumed
      Then Safeword neither redispatches nor authorizes local fallback

  @offload-tests.TBU1.R6
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R6 — Every accepted remote conclusion remains authoritative and never triggers a result-masking local rerun

    @public-cli @surface.safeword-cli
    Scenario Outline: Every terminal remote conclusion is reported from the accepted run
      Given an authenticated run response has `status: completed` and GitHub conclusion <github-conclusion>
      When the public Safeword CLI records its terminal result
      Then it persists and plainly reports <classification>, exits <exit>, and invokes no local plan
      Examples:
        | github-conclusion | classification | exit |
        | success | passed | 0 |
        | failure | failed | 1 |
        | cancelled | cancelled | 130 |
        | action_required | action required | 2 |
        | neutral | neutral non-pass | 3 |
        | skipped | skipped non-pass | 4 |
        | stale | stale non-pass | 5 |
        | timed_out | infrastructure failure | 124 |
        | startup_failure | infrastructure failure | 125 |
        | an unknown non-null terminal value | indeterminate unsupported conclusion | 70 |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Status and conclusion must form one valid terminal pair
      Given an authenticated run response has <status-conclusion>
      When the public CLI classifies run lifecycle
      Then <lifecycle-outcome>
      Examples:
        | status-conclusion | lifecycle-outcome |
        | `status: queued` and `conclusion: null` | observation continues as queued without terminal persistence |
        | `status: requested` and `conclusion: null` | observation continues as requested without terminal persistence |
        | `status: waiting` and `conclusion: null` | observation continues as waiting without terminal persistence |
        | `status: pending` and `conclusion: null` | observation continues as pending without terminal persistence |
        | `status: in_progress` and `conclusion: null` | observation continues as running without terminal persistence |
        | queued with a non-null conclusion | evidence is indeterminate and no local fallback starts |
        | in_progress with a non-null conclusion | evidence is indeterminate and no local fallback starts |
        | `status: completed` and `conclusion: null` | evidence is indeterminate and no local fallback starts |
        | omitted status key | evidence is indeterminate and no local fallback starts |
        | equal or unequal duplicate raw status keys | evidence is indeterminate and no local fallback starts |
        | non-string, noncanonically encoded or any future unknown status | evidence is indeterminate, pending recovery stays open, and no local fallback starts |
        | omitted conclusion key | evidence is indeterminate and no local fallback starts |
        | equal or unequal duplicate raw conclusion keys | evidence is indeterminate and no local fallback starts |
        | non-string or noncanonically encoded conclusion | evidence is indeterminate and no local fallback starts |

    @rejection
    Scenario: A remote failure cannot be replaced by a later automatic local pass
      Given an accepted remote run failed
      When the user later runs `safeword project test --lane full --execution local`
      Then Safeword retains and reports the authoritative remote failure, starts one separately identified local run, and records its result as new local evidence rather than replacing or reclassifying the remote result

  @offload-tests.TBU1.R7
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R7 — The managed workflow uses least privilege, treats dispatch inputs as data, and receives no Safeword-provided secrets

    @surface.github-actions-execution-sandbox
    Scenario: The managed workflow completes trusted validation before repository checkout
      Given a valid managed workflow invocation
      When the GitHub-hosted job starts
      Then a test-owned event recorder observes raw input grammar and target-ref-digest checks, immutable `github.workflow_sha` context validation, and one contents-authorized refs API branch-tip comparison before the first checkout or repository-controlled process, with no Actions metadata API request

    @rejection
    Scenario: Authenticated dispatch never follows redirects or forwards authorization
      Given Safeword sends one authenticated request to the canonical GitHub Cloud dispatch endpoint
      When that endpoint returns an HTTP redirect
      Then Safeword follows no redirect, forwards no authorization, and reports an indeterminate dispatch

    @rejection @public-cli @surface.safeword-cli
    Scenario: Dispatch serialization has one exact nested JSON shape
      Given a test-owned literal expected JSON byte structure and independently chosen identity values
      When a test-owned TLS endpoint captures the real public CLI invocation's wire request
      Then exactly one POST targets the canonical workflow-dispatch path, headers contain one canonical-host Authorization placement, API version 2026-03-10 and GitHub JSON Accept value, and captured body bytes parse to exact top-level `ref` and five-field `inputs` with duplicates rejected before transmission

    @rejection @public-cli @surface.safeword-cli
    Scenario: Pending recovery is durably published before dispatch can escape
      Given a test-owned recorder captures pending-record filesystem events and the canonical TLS endpoint's first received network byte
      When the public CLI dispatches one eligible request
      Then record temp write, file fsync, atomic rename and parent-directory fsync all precede the first network byte, and interruption at every earlier event sends zero POST

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Request tokens use exactly 256 bits of production entropy
      Given the production OS entropy adapter <entropy-state>
      When the public CLI prepares a new pending request
      Then <token-outcome>
      Examples:
        | entropy-state | token-outcome |
        | returns a test-observed sequence of exactly 32 bytes | the record and dispatch encode those exact bytes once as 64 lowercase hexadecimal characters |
        | returns distinct 32-byte sequences to concurrent requests | every request receives the corresponding unique token before uniqueness commit |
        | returns seven already-open tokens then a distinct token on attempt eight | no duplicate is committed or dispatched and the final allowed attempt commits only the distinct token |
        | returns duplicates for all eight allowed attempts | no ninth attempt, pending record or network byte occurs and output reports secure entropy exhaustion |
        | fails before returning bytes | no pending record or network byte is created and output reports secure entropy failure |
        | returns fewer or more than exactly 32 bytes | no pending record or network byte is created and output reports secure entropy failure |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Pending-publication syscall failures send no dispatch
      Given one eligible request and a test filesystem injects <pending-failure> at the pending-record durability boundary
      When public invocation `failed-dispatch` attempts dispatch
      Then `failed-dispatch` has its own captured nonzero exit, error output, filesystem trace and zero network bytes; pre-rename failure exposes no final record; and post-rename failure exposes only a complete authenticated record or absence in the frozen restart snapshot
      Examples:
        | pending-failure |
        | permission failure before the first write |
        | ENOSPC before the first write |
        | short write of record bytes |
        | record-file fsync failure |
        | atomic rename failure |
        | parent-directory fsync failure |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Dispatch safely retries from the frozen pending-record state
      Given `failed-dispatch` encountered <pending-failure> and the recorder froze its absent-or-complete authenticated pending-record state
      When public invocation `retry-dispatch` starts after the fault is removed
      Then `retry-dispatch` has a separately captured exit, output, filesystem and network trace, classifies only the frozen observed state, completes directory durability, and sends exactly one POST without changing `failed-dispatch` evidence
      Examples:
        | pending-failure |
        | permission failure before the first write |
        | ENOSPC before the first write |
        | short write of record bytes |
        | record-file fsync failure |
        | atomic rename failure |
        | parent-directory fsync failure |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Pending-record paths reject hostile objects and replacement races
      Given the final record, temporary record or any parent path is independently subjected to <hostile-pending-path>
      When the public CLI prepares, publishes or compare-and-swap rewrites pending state while recording object identities
      Then it fails closed with zero network bytes, follows no link, writes outside no approved directory, overwrites no alias, and commits no stale compare-and-swap
      Examples:
        | hostile-pending-path |
        | a leaf symlink or Windows reparse point |
        | a parent symlink or reparse point |
        | a hard-linked regular file with link count greater than one |
        | a directory or special file at a required regular-file path |
        | leaf replacement between classification and open |
        | parent replacement between open and rename |
        | object identity change between open, write, fsync, rename and final verification |

    @rejection
    Scenario Outline: Unsafe workflow capabilities fail the trusted-workflow contract
      Given the candidate managed workflow <unsafe-property>
      When Safeword checks its trusted identity
      Then it refuses authoritative remote execution
      Examples:
        | unsafe-property |
        | grants write permission |
        | interpolates dispatch input into shell source |
        | executes an unpinned helper before validation |
        | requests a Safeword-provided secret |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Failed pre-checks execute no untrusted workflow step
      Given the managed job receives <invalid-boundary>
      When its pre-check sequence runs
      Then only the pinned trusted validator executes and no checkout, dependency install, repository helper or repository code starts
      Examples:
        | invalid-boundary |
        | an unsupported lane |
        | a mismatched run name |
        | a moved target branch ref |
        | a mismatched workflow-source identity observable before checkout |

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: Valid pre-checks reach immutable checkout exactly once
      Given the exact managed workflow receives a valid frozen request in a disposable real GitHub repository
      When its pinned trusted validator succeeds
      Then checkout of the immutable target occurs once without persisted credentials before any repository-controlled process

    @live @real-github @rejection @surface.github-actions-execution-sandbox
    Scenario: GitHub's contents-read job token is an explicit bounded non-Safeword exception
      Given a disposable private repository independently captures workflow AST mappings, effective runtime action inputs, canonical GitHub requests, checkout Git configuration, repository-process environment and arguments
      When the exact managed job validates the target ref, checks out the immutable SHA with `persist-credentials: false`, and runs one sentinel repository command
      Then the GitHub-provided job token has effective permission exactly `contents: read`, appears only as canonical GitHub API authorization and the checkout action's effective token input, is absent from declared workflow environment and run source, is not persisted in Git configuration or files, is absent from repository-process environment and arguments, and no Safeword or local API credential reaches the job

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: One valid immutable checkout resolves and executes its plan once
      Given trusted pre-checks completed and the exact target SHA was checked out without persisted credentials
      When the pinned Safeword CLI resolves the dispatched plan kind
      Then every available manifested entry starts once in configured order, every unavailable entry is recorded without starting, and the exact aggregate result maps to the terminal job conclusion

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: A real managed job proves contents read succeeds and contents write fails
      Given the exact managed workflow runs in a disposable real GitHub repository
      When its trusted pre-checks and repository execution complete
      Then a unique attempted contents-write operation returns permission denied, creates no ref or file, and the job's required contents-read operation succeeds

    @rejection @surface.github-actions-execution-sandbox
    Scenario: The effective permission manifest is exactly contents read
      Given an independent test manifest enumerates GitHub scopes `actions`, `attestations`, `checks`, `contents`, `deployments`, `discussions`, `id-token`, `issues`, `models`, `packages`, `pages`, `pull-requests`, `security-events` and `statuses`
      When a version-pinned official GitHub workflow-schema artifact independently enumerates recognized permission keys and a separate YAML parser reads workflow-level and job-level permissions including defaults
      Then schema-to-manifest set equality succeeds, effective YAML yields only `contents: read`, every other recognized scope is `none`, and a fixture schema containing one future key fails equality until explicitly classified

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Every extra permission mutation invalidates trusted workflow bytes
      Given an otherwise exact candidate adds <permission-mutation>
      When the independent permission parser and exact-byte trust check evaluate it
      Then authoritative remote execution is rejected before checkout
      Examples:
        | permission-mutation |
        | any enumerated non-contents scope at read or write |
        | `contents: write` |
        | `permissions: read-all` or `write-all` |
        | omitted permissions that would inherit repository defaults |
        | an unknown future permission key absent from the literal manifest |

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: Private-repository pre-checks need only contents read
      Given the exact managed job runs in a disposable private GitHub repository with effective permissions only `contents: read`
      When it validates event inputs and immutable workflow context and reads the target branch through the refs API
      Then all required pre-checks succeed, captured requests contain no Actions metadata endpoint, and checkout remains the next repository-controlled boundary

    @live @real-github @surface.github-actions-execution-sandbox
    Scenario: A real managed job persists no checkout credential
      Given the exact managed workflow reaches checkout in a disposable real GitHub repository
      When checkout completes
      Then repository Git configuration contains no persisted Actions credential

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Every independently enumerated owned channel has its expected clean state
      Given a test-owned literal manifest independent of production discovery fixes <owned-channel> as <expected-state>
      When an opted-in request exercises real serializers, HTTP construction and bundled managed workflow bytes
      Then independently captured bytes and runtime events for that one channel show the expected state with no Safeword-provided secret value or reference and with GitHub's job token allowed only in the explicitly bounded effective-runtime positions named by the row
      Examples:
        | owned-channel | expected-state |
        | project configuration serialization | present but never serialized into dispatch |
        | pending-record serialization | present but never serialized into dispatch |
        | HTTP request headers | canonical GitHub Authorization is transport-only; Accept, API version and user agent are nonsecret; no header is workflow-visible |
        | dispatch JSON body | present with only the five allowlisted identity fields |
        | workflow_dispatch input declarations | present with only the five allowlisted identity fields |
        | workflow, job, or step environment mappings | explicitly absent |
        | action with inputs | declared inputs are literal or derived only from allowlisted identity; effective runtime inputs additionally allow only GitHub's contents-read job token for canonical refs access and checkout |
        | run command source or resulting arguments | present and derived only from validated plan data |
        | files created by the managed workflow | explicitly absent before checkout |
        | Git or HTTP credential-helper configuration | explicitly absent in the job |

    @rejection @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario: The owned-channel manifest exactly covers captured production surfaces
      Given the fixed ten-category manifest and independent capture adapters for configuration, pending bytes, HTTP headers and body, workflow AST, process environment and argv, filesystem, action inputs and Git configuration
      When the harness enumerates capture-adapter category IDs without evaluating secret absence
      Then exact set and cardinality equality has one adapter per manifest category with no missing, extra, collapsed or skipped category

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Serializer data-flow sentinels cannot reach the dispatch wire
      Given a valid control request and a mutated public-CLI fixture that puts <sentinel-mutation> into <owned-channel> selected for emission
      When a test-owned TLS endpoint separately captures both real public-CLI attempts
      Then the mutation fails the <rejection-boundary> before POST, while the control sends exactly one canonical header set and five-field JSON body with no sentinel bytes
      Examples:
        | owned-channel | sentinel-mutation | rejection-boundary |
        | project configuration serialization | a `remote_secret` field selected for dispatch | configuration-to-dispatch allowlist |
        | pending-record serialization | a `secret_ref` field selected for dispatch | pending-to-dispatch allowlist |
        | HTTP request headers other than canonical Authorization | `X-Safeword-Secret: SAFEWORD_SENTINEL` | outbound header allowlist |
        | dispatch JSON body | a sixth `secret` input field | exact dispatch-body schema |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Workflow sink sentinels invalidate exact bytes before sandbox execution
      Given an independent YAML and byte fixture puts <sentinel-mutation> into <owned-channel>
      When the real trusted-workflow identity check evaluates the candidate and the sandbox recorder watches pre-check events
      Then exact-byte trust rejects the candidate and zero checkout or repository process event occurs
      Examples:
        | owned-channel | sentinel-mutation |
        | workflow_dispatch input declarations | a `secret` input declaration |
        | workflow, job, or step environment mappings | `SAFEWORD_SENTINEL: ${{ secrets.SAFEWORD_SENTINEL }}` |
        | action with inputs | `token: ${{ secrets.SAFEWORD_SENTINEL }}` |
        | run command source or resulting arguments | `${{ secrets.SAFEWORD_SENTINEL }}` as an argument |
        | files created by the managed workflow | a pre-check step writing the sentinel reference |
        | Git or HTTP credential-helper configuration | a pre-check credential helper containing the sentinel reference |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Every enumerated workflow dependency position is immutable
      Given the candidate contains multiple action references and <dependency-mutation>
      When an independent test YAML parser lists every `uses` position and compares that literal list with Safeword validation before exact-byte identity
      Then authoritative execution is rejected unless every action uses a full commit SHA and no reusable workflow is referenced
      Examples:
        | dependency-mutation |
        | the first action uses a tag |
        | the middle action uses a branch |
        | the final action uses a shortened SHA |
        | one action reference is omitted from validator enumeration |
        | a local or third-party reusable workflow is referenced |

  @offload-tests.TBU1.R8
  Rule: offload-tests.TBU1.R8 — Setup and upgrade preserve customer workflow changes or surface a conflict instead of overwriting them

    @public-cli @surface.safeword-cli
    Scenario: An unchanged managed workflow upgrades transactionally
      Given byte-recorded live workflow, identity and installed configuration exactly match the old installed base and independently recorded bundled bytes define the new identity
      When `safeword setup` reconciles the newer managed workflow while a filesystem recorder observes every write, fsync, rename, unlink and directory fsync
      Then setup exits zero, the recorder shows the required journaled event order, all three live members exactly match the new bundled set, no staged or journal artifact remains, and a second `safeword setup` exits zero without filesystem mutation

    @public-cli @surface.safeword-cli
    Scenario Outline: Every reconciliation transaction follows one durable event order
      Given a test-owned filesystem recorder observes a valid <transaction-type> transition
      When public Safeword CLI setup completes reconciliation
      Then events follow <durable-order>
      Examples:
        | transaction-type | durable-order |
        | initial installation from requested configuration | staged new-member writes and fsyncs; journal publication and directory fsync; live renames and directory fsyncs; exact three-member verification; journal unlink and final directory fsync |
        | upgrade from one exact installed set to another | staged new-member writes and fsyncs; journal publication and directory fsync; live renames and directory fsyncs; exact three-member verification; journal unlink and final directory fsync |
        | disable from an exact installed set to absent members | journal publication containing exact deletion intent and directory fsync with no staged tombstone files; live unlinks and directory fsyncs; exact three-member absence verification; journal unlink and final directory fsync |

    @rejection @public-cli @surface.safeword-cli
    Scenario: The reconciliation failure manifest covers every production durability site
      Given an independent syscall interceptor enumerates every production write, fsync, rename, unlink and cleanup site
      And a literal failure-class inventory contains EACCES, ENOSPC, EIO, short-write, interruption-before-call and interruption-after-success, with a fixed applicability or impossibility reason for every operation-class cell
      When the harness enumerates production sites and generated applicable fixture IDs without running reconciliation
      Then operation set equality and full operation-by-failure-class set and cardinality equality cover every applicable cell once, assert every impossibility reason, and reject missing, extra, collapsed or skipped cells

    @rejection @public-cli @surface.safeword-cli
    Scenario: Each reconciliation syscall failure recovers from its observed state
      Given the reconciliation failure manifest passed completeness and one labeled cell is selected
      When the harness injects only that cell's failure and then retries without the fault
      Then a uniquely labeled isolated result records actually observable live, staged and journal bytes without predicting un-fsynced durability, restart reaches one complete result, and aggregate result-label set and cardinality equal the complete manifest without early-loop termination

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Reconciliation paths reject hostile objects and replacement races
      Given each workflow, identity, configuration, journal and staged path is independently subjected to <hostile-path-state>
      When the public CLI reconciles while a recorder watches opened object and parent identities
      Then reconciliation follows no link, writes only through verified parent handles, trusts no substituted bytes, performs no unjournaled mutation, retains any durable journal after late divergence, and restart either completes the classified journal state or reports conflict without further live mutation
      Examples:
        | hostile-path-state |
        | a symlink or Windows reparse point at the leaf |
        | a symlink or reparse point in a parent component |
        | a hard link to a different inode or Windows file identity |
        | a directory or special file where a regular file is required |
        | leaf replacement between classification and open |
        | parent replacement between open and rename |
        | object identity change between write, fsync and final verification |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Reconciliation divergence produces a no-mutation conflict
      Given <divergence>
      When public Safeword CLI setup or upgrade reconciles remote verification
      Then it preserves byte-for-byte the requested opt-in, installed configuration, workflow, identity, journal and staged artifacts and reports recovery guidance without cleanup or live mutation
      Examples:
        | divergence |
        | the live workflow differs from its recorded installed base |
        | an interrupted transaction matches neither its recorded old nor new identity |

    @public-cli @surface.safeword-cli
    Scenario Outline: A known interrupted reconciliation resolves to one complete identity pair
      Given the journaled transaction stopped <point>
      When public Safeword CLI setup resumes reconciliation
      Then it <recovery> and removes the journal only after workflow, recorded identity and installed-identity configuration all agree with the selected side
      Examples:
        | point | recovery |
        | before either live artifact changed | retains the complete old pair, removes unused staged files, and removes the journal last |
        | after only one live artifact changed | completes the exact new pair and removes the journal last |
        | after both live artifacts changed but before journal removal | verifies the exact new pair and removes the journal idempotently without rewriting live bytes |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Installed configuration participates in every old-new reconciliation combination
      Given a durable journal and live workflow, identity and installed-configuration members respectively match <workflow-side>, <identity-side> and <configuration-side>
      When public Safeword CLI setup resumes reconciliation
      Then <member-outcome>
      Examples:
        | workflow-side | identity-side | configuration-side | member-outcome |
        | old | old | old | all old bytes remain and staged new bytes and journal are removed |
        | new | old | old | identity and configuration complete to new before journal removal |
        | old | new | old | workflow and configuration complete to new before journal removal |
        | old | old | new | workflow and identity complete to new before journal removal |
        | new | new | old | configuration completes to new before journal removal |
        | new | old | new | identity completes to new before journal removal |
        | old | new | new | workflow completes to new before journal removal |
        | new | new | new | all bytes are verified and journal is removed without rewriting members |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Initial installation recovers with an absent old identity pair
      Given first opt-in has no pending identity dependency or hostile path and observes <installation-state> while installed-identity configuration is <configuration-state>
      When the public Safeword CLI setup reconciles installation
      Then <installation-outcome>
      Examples:
        | installation-state | configuration-state | installation-outcome |
        | both managed paths absent, no journal, and no staged members | requested with installed identity absent | a journaled exact new workflow, identity and installed-configuration set is installed |
        | a pre-existing unowned workflow or identity path | requested with installed identity absent | all existing bytes and requested state are preserved and setup reports conflict |
        | an authenticated durable installation journal recording an absent old set and exact new three-member bytes, with live workflow equal to new, live identity and configuration absent, and exact readable staged identity and configuration members | requested with installed identity absent | exact staged identity and installed configuration complete before journal removal |
        | the same authenticated journal, with live identity equal to new, live workflow and configuration absent, and exact readable staged workflow and configuration members | requested with installed identity absent | exact staged workflow and installed configuration complete before journal removal |
        | the same authenticated journal, with all three live members equal to its exact new bytes | installed identity matches journaled new side | all three members are verified and journal removed without rewriting live bytes |
        | an authenticated journal whose required live artifact is missing | requested bytes not matching the journal side | every live member is preserved and setup reports conflict with the journal retained |
        | an authenticated journal whose required staged artifact is missing | installed bytes not matching the journal side | every live member is preserved and setup reports conflict with the journal retained |
        | an authenticated journal with an unreadable required artifact | divergent bytes not matching the journal side | every live member is preserved and setup reports conflict with the journal retained |
        | an authenticated journal with a corrupt required artifact | divergent bytes not matching the journal side | every live member is preserved and setup reports conflict with the journal retained |
        | an authenticated journal whose live and staged artifacts match neither recorded side | divergent bytes not matching the journal side | every live member is preserved and setup reports conflict with the journal retained |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Each observed restart state has one exact reconciliation result
      Given restart observes <durable-state> after <interrupted-operation>
      When public Safeword CLI setup resumes reconciliation
      Then <recovery-state>
      Examples:
        | interrupted-operation | durable-state | recovery-state |
        | staged-workflow write before journal creation | old live pair with no journal and discardable staged bytes | old pair remains authoritative, staged bytes are removed, and retry is safe |
        | staged-workflow fsync before journal creation | old live pair with no journal and discardable staged bytes | old pair remains authoritative, staged bytes are removed, and retry is safe |
        | journal write before durable journal publication | old live pair with no durable journal and discardable staged pair | old pair remains authoritative, staged bytes are removed, and retry is safe |
        | journal fsync before durable journal publication | old live pair with no durable journal and discardable staged pair | old pair remains authoritative, staged bytes are removed, and retry is safe |
        | journal rename before durable journal publication | old live pair with no durable journal and discardable staged pair | old pair remains authoritative, staged bytes are removed, and retry is safe |
        | workflow rename returned before parent-directory fsync | old live set with durable journal and staged new set | old set remains authoritative, staged bytes and journal are removed in that order |
        | workflow rename returned before parent-directory fsync | new workflow plus old identity and configuration with durable journal and staged new members | resume installs and fsyncs remaining new members, yielding the new set before journal removal |
        | all member renames returned before parent-directory fsync | new live set with durable journal | resume fsyncs the directory, verifies the new set, then removes the journal |
        | parent-directory fsync after the new pair is durable | new live pair with durable journal | resume verifies the new pair and removes the journal without rewriting live bytes |
        | truncated or corrupt journal | unchanged classified live bytes plus unauthenticated journal bytes | live bytes are preserved and setup reports a no-mutation recovery conflict |
        | staged-file cleanup after the old pair was selected | old live pair with durable journal and unused staged bytes | cleanup removes staged bytes then journal while the old pair remains byte-identical |
        | journal cleanup after the new pair was selected | new live pair with completed journal | cleanup removes only the journal while the new pair remains byte-identical |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Platform crash evidence feeds observed state rather than predicting nondurable rename outcome
      Given the supported platform filesystem kills a subprocess <crash-point>
      When restart records the actual workflow, identity, installed configuration, journal and staged bytes before reconciliation
      Then the observed combination enters exactly the matching state-machine row and reaches its one prescribed result
      Examples:
        | crash-point |
        | during each staged-member write before its file fsync |
        | after each staged-member file fsync returns |
        | during journal write before journal file fsync |
        | after journal file fsync but before journal rename |
        | after journal rename but before parent-directory fsync |
        | after each workflow, identity or installed-configuration live rename but before its required directory fsync |
        | after the live-member directory fsync returns but before exact-set verification |
        | after exact-set verification but before journal unlink |
        | after journal unlink but before its parent-directory fsync |
        | after final journal-removal directory fsync returns |

  @offload-tests.TBU1.R9
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R9 — Invalid public syntax or unauthenticated derived revision data is rejected without local or remote execution

    @rejection
    Scenario Outline: Invalid requests execute nowhere
      Given the public command and Git collaborator expose <invalid-input>
      When the builder runs <public-command> before eligibility checks
      Then it exits nonzero with SAFEWORD_TEST_EXECUTION_INVALID naming <invalid-boundary>, invokes no plan command, sends no dispatch, creates no pending record, and changes no project configuration
      Examples:
        | invalid-input | public-command | invalid-boundary |
        | ordinary authenticated repository state | `safeword project test --lane unknown` | lane enum |
        | ordinary authenticated repository state | `safeword project test --lane done --revision HEAD` | unsupported revision option |
        | ordinary authenticated repository state | `safeword project test --lane done --ref refs/heads/main` | unsupported ref option |
        | ordinary authenticated repository state | `safeword project test --lane done --owner other` | unsupported owner option |
        | ordinary authenticated repository state | `safeword project test --lane done --repository other` | unsupported repository option |
        | production Git HEAD read returns an abbreviated, uppercase, option-like, whitespace-padded or multi-record value instead of one 40-lowercase-hex SHA | `safeword project test --lane done` | derived immutable revision |
        | production Git HEAD acquisition exits nonzero | `safeword project test --lane done` | derived immutable revision acquisition |
        | production Git HEAD acquisition returns empty output for an unborn or missing HEAD | `safeword project test --lane done` | derived immutable revision acquisition |
        | production Git HEAD acquisition exceeds its bounded timeout | `safeword project test --lane done` | derived immutable revision acquisition |
        | production Git HEAD acquisition is terminated by a signal | `safeword project test --lane done` | derived immutable revision acquisition |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Repository and branch canonicalization has one observable result
      Given authenticated repository metadata and local Git remotes present <identity-boundary>
      When the public CLI canonicalizes remote eligibility and constructs the refs API request
      Then <canonical-outcome>, and no rejected candidate receives authentication or becomes canonical
      Examples:
        | identity-boundary | canonical-outcome |
        | branch `feature/a.b_c-1` | the canonical `refs/heads/feature/a.b_c-1` value is retained and its slash is percent-encoded exactly once in path data |
        | a valid branch containing other Git-allowed non-option characters | Git check-ref-format decides validity and API path data is encoded exactly once |
        | an already percent-encoded or double-encoded branch input | input is rejected rather than decoded or encoded again |
        | owner or repository case differing from authenticated API canonical case | authenticated API owner and name become canonical without case-folded guessing |
        | one remote URL ending in `.git` | exactly one transport suffix is removed before API identity comparison |
        | an exact `https://github.com/owner/repository.git` URL without credentials, query, fragment or port | its owner and repository become only an unauthenticated candidate pending API canonicalization |
        | an exact `git@github.com:owner/repository.git` SCP-like URL | its owner and repository become only an unauthenticated candidate pending API canonicalization |
        | a renamed local remote with one canonical same-repository URL | local remote name is irrelevant and the canonical API identity is selected |
        | multiple remotes resolving to the same canonical repository and SHA | they collapse to one unambiguous identity |
        | multiple candidate remotes resolving to different canonical repositories | remote execution is ineligible before POST and local fallback preserves the lane |
        | an HTTPS URL containing embedded user information or credentials | that candidate is rejected before any network request |
        | an HTTPS URL containing a query or fragment | that candidate is rejected before any network request |
        | a GitHub-like path on any host other than exact `github.com` | that candidate is rejected before any network request |
        | an SSH or SCP-like URL with an extra colon, explicit or malformed port, missing owner, or ambiguous path | that candidate is rejected before any network request |
        | an owner or repository containing percent-encoded bytes | that candidate is rejected rather than decoded |
        | a repository ending in repeated `.git.git` suffixes | that candidate is rejected rather than repeatedly normalized |

  @offload-tests.TBU1.R10
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R10 — The remote workflow independently revalidates revision and lane before executing repository code

    @surface.github-actions-execution-sandbox
    Scenario: The workflow validates request consistency before checkout
      Given the workflow receives a supported lane, token, full target SHA and canonical branch ref
      When it starts before repository checkout
      Then it validates token, target-ref digest, SHA, lane and immutable workflow context and observes the same repository branch tip at the supplied SHA without claiming to authenticate CLI origin or reading Actions metadata

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Invalid or moved workflow input stops before repository code
      Given the workflow receives <remote-boundary>
      When pre-checkout validation runs
      Then the job fails without checkout or repository command execution
      Examples:
        | remote-boundary |
        | an unsupported lane |
        | a branch moved before observation |
        | a target-ref digest inconsistent with the canonical branch input |

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Every workflow identity input rejects its first noncanonical boundary
      Given the raw workflow_dispatch event contains <invalid-identity>
      When the pinned trusted validator reads the event before checkout
      Then validation fails before checkout, dependency installation, repository helper or repository command execution
      Examples:
        | invalid-identity |
        | an empty request token |
        | a request token shorter or longer than exactly 64 lowercase hexadecimal characters |
        | a request token containing non-hexadecimal, uppercase, option-like or percent-encoded text |
        | duplicate request-token fields in raw event JSON |
        | an empty target SHA |
        | a target SHA shorter or longer than exactly 40 lowercase hexadecimal characters |
        | a target SHA containing non-hexadecimal, uppercase, option-like or percent-encoded text |
        | duplicate target-SHA fields in raw event JSON |
        | an empty branch ref |
        | an option-like, tag, abbreviated, differently cased or percent-encoded branch ref |
        | a branch ref outside canonical `refs/heads/<validated-name>` syntax |
        | duplicate branch-ref fields in raw event JSON |
        | a target-ref digest that is missing, duplicated, non-lowercase-hex, not 64 characters or inconsistent with target-ref bytes |
        | duplicate lane fields in raw event JSON |

    @rejection @surface.github-actions-execution-sandbox
    Scenario: The workflow identity-input boundary matrix is complete
      Given a test-owned literal manifest crosses request token, target SHA, target ref, target-ref digest and lane with omission, empty string, wrong JSON type, first-short, first-long, noncanonical character or encoding, equal duplicate and unequal duplicate where applicable
      When an independent raw-event generator compares its fixture IDs with validator executions without importing production parser tables
      Then expected field-by-boundary ID set and cardinality equal generated and executed result sets and cardinalities, every invalid cell fails before checkout, and exactly one canonical control per field is accepted

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: The production validator consumes the exact workflow event bytes before checkout
      Given the managed job receives <event-source> at the exact absolute path in `GITHUB_EVENT_PATH` and records that file's pre-parse SHA-256
      When the pinned validator opens that path without following a substituted link and parses its raw bytes before checkout
      Then <event-outcome>, the validator output names the same byte digest, and no normalized in-memory context object substitutes for raw-file validation
      Examples:
        | event-source | event-outcome |
        | a real GitHub-created canonical workflow_dispatch event file | its exact declared inputs are validated and execution may continue |
        | a byte-preserving test-owned event file with a duplicate raw key | validation fails before repository code, proving the parser's defense-in-depth duplicate rejection |
        | a GitHub event file whose platform serialization has already normalized caller input to one canonical member per declared key | validation relies on the exact normalized bytes plus the managed workflow's closed input declaration and does not claim it observed discarded pre-normalization duplicates |

    @surface.github-actions-execution-sandbox
    Scenario: A direct replay with matching visible inputs can execute but proves no CLI origin
      Given a direct caller replays a visible token, full target SHA, lane and branch consistently
      When the managed workflow validates those inputs
      Then the job may execute because no workflow-side MAC authenticates CLI origin

    @rejection
    Scenario: Resume rejects duplicate exact matches created by a direct replay
      Given an authenticated pending record has no run ID and discovery exposes two runs matching every frozen visible identity field
      When Safeword correlates the pending request
      Then it keeps the request indeterminate for explicit run-ID recovery and neither redispatches nor falls back locally

  @offload-tests.TBU1.R11
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R11 — An accepted or pending dispatch remains resumable after local interruption without redispatching

    @public-cli @surface.safeword-cli
    Scenario Outline: Resume recovers the same run without another POST
      Given an authenticated pending record has <correlation-state>
      When the builder invokes the public CLI resume command
      Then Safeword identifies or continues only the matching frozen run, persists progress, prints its run URL and terminal or next action, exits accordingly, and never redispatches
      Examples:
        | correlation-state |
        | its recorded positive run ID |
        | exactly one matching visible run before ID persistence |

    @public-cli @surface.safeword-cli
    Scenario Outline: Each resume side effect is independently observable
      Given an authenticated pending record identifies one exact accepted run and an oracle records outbound requests and durable writes
      When the public CLI resumes through <resume-stage>
      Then <stage-outcome>
      Examples:
        | resume-stage | stage-outcome |
        | correlation | only the exact frozen run ID becomes selected |
        | run-ID persistence | the authenticated record durably contains that exact ID before observation |
        | queued or running observation | output contains the canonical frozen-identity run URL |
        | terminal persistence | the authenticated terminal result is durable before record closure |
        | terminal reporting | output and exit match the exact conclusion mapping |
        | complete request trace | every request is GET and the POST count remains zero |

    Scenario Outline: Clock discontinuity cannot hide an exact pending run match
      Given an authenticated pending record has no run ID and the observable clocks <clock-state>
      When resume finds exactly one run matching every frozen non-time identity field
      Then Safeword accepts that run without using a creation-time window and never redispatches
      Examples:
        | clock-state |
        | are skewed |
        | moved backward |
        | moved forward |

    @rejection
    Scenario Outline: Unsafe pending recovery fails closed
      Given a pending record has <unsafe-state>
      When the builder resumes it
      Then Safeword neither accepts a run, redispatches, nor falls back locally and prints manual recovery guidance
      And an unauthenticated record emits only a fixed ASCII error code and fixed bundled guidance with no record-derived URL, identifier, control character, terminal sequence, clickable target or automatically opened destination, while an authenticated unsafe record may print only its validated canonical non-secret identity fields as inert escaped text
      Examples:
        | unsafe-state |
        | an invalid MAC |
        | a missing key |
        | an invalid MAC over owner, repository and identifier bytes containing newlines, bidi controls, ANSI escapes, terminal hyperlinks, URL delimiters and overlong text |
        | an unsupported newer schema |
        | duplicate matching visible runs |
        | a user-selected run ID that mismatches frozen identity |

    @rejection @public-cli @surface.safeword-cli
    Scenario: Every pending-record byte field is covered by the MAC
      Given a valid authenticated control and a test-owned literal inventory of every serialized field
        | field |
        | record schema version |
        | Safeword CLI version |
        | actor ID |
        | actor login |
        | repository owner |
        | repository name |
        | workflow ID |
        | workflow path |
        | default-branch name |
        | workflow-source SHA |
        | trusted workflow hash |
        | managed workflow version |
        | target branch |
        | target-ref digest |
        | target SHA |
        | lane |
        | start time |
        | request token |
        | MAC key ID |
        | record status |
        | accepted run ID |
        | terminal conclusion |
        | closure state |
      When the harness changes each field's bytes once without MAC recomputation while holding all other bytes at the authenticated control
      Then every tampered case fails MAC authentication with zero GET, zero POST, zero acceptance and zero record rewrite while the control authenticates

    @rejection @public-cli @surface.safeword-cli
    Scenario: The malformed pending-record fixture matrix is complete
      Given the test harness recomputes a valid MAC over each test-owned malformed raw-record fixture
      And an independent literal field-defect applicability matrix marks every omission, equal duplication, unequal duplication, wrong JSON type, noncanonical encoding, out-of-range value and incompatible-version cell as applicable or impossible with a fixed reason
      When the harness enumerates fixture IDs and impossible-cell reasons without invoking resume
      Then exact set and cardinality equality covers every applicable cell once, asserts every impossible reason, and rejects unsupported, collapsed, missing or extra cells

    @rejection @public-cli @surface.safeword-cli
    Scenario: Each authenticated malformed pending record fails its specific validator
      Given the malformed pending-record matrix passed completeness and one valid-MAC malformed fixture is selected
      When the public CLI resumes only that isolated fixture
      Then one uniquely labeled isolated result reports its specific check before GET, POST, acceptance or rewrite, and aggregate result-label set and cardinality equal the complete applicable-cell manifest without early-loop termination

    @rejection @public-cli @surface.safeword-cli
    Scenario: Filesystem mutations retain verified parent-handle identity through durability
      Given independent recorders capture opened parent directory handles and platform file identities for opt-in, pending, reconciliation and key-store mutations
      When production performs classification, temporary creation, rename or unlink, directory fsync and final verification
      Then every operation and fsync uses the same pinned verified parent handle, any handle or object identity discontinuity fails closed, and no path is re-resolved through an unverified parent

    @rejection @public-cli @surface.safeword-cli
    Scenario: Production schemas and runtime sinks exactly match security mutation inventories
      Given fixed test-owned manifests list pending-record fields, dispatch fields and workflow sink categories
      When an independent harness enumerates exported production record-schema properties, captured serializer keys, workflow AST inputs and uses, process environment and argv, pre-check filesystem writes and Git credential configuration
      Then set equality has no missing or extra field or sink before any mutation case runs, and every manifest item has at least one concrete mutation fixture

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Concurrent pending-state operations have one scheduled linearization
      Given two public CLI processes pause at synchronized read and commit barriers for <race>
      When the harness releases them in <schedule>
      Then <linearized-outcome>, each process has the literal expected output and exit, only winner-owned durable files or key material remain, all loser temp files are removed, no unrelated journal exists, and interruption immediately before and after the selected commit recovers to the same linearized state
      Examples:
        | race | schedule | linearized-outcome |
        | duplicate token preparation | first commit before second compare-and-swap | one authenticated record and one POST exist; the loser may create only owner-scoped temporary bytes that are removed, publishes no final record, commits no key material, and sends no network byte |
        | key rotation versus new record | record commit before rotation commit | the record uses the old active key and rotation is refused byte-for-byte |
        | key rotation versus new record | rotation commit before record commit | the record reloads state and uses the new active key; the retired key remains |
        | retired-key cleanup versus final record closure | closure commit before cleanup compare-and-swap | the closed record is durable, then exactly the now-unreferenced retired key is removed |
        | disable versus opening a dependent request | request commit before disable compare-and-swap | disable is refused and the installed set remains exact |
        | disable versus opening a dependent request | disable commit before request compare-and-swap | disable completes and the request becomes locally fallback-eligible with zero POST |
        | two resume writers adding run ID and terminal progress | run-ID commit before terminal compare-and-swap | terminal writer reloads and preserves run ID while adding terminal state without regression |
        | two resume writers adding run ID and terminal progress | terminal commit before stale run-ID compare-and-swap | stale writer reloads closed state and performs no overwrite or network request |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: An isolated older valid-MAC pending-file snapshot cannot regress anchored progress
      Given the owner-only monotonic request anchor durably records <authoritative-stage> and only the pending-record file is replaced with its older valid-MAC <restored-stage> snapshot
      When the public CLI resumes the request after restart
      Then it detects the record behind the anchor, sends zero POST, starts no local fallback, never regresses output or result, and <rollback-outcome>
      Examples:
        | authoritative-stage | restored-stage | rollback-outcome |
        | accepted run ID | pre-dispatch pending | reconstructs the exact accepted run ID from the journaled anchor before issuing only identity-checked GETs |
        | queued or running observation | accepted run ID | reconstructs the latest monotonic observation and continues only the same run |
        | terminal result | queued or running observation | reconstructs the exact terminal conclusion, reports its original exit, and performs no network request required to weaken it |
        | closed terminal record | open terminal record | restores closed state idempotently and cannot revive the request or retain a new key dependency |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: The pending-record MAC key remains owner-only and identity-stable
      Given the per-user machine key store is <key-state>
      When the public CLI creates or authenticates a pending record
      Then <key-outcome>
      Examples:
        | key-state | key-outcome |
        | newly created | one random 256-bit key and stable key ID are stored with owner-only platform permissions |
        | reopened after process restart | the same key ID authenticates the record without changing key bytes or permissions |
        | a POSIX key file or parent directory has group or other mode bits such as 0640 or 0644 | real stat evidence fails closed before dispatch and reports unsafe permissions |
        | a Windows key file inherits or explicitly grants any non-owner, non-SYSTEM ACE | real security-descriptor evidence fails closed before dispatch and reports unsafe ACLs |
        | the key path or any parent component is a symlink or reparse point | no link is followed and use fails closed |
        | a POSIX key file has link count greater than one or a Windows key file has another hard-link alias to the same file identity | key use fails closed before record authentication or dispatch |
        | inode or Windows file identity changes between open, permission check and final read verification | the replacement race fails closed without authenticating a record |
        | missing, unreadable, replaced or mismatched against its key ID | resume performs no GET, POST or fallback and prints only fixed record-independent ASCII recovery guidance |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Key rotation preserves every dependent authenticated record
      Given key rotation is requested with <dependency-state>
      When the public CLI evaluates the key inventory
      Then <rotation-outcome>
      Examples:
        | dependency-state | rotation-outcome |
        | an open record references the active key | rotation is refused without changing key or record bytes |
        | no open record references the active key | a new active key and stable ID are created while the retired key is retained |
        | a closed record is the final dependent of a retired key | only that retired key becomes cleanup-eligible after durable record closure |

    @rejection
    Scenario: No visible run after bounded polling remains pending
      Given an authenticated pending record has no run ID
      When bounded visibility polling and pagination find no exact frozen-identity match
      Then the request remains pending with a resume command and Safeword sends neither dispatch POST nor local fallback

    @rejection
    Scenario: A duplicate open request token stops before dispatch
      Given a new request token is already present in another authenticated open record
      When Safeword prepares the pending record
      Then it creates no second record and sends no dispatch request

    Scenario: Resume retries observation but never dispatch for transient GitHub reads
      Given an authenticated pending record identifies one frozen workflow request
      When bounded paginated run discovery or result watching encounters a rate limit, transient network error, or HTTP 5xx
      Then Safeword uses bounded idempotent GET backoff, preserves recovery on exhaustion, and sends no additional POST

    @live @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario: The public CLI completes the disposable GitHub interruption and resume path
      Given a disposable real GitHub repository opts in and setup installs the exact managed workflow
      When the public Safeword CLI dispatches a valid lane and is interrupted before persisting the returned run ID
      Then a public CLI resume correlates the exact observable run without redispatch, watches it to a terminal conclusion, and reports that conclusion plainly

  @offload-tests.TBU1.R12
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R12 — Only the exact trusted managed workflow version can produce authoritative remote evidence

    @surface.github-actions-execution-sandbox
    Scenario: Exact workflow bytes at both trust boundaries produce eligible evidence
      Given the bundled exact-byte SHA-256 matches the workflow at the observed default-branch SHA
      When the accepted run reports that same workflow-source SHA and bytes
      Then its supported pending identity remains eligible for authoritative evidence

    @rejection @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario: Bundled workflow bytes cannot redefine their independent trusted hash
      Given a manually maintained test-owned literal manifest fixes the supported workflow version and lowercase SHA-256 independently of production template generation
      When production bundled bytes and a one-byte-mutated candidate are hashed
      Then only bundled bytes matching the literal hash remain eligible and changing production bytes or metadata cannot update the test-owned oracle

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Workflow identity divergence fails at its observed boundary
      Given workflow identity differs <boundary>
      When Safeword evaluates remote trust
      Then Safeword reports <outcome>
      Examples:
        | boundary | outcome |
        | during preflight | conclusive local fallback without dispatch |
        | at the accepted run source | authoritative integrity failure without local rerun |
        | because project configuration names different trusted bytes | rejection because configuration cannot redefine trusted bytes |

    @public-cli @surface.safeword-cli
    Scenario: A post-acceptance default-branch rename does not rewrite frozen run authority
      Given an accepted run's immutable workflow ID, path, source SHA and target identity match the authenticated pending record
      When repository metadata later renames or moves the default branch before result inspection
      Then result observation issues no current repository-metadata request, makes no mutable default-branch comparison, and the exact accepted run remains authoritative

    @rejection @surface.github-actions-execution-sandbox
    Scenario Outline: Exact-byte workflow identity rejects every normalization boundary
      Given a test-owned byte fixture differs from bundled trusted bytes only by <byte-mutation>
      When Safeword hashes raw locally bundled or independently base64-decoded GitHub contents bytes
      Then exact identity rejects the candidate before authoritative evidence
      Examples:
        | byte-mutation |
        | an empty file |
        | one added or removed final newline |
        | CRLF replacing LF |
        | a leading UTF-8 BOM |
        | one non-UTF-8 byte |
        | malformed contents-API base64 |
        | decoded bytes truncated below the declared size |
        | decoded bytes exceeding the documented size ceiling |
        | different bytes with YAML-equivalent meaning |

    @rejection @surface.github-actions-execution-sandbox
    Scenario: A default-branch workflow race can start repository code but cannot produce trusted evidence
      Given exact workflow bytes passed preflight and the default branch moves before GitHub resolves dispatch
      When the accepted run reports different immutable workflow-source bytes
      Then Safeword reports the documented execution limitation and authoritative integrity failure, supplied no Safeword secret or local credential, and starts no automatic local rerun

    @rejection @surface.github-actions-execution-sandbox
    Scenario: A substituted workflow cannot receive Safeword-owned sentinel credentials through the dispatch race
      Given local configuration, pending state and GitHub API authorization use distinct test-owned sentinel values
      And a repository-controlled workflow replaces trusted bytes after preflight and records every received input, environment value, argument, pre-check file and credential-helper setting
      When GitHub starts that substituted workflow from the moved default branch
      Then its captured channels contain only the five allowlisted identity inputs and no Safeword-owned sentinel, while Safeword rejects its source identity without fallback

    @rejection @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario: Canonical API authorization placement never follows a redirect
      Given the production HTTP transport receives a usable test credential with a unique canary and independently captured direct and redirect response fixtures
      When it sends the canonical-origin request and receives each fixture
      Then the canary appears only in the initial canonical Authorization header, no redirected request is sent, and pending bytes contain no credential

    @live @real-github @rejection @public-cli @surface.safeword-cli @surface.github-actions-execution-sandbox
    Scenario: A usable API credential is absent from every workflow-visible channel
      Given an independently verified usable live GitHub credential has a test-owned canary hash and a disposable repository can deterministically move from exact preflight bytes to a substituted capture workflow
      When the public CLI dispatches and that substituted workflow successfully captures inputs, environment, arguments, files and credential helpers
      Then no captured value matches the credential or canary, the raw direct request proves Authorization placement, and any fixture failure leaves the live gate incomplete rather than skipped

  @offload-tests.TBU1.R13
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R13 — Local fallback identifies its checkout state at both command-invocation boundaries and refuses evidence when those states differ

    Scenario Outline: Matching endpoint fingerprints qualify the raw local result
      Given an independent recorder enumerates the exact HEAD and Git-visible record bytes at both invocation boundaries, computes the reference SHA-256 including every domain tag and length prefix, and both complete record sets and expected digests are byte-identical
      When the real local plan exits <exit>
      Then both production fingerprint bytes equal the independently computed digest, Safeword reports <result> for that exact HEAD and record set, and names every unmeasured evidence limitation
      Examples:
        | exit | result |
        | zero | passed with evidence limits |
        | nonzero | local failure |

    @rejection
    Scenario Outline: Untrusted endpoint fingerprints take precedence over command exit
      Given an endpoint fingerprint is <fingerprint-state>
      When the real local plan returns any exit status
      Then overall evidence is indeterminate, the raw exit is separate, and no result is attributed to the earlier checkout
      Examples:
        | fingerprint-state |
        | changed |
        | unstable |
        | unreadable |
        | over a documented file, byte, or time limit |

    @rejection @public-cli
    Scenario Outline: Every Git-visible fingerprint record detects boundary mutation
      Given local fallback has a stable first invocation-boundary fingerprint
      When <record-class> is observably different at the stable second boundary, including after the real resolved command waited on its scheduler
      Then evidence is indeterminate, reports the raw command exit separately, and attributes no pass or failure to the earlier checkout
      Examples:
        | record-class |
        | HEAD identity |
        | cached binary diff or index state |
        | worktree binary diff |
        | submodule state |
        | untracked regular-file bytes |
        | symlink link text without following the target |
        | a listed entry becoming unreadable, special, or concurrently unstable |

    @rejection @public-cli
    Scenario Outline: Traversal replacement races never read outside the classified repository object
      Given a barrier pauses fingerprint traversal after classification but before read
      When the harness performs <path-race>
      Then fingerprint evidence is indeterminate, the opened object's identity mismatch is reported, and a sentinel outside the repository is never read
      Examples:
        | path-race |
        | a parent directory is renamed and replaced by a symlink |
        | a regular file is replaced by a symlink |
        | a file is replaced by a hard link to a different inode |
        | a parent rename makes the original relative path escape the checkout |
        | size, mode, inode or file identity changes between classification and verified read |

    @rejection @public-cli
    Scenario Outline: Excluded mutations remain named limitations rather than fingerprint evidence
      Given stable matching repository endpoint fingerprints
      When <excluded-state> changes during the local command
      Then the repository fingerprint remains equal, output names that exclusion as unmeasured, and Safeword makes no continuous-stability claim
      Examples:
        | excluded-state |
        | an ignored file |
        | an out-of-repository dependency |
        | an environment variable or external toolchain |
        | a symlink target while its repository link text stays equal |
        | a Git-visible value that changes and is restored before the second boundary |

    @rejection @public-cli
    Scenario Outline: Fingerprint ceilings accept their exact boundary and reject the first excess
      Given versioned limits are 100000 files, 1073741824 bytes, 30 monotonic seconds and 3 total attempts including 2 retries, and every unmentioned dimension stays safely below its limit
      And the injected fingerprint harness reaches <boundary>
      When local fallback computes two stable endpoint fingerprints
      Then <boundary-outcome>
      Examples:
        | boundary | boundary-outcome |
        | 99999 files | evidence evaluation continues |
        | 100000 files | evidence evaluation continues |
        | 100001 files | evidence is indeterminate with the file-count limit named |
        | 1073741823 bytes | evidence evaluation continues |
        | 1073741824 bytes | evidence evaluation continues |
        | 1073741825 bytes | evidence is indeterminate with the byte limit named |
        | one monotonic tick below 30 seconds | evidence evaluation continues |
        | exactly 30 monotonic seconds | evidence evaluation continues |
        | one monotonic tick above 30 seconds | evidence is indeterminate with the time limit named |
        | 2 total attempts with 1 retry | evidence evaluation continues |
        | 3 total attempts with 2 retries | evidence evaluation continues |
        | a requested fourth total attempt | evidence is indeterminate with the 3-attempt and 2-retry limits named |

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Every fingerprint record class contributes exact framed bytes to the ceiling
      Given all other fingerprint records total zero and <record-bytes> crosses the 1073741824-byte ceiling only when its type tag, length prefix, path and payload are all counted
      When the public CLI fingerprints through real Git output and file readers
      Then accounting includes that complete framed record and the first excess is indeterminate
      Examples:
        | record-bytes |
        | HEAD identity bytes |
        | porcelain-v2 status bytes |
        | cached binary diff bytes |
        | worktree binary diff bytes |
        | submodule output bytes |
        | untracked path and regular-file payload bytes |
        | symlink path and link-text bytes |
        | record type tag and length-prefix bytes |
        | oversized Git command output before any file payload |

  @offload-tests.NTB1.R1
  @public-cli @surface.safeword-cli
  Rule: offload-tests.NTB1.R1 — Enabling remote verification requires no hand-authored CI workflow or translated test command

    Scenario Outline: One project option installs the managed workflow and preserves the normal test request
      Given local mode has no managed workflow or identity and a disposable repository independently records exact bundled workflow bytes
      When the builder runs `safeword project test-execution set remote-preferred` followed by `safeword project test --lane <lane>` at an eligible pushed tip
      Then the set command exits zero after exact workflow, identity and installed configuration bytes commit, the test command sends exactly one dispatch for <plan-kind> without a local plan invocation, and the builder edits no workflow or plan command
      Examples:
        | lane | plan-kind |
        | done | `test` |
        | full | `verify` |

    @rejection
    Scenario: Safeword never asks the builder to reproduce plan commands in workflow YAML
      Given a control commit and a second commit change only repository plan entries while an independent oracle records both exact resolver outputs and the managed workflow's byte digest
      When the public CLI dispatches both immutable commits and raw process events are captured
      Then the installed and executed workflow bytes remain digest-identical, each process trace equals only its commit's independently recorded resolver output, the traces differ exactly by the repository-only plan mutation, and no customer-authored workflow or translated command table is created or changed

  @offload-tests.NTB1.R2
  @public-cli @surface.safeword-cli
  Rule: offload-tests.NTB1.R2 — Every request plainly identifies local fallback, remote queueing, running, passing, failure, cancellation, or indeterminate dispatch

    Scenario Outline: Each execution state has a plain-language status and next action
      Given a verification request is in <state>
      When Safeword reports progress or completion
      Then it reports <classification>, includes <required-context>, exits <exit-behavior>, and never claims <forbidden-claim>
      Examples:
        | state | classification | required-context | exit-behavior | forbidden-claim |
        | local fallback | local fallback | HEAD, dirty state and evidence limits | with the evidence-qualified local result | remote equivalence |
        | remotely queued | remotely queued | canonical run link | only after terminal observation or interruption | completion |
        | remotely running | remotely running | canonical run link | only after terminal observation or interruption | completion |
        | passed | passed | canonical run link and source SHA | zero | local execution |
        | failed | failed | canonical run link and GitHub conclusion | nonzero | a masking local pass |
        | cancelled | cancelled | canonical run link and GitHub conclusion | nonzero | pass or failure |
        | dispatch indeterminate | dispatch indeterminate | resume command and pending-record identity | nonzero | pass, failure or safe fallback |

    @rejection
    Scenario: An indeterminate result is never described as pass or failure
      Given dispatch or local fingerprint evidence is indeterminate
      When Safeword reports the outcome
      Then it does not claim that verification passed or failed for the identified revision

  @offload-tests.NTB1.R3
  @public-cli @surface.safeword-cli
  Rule: offload-tests.NTB1.R3 — Missing authentication, workflow availability, or a pushed revision produces a useful local recovery instead of a dead end

    Scenario Outline: A missing remote prerequisite explains and starts safe local recovery
      Given effective remote-preferred mode lacks <prerequisite> and the deterministic local plan exits 23 with stable invocation-boundary fingerprints
      When the builder runs `safeword project test --lane <lane>`
      Then no dispatch or pending record is created, output names <reason-code> and local fallback with HEAD and dirty state, the real resolver selects <plan-kind>, its unchanged plan runs exactly once, every descendant exits, and the command exits 23 with evidence-qualified local failure
      Examples:
        | prerequisite | lane | plan-kind | reason-code |
        | GitHub authentication | done | `test` | SAFEWORD_REMOTE_AUTH_UNAVAILABLE |
        | the installed managed workflow | full | `verify` | SAFEWORD_REMOTE_WORKFLOW_UNAVAILABLE |
        | a pushed branch-tip revision | done | `test` | SAFEWORD_REMOTE_REVISION_UNPUSHED |

    @rejection
    Scenario: Helpful recovery never bypasses request validation or dispatch authority
      Given a request is invalid, accepted remotely, or dispatch-indeterminate
      When Safeword chooses a recovery path
      Then it does not automatically execute the local lane

    @rejection @public-cli @surface.safeword-cli
    Scenario: Public-behavior scenarios cannot omit their declared surface tag
      Given an independent Gherkin AST walker classifies steps invoking the public CLI, builder commands, persistence, output or exit behavior
      When it compares those scenarios with inherited feature, rule and scenario tags
      Then every classified scenario inherits `@public-cli` and `@surface.safeword-cli`, inherited multi-surface scenarios are explicitly permitted, pure sandbox scenarios need only their sandbox tag, and any future mismatch fails Gherkin lint
