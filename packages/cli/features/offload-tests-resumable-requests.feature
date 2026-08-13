@wip
Feature: Resume interrupted remote verification

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
