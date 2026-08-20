@wip @surface.safeword-cli
Feature: Let parallel sessions share test capacity safely

  Background:
    Given process evidence keys every started wrapper, ticket, container, command and descendant with monotonic sequence events

  @share-test-capacity.TBU1.R1
  Rule: share-test-capacity.TBU1.R1 — Separate worktrees using the current scheduler protocol may overlap focused file checks only within their shared bounded capacity

    Scenario: Focused checks in separate worktrees fill but never exceed shared capacity
      Given three real current-protocol wrappers in three distinct worktrees hold independent checkout mutexes and share capacity two
      When barriers hold the first two collaborators active before the third requests admission
      Then monotonic ready/release events show the first two repository-process lifetimes overlap, no more than two overlap, and after barriers release all three unchanged downstream invocations run exactly once and exit zero with the third starting only after a permit releases

    @wiring @process
    Scenario: Every focused permit reconciles with durable ownership and the complete process trace
      Given deterministic wrappers exercise admission, reservation, activation, duplicate release, replayed release, and failure between reservation and activation at shared capacity two
      When the bounded run completes and teardown proves every wrapper and descendant exited
      Then every repository-process lifetime has exactly one preceding atomic durable owner activation and one following atomic release, every owner transition has exactly one keyed wrapper, duplicate or replayed releases change no state, reservation failure starts no repository process and removes only its exact owner, no unkeyed repository descendant exists, peak active weight is two, and every wrapper exits with its predetermined status

    @wiring @process
    Scenario: Capacity eight admits eight focused lifetimes and gives a broad request all eight permits
      Given ten distinct real wrappers with lightweight deterministic collaborators in ten distinct worktrees register FIFO tickets for nine focused requests followed by one broad request and share canonical capacity eight
      When barriers hold the first eight focused repository lifetimes active before focused wrapper nine and broad wrapper ten queue
      Then exactly eight focused lifetimes overlap, wrapper nine starts only after one releases, and after all nine focused requests exit zero wrapper ten atomically owns all eight permits, runs once and alone, and exits zero

    @rejection
    Scenario Outline: Broad-shaped invocations never consume a focused permit
      Given the classifier receives <invocation> through a deterministic filesystem seam that contributes no native-platform evidence
      When it evaluates the original argument vector without running a repository process
      Then it assigns broad exclusive capacity and leaves the downstream argument vector unchanged
      Examples:
        | invocation |
        | argv `["tests/"]` |
        | empty argv `[]` |
        | argv `["--coverage"]` |
        | resolved lane metadata `done` |
        | argv `["alpha.test.ts", "--config", "vitest.alt.ts"]` |
        | argv `["alpha.test.ts", "--coverage"]` |
        | argv `["missing.test.ts"]` |
        | argv `["linked.test.ts"]` where the leaf is a symlink |
        | argv `["linked-dir/alpha.test.ts"]` where an ancestor is a symlink |
        | argv `["linked-dir/../alpha.test.ts"]` where the elided ancestor is a symlink outside the checkout |
        | argv `["src/alpha.ts"]` |
        | argv `["alpha.test.ts", "src/alpha.ts"]` |
        | argv `["alpha*.test.ts"]` as one literal token |
        | argv `["-alpha.test.ts"]` |
        | argv `["--", "alpha.test.ts"]` |
        | argv `["alpha.test.ts", "--unknown"]` |
        | argv `["--unknown", "alpha.test.ts"]` |

    @rejection @native-platform @platform-linux @platform-macos @platform-windows @process
    Scenario: Focused classification rejects an aliasing ancestor that escapes the checkout
      Given a real checkout path crosses a platform-native symlink or reparse-point directory to an external regular test file and the deterministic downstream collaborator exits zero
      When the public package-test command classifies that literal argument
      Then it treats the invocation as broad, passes the original argument unchanged downstream exactly once, never grants a focused permit, accounts for every descendant, and exits zero

    @native-platform @platform-macos
    Scenario: A macOS prefix above the checkout does not defeat focused classification
      Given a native macOS checkout root is reached through a prefix alias above its canonical root and `alpha.test.ts` has no symlinked component at or below that root
      When the public package-test command classifies that existing literal file
      Then it grants one focused permit, passes the original argument unchanged downstream once, accounts for every descendant, and exits zero

    Scenario Outline: Focused filename boundaries are exact and case-sensitive
      Given <arguments> resolve through a deterministic filesystem seam to existing regular files inside the canonical checkout root with no symlinked component at or below that root and contribute no native-platform evidence
      When the classifier evaluates them after checkout-relative rebasing without running a repository process
      Then it assigns <classification> and leaves every downstream argument unchanged
      Examples:
        | arguments | classification |
        | one `alpha.test.js` file | one focused permit |
        | one `alpha.spec.js` file | one focused permit |
        | one `alpha.test.jsx` file | one focused permit |
        | one `alpha.spec.jsx` file | one focused permit |
        | one `alpha.test.ts` file | one focused permit |
        | one `alpha.spec.ts` file | one focused permit |
        | one `alpha.test.tsx` file | one focused permit |
        | one `alpha.spec.tsx` file | one focused permit |
        | one `alpha.test.mjs` file | one focused permit |
        | one `alpha.spec.mjs` file | one focused permit |
        | one `alpha.test.mts` file | one focused permit |
        | one `alpha.spec.mts` file | one focused permit |
        | one `alpha.test.cjs` file | one focused permit |
        | one `alpha.spec.cjs` file | one focused permit |
        | one `alpha.test.cts` file | one focused permit |
        | one `alpha.spec.cts` file | one focused permit |
        | two valid `.test` and `.spec` files | broad exclusive capacity |
        | one `alpha.Test.ts` file | broad exclusive capacity |
        | one `alpha.tests.ts` file | broad exclusive capacity |
        | one `alpha.test.txt` file | broad exclusive capacity |
        | one `alpha.spec.ts.bak` file | broad exclusive capacity |
        | an absolute `alpha.test.ts` path canonically inside the checkout | one focused permit |
        | an `a/../alpha.test.ts` path where `a` is an existing real directory | one focused permit |
        | `../alpha.test.ts` issued from a nested checkout directory and rebased inside the root | one focused permit |
        | a `space name.test.ts` argument passed as one token | one focused permit |
        | an existing literal `alpha[1].test.ts` file | broad exclusive capacity |

    @rejection
    Scenario Outline: Non-file argument boundaries classify broad without contradictory fixtures
      Given <arguments> have <path-state> rather than an existing contained regular file and the deterministic downstream collaborator exits 23
      When the public package-test command classifies the original argv token
      Then it assigns broad exclusive capacity, passes the original token unchanged downstream exactly once, accounts for every descendant, and the wrapper exits 23
      Examples:
        | arguments | path-state |
        | an `../../alpha.test.ts` path | a lexical path that escapes the checkout |
        | an empty argument | no filesystem path |

    @rejection
    Scenario: Mixed legacy and current wrappers are not represented as safely sharing capacity
      Given a legacy package-test wrapper may still be running and durable current-protocol state is captured byte-for-byte at capacity one
      When a builder runs `safeword project test-capacity set 2` without confirmation and then runs status
      Then the set command exits nonzero with SAFEWORD_TEST_CAPACITY_INVALID, durable bytes and version remain unchanged, and zero-exit status identifies that legacy processes are untracked, instructs the operator to end every legacy execution, migrate every participating worktree, restore capacity one before any later legacy wrapper is used, and wait for the current scheduler to become idle before handoff

  @share-test-capacity.TBU1.R2
  Rule: share-test-capacity.TBU1.R2 — Participating package-test commands in one OS-user domain and worktree remain serialized across their complete build and test lifetimes

    Scenario: Same-worktree commands serialize their complete build and test lifetimes
      Given two real package-test wrapper processes in one OS-user capacity domain target the same worktree and every process event is keyed to wrapper, ticket, container and command
      When a barrier holds the first repository lifetime active until the second wrapper is observed waiting on the checkout mutex
      Then the second starts no repository descendant before every first-container descendant exits and the first wrapper releases scheduler ownership followed by its exact checkout ownership, after which both unchanged downstream invocations have run exactly once, every container is proven empty, and both wrappers exit zero

    @native-platform @platform-linux @platform-macos @process
    Scenario: POSIX filesystem aliases share one checkout mutex identity
      Given real wrappers in one OS-user capacity domain address one checkout through its canonical root, a symlink alias, and a bind-mount alias on a native POSIX filesystem
      When a barrier holds the canonical-path wrapper active while the alias-path wrapper requests checkout ownership
      Then the alias-path wrapper waits on the same checkout mutex and starts no repository descendant until the canonical-path wrapper's container is empty and its scheduler and checkout ownership are released

    @native-platform @platform-macos @process
    Scenario: An OS-managed macOS prefix alias shares its checkout mutex with the canonical path
      Given two real wrappers in one OS-user capacity domain address one checkout through its `/var` and `/private/var` spellings on a native macOS filesystem
      When a barrier holds the first wrapper active while the second requests checkout ownership
      Then the second waits on the same checkout mutex and starts no repository descendant until the first wrapper's container is empty and its scheduler and checkout ownership are released

    @native-platform @platform-windows @process
    Scenario: Windows filesystem aliases share one checkout mutex identity
      Given real wrappers in one OS-user capacity domain address one checkout through path-casing, junction, and `subst` aliases on a native local Windows filesystem
      When a barrier holds the first wrapper active while the second requests checkout ownership
      Then the second waits on the same checkout mutex and starts no repository descendant until the first wrapper's container is empty and its scheduler and checkout ownership are released

    @rejection @native-platform @platform-windows @process
    Scenario: A Windows UNC checkout without stable local identity fails closed
      Given a real wrapper addresses a checkout through a UNC path whose opened root cannot prove the same stable volume serial and file ID contract as a local filesystem
      When it requests checkout ownership
      Then it starts no repository process and exits nonzero with SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED plus `safeword project test-capacity status`

    @rejection @native-platform @platform-linux @platform-macos @platform-windows @process
    Scenario: A checkout identity change cannot create a second mutex
      Given one real wrapper has a durable checkout request and owns its checkout mutex but has not registered scheduler admission when the same canonical checkout root later opens with a different stable filesystem identity
      When a second wrapper in the same OS-user domain requests that checkout
      Then the canonical-root identity mapping rejects the mismatch, the second wrapper starts no repository process and exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE, and the original mutex remains held

    Scenario: An idle checkout can adopt a legitimate new filesystem identity
      Given a recorded canonical checkout path has no owner, waiter, request, or reclaiming weight and now opens with a different stable filesystem identity
      When a wrapper requests that checkout under the state guard
      Then the stale mapping is replaced atomically, one mutex is derived from the new identity, and the wrapper's unchanged invocation runs once to exit zero

    @rejection
    Scenario Outline: A terminated capacity wait releases only verifiable checkout ownership
      Given an exact public wrapper holds <checkout-state> and a registered waiter ticket while waiting for capacity
      When the wait <termination>
      Then <scheduler-cleanup>, <checkout-cleanup>, no repository process starts, and the wrapper exits with <result>
      Examples:
        | checkout-state | termination | scheduler-cleanup | checkout-cleanup | result |
        | independently authenticated checkout ownership | is cancelled while guarded state remains authenticated | only that caller's waiter ticket is removed and unrelated scheduler state is unchanged | exact checkout ownership is released | cancellation status 130 with SAFEWORD_TEST_CAPACITY_CANCELLED |
        | independently authenticated checkout ownership | is cancelled while guarded capacity state simultaneously becomes unsafe | unsafe scheduler bytes remain untouched and only independently authenticated caller records are removed | exact checkout ownership is released | cancellation status 130 with SAFEWORD_TEST_CAPACITY_CANCELLED |
        | independently authenticated checkout ownership | fails because guarded capacity state becomes unsafe | unsafe scheduler and waiter bytes remain untouched for explicit recovery | exact checkout ownership is released | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE and `safeword project test-capacity status` |
        | unverifiable checkout ownership | fails because guarded capacity state becomes unsafe | unsafe scheduler and waiter bytes remain untouched for explicit recovery | checkout bytes remain untouched and a second wrapper proves the mutex unavailable | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE and `safeword project test-capacity status` |

    @rejection @wiring @process
    Scenario Outline: Stranded unverifiable ownership has an explicit safe recovery path
      Given restart finds <stranded-record> and <recovery-state>
      When the builder runs status and follows <operator-action>
      Then <recovery-outcome>
      Examples:
        | stranded-record | recovery-state | operator-action | recovery-outcome |
        | the exact dead caller ticket retained after an unsafe capacity wait | the recorded domain and process identity become independently verifiable after the underlying access fault is repaired | the named authenticated retry without editing durable bytes | guarded recovery proves the exact caller absent, removes only its ticket at version N+1, the next wrapper runs its unchanged deterministic invocation once to exit zero, and all descendants exit |
        | a waiter whose recorded domain identity remains unverifiable | external proof is unavailable | the named locate-and-prove-idle procedure | status exits with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE, no bytes or version change, no repository process starts, and output gives the exact terminal operator procedure instead of bypassing the FIFO head |
        | a permanently unverifiable recorded owner | an operator independently proves every recorded wrapper and container absent | the named archive-domain procedure followed by capacity-one initialization | status exits SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE with direct archive guidance, only that authenticated domain's artifacts are archived, one fresh capacity-one state initializes, and the next wrapper runs once to exit zero with no overlap |

    @rejection @process
    Scenario Outline: Checkout mutex crash recovery never overlaps repository code
      Given a real public package-test wrapper dies while its checkout mutex has <owner-state> and the second wrapper uses <fixture>
      When a second real wrapper in the same worktree requests the mutex
      Then <recovery>, observable build and Vitest events never overlap, and <waiter-terminal>
      Examples:
        | owner-state | fixture | recovery | waiter-terminal |
        | queued or reserved ownership with the exact wrapper instance absent | deterministic downstream exit 23 | only that abandoned wrapper ownership is reclaimed | the second wrapper runs its unchanged invocation exactly once, all descendants exit, and the wrapper exits 23 |
        | scheduler ownership active but the checkout record not yet linked to its blocked container when the exact wrapper dies | deterministic downstream exit 23 | recovery proves the blocked container empty before removing either owner record | the second wrapper runs its unchanged invocation exactly once, all descendants exit, and the wrapper exits 23 |
        | active ownership with a live recorded execution container | deterministic blocked fixture | the second wrapper remains blocked for the bounded observation | teardown cancels the second wrapper, removes only its waiter and checkout request, proves no descendant started, and it exits 130 with SAFEWORD_TEST_CAPACITY_CANCELLED while live ownership remains |
        | active ownership with the recorded container proven empty | deterministic downstream exit-143 fixture | ownership is reclaimed before the second wrapper proceeds | the second wrapper runs its unchanged invocation exactly once, accounts for its only descendant, and forwards exit 143 |
        | an ambiguous or unverifiable wrapper or container identity | deterministic fixture that must not start | acquisition fails closed with recovery guidance | the second wrapper exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE and starts no repository process |

  @share-test-capacity.TBU1.R3
  Rule: share-test-capacity.TBU1.R3 — Broad verification drains focused work and runs with exclusive machine capacity without starvation

    Scenario: A head broad request waits for holders to drain and then runs alone
      Given keyed process events show focused owners active and another real wrapper has a broad request at the queue head
      When the focused owners finish
      Then after the focused owners exit zero, its unchanged downstream invocation runs exactly once and exits zero while atomically owning all capacity with no overlapping repository process

    @rejection @wiring @process
    Scenario: A broad request never holds a partial allocation
      Given a real public wrapper reaches the live queue head while only part of shared capacity is free
      When injected process observation records its admission and descendants
      Then it remains a zero-permit waiter and starts no repository process during bounded observation, after which teardown cancels it, removes only its waiter and checkout ownership, and exits 130 with SAFEWORD_TEST_CAPACITY_CANCELLED

  @share-test-capacity.TBU1.R4
  Rule: share-test-capacity.TBU1.R4 — A waiting broad run prevents newer focused runs from continuously overtaking it

    Scenario: Consecutive focused requests batch only before the first broad request
      Given shared capacity is two and keyed monotonic events assign real wrapper requests A, B, C and D consecutive FIFO tickets where A and B are focused, C is broad, and D is focused
      When capacity becomes available in queue order
      Then observable lifetimes for A and B overlap and exit zero, C starts only after both end and runs exclusively to zero, and D starts only after C ends and exits zero

    @rejection @wiring @process
    Scenario: An unverifiable waiter is not skipped to admit newer work
      Given the real platform identity seam cannot verify the queue-head public wrapper
      When a newer focused request could otherwise fit
      Then the newer wrapper starts no repository process, removes only its own waiter ticket and checkout ownership, and exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE and `safeword project test-capacity status`

    Scenario: A verified dead queue-head waiter is pruned before the next FIFO admission
      Given the real platform identity seam proves the exact queue-head wrapper instance absent
      When another public wrapper evaluates the queue under the state guard
      Then it removes only that dead waiter, admits the next live head without reordering later tickets, and that wrapper's unchanged downstream invocation and wrapper exit zero

  @share-test-capacity.TBU1.R5
  Rule: share-test-capacity.TBU1.R5 — Capacity ownership changes atomically and recoverable abandoned ownership is reclaimed without PID-reuse mistakes

    Scenario Outline: Exact owner loss is recovered across every supported execution container
      Given a deterministic injected <platform> container adapter has a real package-test wrapper that is <stage> with its exact <container> identity, contributes no native-platform evidence, and a second real public wrapper with a deterministic zero-exit collaborator waits behind it
      When the first wrapper process dies and the second wrapper triggers <recovery> after every first-container build or test descendant is proven absent
      Then guarded recovery advances the state version exactly once per durable transition, removes only the exact dead owner, admits the waiting wrapper in the immediately following transition, runs its unchanged invocation exactly once to exit zero, and the complete keyed trace accounts for every transition, process and descendant with one empty final owner set
      Examples:
        | platform | stage | container | recovery |
        | Linux | reserved before repository code can run | blocked execution-group leader and out-of-group supervisor | one guarded exact-wrapper transition |
        | Linux | active after container identity is durable | externally supervised process group | the two-observation reclaim-marker protocol |
        | macOS | reserved before repository code can run | blocked execution-group leader and out-of-group supervisor | one guarded exact-wrapper transition |
        | macOS | active after container identity is durable | externally supervised process group | the two-observation reclaim-marker protocol |
        | Windows | reserved before repository code can run | suspended Job Object process | one guarded exact-wrapper transition |
        | Windows | active with the named Job Object still present | kill-on-close Job Object | verified zero active-process count |
        | Windows | active with the named Job Object absent | recorded root and supervisor identities | the two-observation absent-job protocol |

    @wiring @process
    Scenario Outline: Cancellation releases ownership safely at every queue stage
      Given a real public package-test wrapper and process collaborator are <stage>, a following live waiter is queued, and a queued caller is a broad head blocking otherwise free partial capacity
      When the wrapper's POSIX SIGINT or SIGTERM handler or Windows CTRL_C_EVENT or CTRL_BREAK_EVENT handler sets its internal cancellation flag through the deterministic handler seam
      Then <cleanup>, <process-outcome>, the cancelled wrapper exits 130 with SAFEWORD_TEST_CAPACITY_CANCELLED, no unrelated ticket or owner changes, checkout ownership releases when safe, and the next live waiter observes release and completes within one injected bounded-backoff interval
      Examples:
        | stage | cleanup | process-outcome |
        | queued | only its exact waiter ticket is removed | no repository process ever starts for the cancelled command |
        | reserved | the blocked container exits before its reservation is removed | no repository process ever starts for the cancelled command |
        | active | the recorded container is terminated and proven empty before ownership is removed | already-started descendants exit and no new descendant starts after cancellation |

    @rejection
    Scenario Outline: Ambiguous process identity never releases live capacity
      Given an injected POSIX process seam has an active owner with <identity-state> and contributes no native-platform evidence
      When scheduler recovery examines the owner twice under the state guard
      Then it keeps capacity unavailable while the waiting public wrapper removes only its own waiter and checkout ownership and exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status`
      Examples:
        | identity-state |
        | PID reuse within platform precision or a PGID with unverifiable leader identity |
        | an unreadable process creation identity |

    @rejection
    Scenario Outline: Unreadable creation-identity evidence fails closed
      Given a deterministic injected <platform> adapter reads <identity-source> and contributes no native-platform evidence
      When the reading is <failure>
      Then the exact process instance is not reclaimed, no repository process starts, and the caller exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status`
      Examples:
        | platform | identity-source | failure |
        | Linux | boot ID and proc stat start-time ticks | missing |
        | Linux | boot ID and proc stat start-time ticks | malformed |
        | Linux | boot ID and proc stat start-time ticks | permission-denied |
        | Windows | process creation FILETIME for the PID | missing |
        | Windows | process creation FILETIME for the PID | malformed |
        | Windows | process creation FILETIME for the PID | permission-denied |
        | macOS | kernel process start time from `sysctl(KERN_PROC_PID)` | missing |
        | macOS | kernel process start time from `sysctl(KERN_PROC_PID)` | malformed |
        | macOS | kernel process start time from `sysctl(KERN_PROC_PID)` | permission-denied |

    Scenario Outline: Conclusive creation-identity mismatch proves the recorded process absent
      Given a deterministic injected <platform> adapter reads a stable machine identity and a live PID whose creation identity differs from the durable owner record and contributes no native-platform evidence
      When the recorded execution container is also proven empty under its platform recovery contract
      Then only the recorded process instance is treated as absent, guarded recovery reclaims its ownership, and the waiting wrapper runs its unchanged invocation once to exit zero
      Examples:
        | platform |
        | Linux |
        | macOS |
        | Windows |

    @rejection @process
    Scenario Outline: Process identity is one authenticated snapshot or fails closed
      Given a deterministic injected <platform> adapter is held at barriers around its multi-read identity operation and contributes no native-platform evidence
      When <torn-observation> occurs before the snapshot is authenticated
      Then no owner or waiter is reclaimed, no repository process starts, the caller exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE, and the durable owner bytes remain unchanged
      Examples:
        | platform | torn-observation |
        | Linux | boot ID changes between the reads of boot identity and process start ticks |
        | Linux | the process exits and its PID is reused between two process-stat reads |
        | macOS | the process exits and its PID is reused between two kernel process-info reads |
        | Windows | the process handle identifies a different creation FILETIME than the pre-handle PID observation |

    @native-platform @platform-macos @process
    Scenario: Native macOS process identity binds kernel creation time
      Given the real macOS adapter reads a live fixture's microsecond process start time through `sysctl(KERN_PROC_PID)`
      When the recorded fixture exits, its PID is reused with a different kernel start time, and its execution group is proven empty
      Then guarded recovery treats only the recorded process instance as absent, reclaims its ownership, and admits the waiting wrapper without overlapping repository code

    @native-platform @platform-linux @process
    Scenario: Native Linux process identity binds boot and process creation
      Given the real Linux adapter reads the boot ID and `/proc/<pid>/stat` start-time ticks for a live fixture process
      When the recorded fixture exits, its PID is reused with different start-time ticks, and its execution group is proven empty
      Then guarded recovery treats only the recorded process instance as absent, reclaims its ownership, and admits the waiting wrapper without overlapping repository code

    @native-platform @platform-linux @platform-macos @process
    Scenario: Deliberately detached POSIX descendants remain an explicit evidence limitation
      Given the POSIX set command disclosed the detachment limitation before confirmed capacity above one and status repeats it for that domain
      When a self-terminating fixture with a bounded deadline deliberately escapes its recorded POSIX process group and the ordinary group exits
      Then keyed events show capacity returns and one newly admitted repository process overlaps the escaped process only in this explicitly unsupported detachment fixture, status says capacity one alone cannot contain deliberate escape and directs the tool to disable detachment before sharing capacity, and fixture teardown proves both processes exit within the fixture's own deadline

    @native-platform @platform-linux
    Scenario Outline: Linux supervisor loss returns capacity only after group disappearance
      Given real native Linux recovery starts after the recorded wrapper and supervisor instances are proven absent and marks the owner reclaiming without returning capacity while only the monotonic clock is injected
      When a nonzero monotonic recovery interval of at least one scheduler backoff passes to separate the non-atomic OS observations, state remains unchanged, and the second authenticated observation finds <identity-state>
      Then capacity is <capacity-state>, new admissions never observe a free intermediate state, and <observer-result>
      Examples:
        | identity-state | capacity-state | observer-result |
        | the exact supervisor and leader instances absent and the group empty | returned atomically | the observing wrapper is admitted, runs unchanged once, accounts for every descendant, and exits zero |
        | the recorded group leader is exact and live after supervisor loss | held until teardown completes | a recovery supervisor signals every enumerated member only through its stable pidfd, repeats until the group is empty, returns capacity atomically, and admits the observing wrapper to run unchanged once and exit zero |
        | the recorded leader is absent but members remain in its PGID | held fail-closed | the observer exits SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE without signalling the ambiguous group and status names the exact member-identities-to-locate-and-terminate procedure before retry |
        | the group empty and a PID is conclusively rebound to a different creation identity | returned atomically | recovery treats only the recorded instance as absent, never signals the new process, and admits the observing wrapper to run unchanged once and exit zero |
        | either exact identity or group observation unverifiable | held fail-closed | the observer removes only its own waiter and checkout request and exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status` |

    @rejection @native-platform @platform-macos @process
    Scenario: macOS supervisor loss with live group members requires explicit recovery
      Given a real native macOS owner has lost its wrapper and supervisor while an exact recorded process-group member remains live
      When recovery authenticates the member but has no race-free non-parent process handle for signalling it
      Then capacity and checkout ownership remain held, no signal or repository process starts, and status exits SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE with the exact member-identities-to-locate-and-terminate procedure

    @rejection @native-platform @platform-linux @platform-macos @process
    Scenario: POSIX process-group reuse never conflates old and new containers
      Given the recorded group leader instance is proven absent and the same PGID now names a live unrelated group with a verifiably different leader identity
      When native recovery enumerates that group's member creation identities under the state guard
      Then it treats the recorded container as absent only if no member predates the new leader, never signals the new group, and otherwise starts no repository process and exits with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status`

    @rejection @process
    Scenario Outline: POSIX reclaim changes or ambiguous identity never release capacity
      Given an injected POSIX process seam's first absent observation marked an active owner reclaiming and contributes no native-platform evidence
      When the monotonic interval ends with <second-state>
      Then <recovery> and <caller-result>
      Examples:
        | second-state | recovery | caller-result |
        | a reclaim marker owned by an exact recovery process now proven absent | the caller atomically adopts the marker without returning capacity, repeats the first absence observation, waits a fresh interval, and returns capacity only after a second exact absence proof | the caller's unchanged invocation then runs once and exits zero with every descendant accounted for |
        | unrelated waiters register and cancel while the owner record and reclaim marker remain unchanged | the recovery interval continues and returns capacity after the second exact absence proof without starvation | the caller's unchanged invocation then runs once and exits zero with every descendant accounted for |
        | the owner-record revision or reclaim marker changes | the attempt restarts from the current owner record, then a barrier holds that owner live for the bounded assertion | teardown cancels the caller, removes only its waiter and checkout request, proves no caller descendant started, and the caller exits 130 with SAFEWORD_TEST_CAPACITY_CANCELLED while current ownership remains |
        | the exact supervisor instance is live | the marker clears and ownership remains held | the still-blocked caller is cancelled after the bounded assertion and exits 130 with SAFEWORD_TEST_CAPACITY_CANCELLED without starting repository code |
        | a supervisor identity ambiguous at platform precision | the marker clears and ownership remains held | the caller starts no repository process and exits with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status` |
        | the PGID leader identity is unreadable | the marker clears and ownership remains held | the caller starts no repository process and exits with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status` |
        | an unverifiable group or creation identity | recovery fails closed | the caller starts no repository process and exits with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status` |

    Scenario Outline: Wrapper death tears down live descendants before returning active capacity
      Given a deterministic injected <platform> container adapter has an active real package-test wrapper with arbitrary predeclared sentinel status 137 and live contained build or Vitest descendants and contributes no native-platform evidence
      When the wrapper dies and its ownership pipe closes
      Then <container> terminates the descendants, the permit remains held until the container is proven empty, and the keyed trace records wrapper status 137 with no unaccounted descendant
      Examples:
        | platform | container |
        | Linux | the recorded out-of-group supervisor and execution group |
        | macOS | the recorded out-of-group supervisor and execution group |
        | Windows | the recorded kill-on-close Job Object |

    @rejection @native-platform @platform-linux @platform-macos @process
    Scenario Outline: Native POSIX supervisor tears down its real execution group
      Given a real POSIX wrapper has an active supervisor and a contained descendant that <termination-behavior>
      When the wrapper dies and the supervisor observes ownership-pipe loss
      Then <native-outcome>
      Examples:
        | termination-behavior | native-outcome |
        | exits on the graceful request | the group is proven empty, capacity returns, the next wrapper runs once to exit zero, and no descendant remains |
        | ignores the graceful request but exits on bounded forced termination | the group is proven empty after escalation, capacity returns, the next wrapper runs once to exit zero, and no descendant remains |
        | survives both bounded termination stages | both ownership layers remain held, the observer starts no repository process, and exits nonzero with structured recovery guidance |

    @rejection @process @native-platform @platform-windows
    Scenario Outline: Windows Job Object recovery proves emptiness through the real OS seam
      Given a wrapper dies with a recorded random owner-only Job Object and <windows-state>
      When another real wrapper attempts guarded recovery
      Then <windows-outcome> before any new build or Vitest process starts, with every fail-closed row returning SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE and `safeword project test-capacity status`
      Examples:
        | windows-state | windows-outcome |
        | the out-of-job supervisor can reopen a job with live members | it explicitly terminates the job and waits for active-process count zero |
        | an unexpected external handle survives | explicit job termination still empties the job before the controlling handle closes |
        | the job name exists with unexpected ACL or identity | recovery fails closed |
        | reopening is access-denied or emptiness is unverifiable | recovery fails closed |
        | the named job is absent and exact supervisor and root creation times are absent twice | the reclaim marker returns ownership atomically |
        | the job name is reused or a process creation identity is unreadable | recovery fails closed rather than trusting the name or PID |

    @rejection
    Scenario Outline: Invalid scheduler state never authorizes new repository code
      Given persisted scheduler state is <state>
      When a current-protocol wrapper requests admission
      Then admission exits nonzero with SAFEWORD_TEST_CAPACITY_STATE_UNSAFE and `safeword project test-capacity status`, starts no repository process, and does not bypass recorded capacity
      Examples:
        | state |
        | corrupt or unreadable |
        | a newer incompatible schema |
        | owned by another user or group-writable |
        | stored under a permission-unsafe guard or containing directory |
        | reached through a symlink or substituted canonical path |

    @wiring @process @native-platform @platform-linux @platform-macos @platform-windows
    Scenario Outline: Interrupted durable-state commits expose only one complete state
      Given the real filesystem seam interrupts a guarded scheduler-state commit <point>
      When a public current-protocol wrapper reads the durable state
      Then it observes <complete-state> and never admits from a partial transition
      Examples:
        | point | complete-state |
        | before atomic rename | the prior complete state |
        | after atomic replacement and successful platform durability commit | the new complete state |
        | after replacement but before successful platform durability commit | either authenticated complete old or new state, which recovery durably recommits before admission |
        | while an exact state-guard holder dies before mutation | the prior complete state after exact process-instance recovery breaks only the abandoned guard |

    @rejection @wiring @process @native-platform @platform-linux @platform-macos @platform-windows
    Scenario Outline: Persistence failures and abandoned temporary state fail safely
      Given the injected real-filesystem seam makes a guarded state commit encounter <persistence-state>
      When another real wrapper reads scheduler state
      Then <outcome> and no partial state authorizes repository code
      Examples:
        | persistence-state | outcome |
        | temporary-file flush failure | the transition fails closed with the prior durable state authoritative |
        | atomic rename failure | the transition fails closed with the prior durable state authoritative |
        | POSIX parent-directory flush or Windows write-through replacement failure | the durability result is indeterminate and admission fails closed |
        | an abandoned temporary file beside valid state | the valid live state remains authoritative and the validated abandoned file is removed under the guard before admission continues |
        | a permission-unsafe or symlinked temporary file | the transition fails closed without reading or replacing through that path |

    @rejection @process @native-platform @platform-linux @platform-macos @platform-windows
    Scenario Outline: State identity swaps cannot redirect a guarded commit
      Given the owner-only state directory is pinned under the guard
      When <swap>
      Then identity revalidation fails closed, no substituted artifact is read or replaced, and no repository process is admitted
      Examples:
        | swap |
        | a live or temporary file gains an unexpected hard link |
        | an attacker swaps a directory entry after validation but before open |
        | an attacker swaps the temporary file after flush but before rename |
        | the parent directory inode or Windows file ID changes before commit |

    @rejection @wiring @process @native-platform @platform-linux @platform-macos
    Scenario Outline: Every capacity artifact enforces owner-only identity and links
      Given <artifact> has <unsafe-property>
      When a real public status, set, or package-test command opens the capacity domain
      Then it starts no repository process, changes no state, and exits SAFEWORD_TEST_CAPACITY_STATE_UNSAFE with `safeword project test-capacity status`
      Examples:
        | artifact | unsafe-property |
        | containing directory | world-readable permissions |
        | containing directory | group-readable permissions |
        | containing directory | group-writable permissions |
        | containing directory | world-writable permissions |
        | transition guard | another owner or unsafe group/world permissions |
        | transition guard | an unexpected hard-link count |
        | live state | another owner or unsafe group/world permissions |
        | live state | an unexpected hard-link count |
        | temporary state | another owner or unsafe group/world permissions |
        | temporary state | an unexpected hard-link count |
        | checkout mutex | another owner or unsafe group/world permissions |
        | checkout mutex | an unexpected hard-link count |

    @rejection @native-platform @platform-windows @process
    Scenario Outline: Native Windows capacity artifacts reject unsafe identity
      Given a native Windows capacity <artifact> has <unsafe-identity>
      When a real public status, set, or package-test command opens the capacity domain
      Then it starts no repository process, changes no state, and exits SAFEWORD_TEST_CAPACITY_STATE_UNSAFE with `safeword project test-capacity status`
      Examples:
        | artifact | unsafe-identity |
        | state directory or transition guard | an owner DACL mismatch or reparse-point traversal |
        | live state, temporary state, or checkout mutex | an owner DACL mismatch, unexpected link count, or changed Windows file ID |

  @share-test-capacity.TBU1.R6
  Rule: share-test-capacity.TBU1.R6 — One validated shared setting governs every participating new-wrapper session and can conservatively restore today's single-run behavior

    @rejection @wiring @process @surface.safeword-cli
    Scenario Outline: First use creates or recovers one canonical capacity-one protocol state
      Given the canonical capacity domain has <initial-state>
      When <first-use-race>
      Then <initialization-outcome>
      Examples:
        | initial-state | first-use-race | initialization-outcome |
        | no guard, state or temporary artifact | two first public wrappers cross a barrier before initialization | one owner-only guard and one current schema/protocol capacity-one state plus checkout mapping and first durable checkout request commit at version 1, each wrapper releases the state guard before waiting on the one derived checkout mutex, ordinary admission begins at the next version, both wrappers serialize, each unchanged invocation runs once and exits zero, and no alternate domain is created |
        | no prior state and a first initializer terminated after its flushed temporary state but before rename | a second public wrapper starts after the terminated initializer and exact process absence are observed | the first fixture's predeclared status is 137, guarded recovery removes only its authenticated temporary artifact, commits one complete version-1 capacity-one state, and the second invocation runs once to exit zero |
        | a symlinked, foreign-owned, permission-unsafe or malformed pre-existing canonical artifact | a public wrapper attempts initialization | it starts no repository process, changes no artifact, and exits nonzero with SAFEWORD_TEST_CAPACITY_STATE_UNSAFE and `safeword project test-capacity status` |
        | an idle compatible older schema and protocol | two public wrappers race the first migration | exactly one guarded migration commits current schema/protocol at version N+1 with capacity one, both wrappers observe that version, serialize and exit zero, and no partial state is visible |
        | no current state after the recorded legacy mutex is authenticated idle | a barrier lets the first wrapper commit capacity-one state, checkout mapping, and its durable checkout request at version 1, then release the guard before acquiring its checkout mutex while a capacity-two set command obtains the guard before wrapper admission | set exits SAFEWORD_TEST_CAPACITY_BUSY without mutation because the checkout request pins live work, the wrapper registers through ordinary admission at version 2 under capacity one, status names the legacy-to-current boundary, and no untracked legacy idleness is inferred |

    Scenario Outline: An idle scheduler adopts one canonical capacity for every participating session
      Given the current scheduler has no checkout requests, owners, waiters, or reclaiming weight
      When real status commands are barrier-held before and after a valid real capacity command, using `--confirm-current-protocol` exactly when raising above one, commits <old-capacity> to <new-capacity>
      Then both status commands and the capacity command exit zero, independent outputs record one complete old value and version before commit and one complete new value and version after commit, and no partial, mixed, or skipped version
      Examples:
        | old-capacity | new-capacity |
        | 1 | 2 |
        | 2 | 1 |
        | 1 | 8 |
        | 8 | 1 |

    @rejection
    Scenario Outline: Capacity updates and admission serialize as one guarded transition
      Given an idle scheduler has canonical capacity one
      When <race>
      Then <outcome> and every wrapper observes the one committed capacity
      Examples:
        | race | outcome |
        | barriers give `set 2 --confirm-current-protocol` the guard before concurrent `set 3 --confirm-current-protocol` | capacity 2 commits at version N+1, then capacity 3 commits at N+2, and no reader observes a partial or skipped version |
        | barriers register a wrapper before `set 2 --confirm-current-protocol` can commit | capacity remains 1, the wrapper observes 1, and the set command exits SAFEWORD_TEST_CAPACITY_BUSY |
        | each retry races a newly registered wrapper while participating work continues | every attempt exits SAFEWORD_TEST_CAPACITY_BUSY without mutation, and status tells the operator to stop starting runs and retry after the domain is idle without promising bounded completion |

    Scenario: Capacity one preserves the hardened machine-wide serialization baseline
      Given canonical shared capacity is one and real wrappers use real build and test collaborators
      When a barrier holds one repository lifetime active while at least one wrapper from another worktree is observed waiting
      Then exactly one repository lifetime is active, the waiter starts no repository descendant until release, and both unchanged invocations eventually run once and exit zero

    @rejection @process
    Scenario Outline: Capacity-one failure recovery preserves serialization and progress
      Given canonical capacity is one and a real wrapper <failure>
      When another real wrapper requests any package-test run
      Then <recovery> and observable build and Vitest lifetimes never overlap
      Examples:
        | failure | recovery |
        | cancels while waiting | its waiter and checkout ownership are removed before the next wrapper proceeds |
        | dies while reserved | the blocked container and exact ownership are removed before the next wrapper proceeds |
        | dies active with descendants | descendants are terminated and proven absent before the next wrapper proceeds |
        | leaves an ambiguous or unverifiable owner identity | recovery fails closed rather than running unlocked |

    @rejection @process
    Scenario Outline: Global guard ordering prevents deadlock on every terminal path
      Given one other-worktree wrapper holds scheduler capacity while two same-worktree wrappers contend for one checkout mutex, and keyed guard events require every wrapper to acquire checkout ownership before requesting capacity
      When the first wrapper reaches <terminal-path>
      Then <ordering-outcome> and the waiting wrapper reaches an observable result without deadlock
      Examples:
        | terminal-path | ordering-outcome |
        | successful test completion | scheduler capacity releases before checkout ownership |
        | build failure | scheduler capacity releases before checkout ownership |
        | Vitest failure | scheduler capacity releases before checkout ownership |
        | cold bootstrap or checkout-mapping lookup while another wrapper holds that checkout mutex | the caller releases the state guard before waiting on checkout ownership, then reacquires it only after checkout ownership to register scheduler admission |
        | descendant ignores graceful and forced termination through the bounded deadlines | both ownership layers remain fail-closed and the waiter exits with structured recovery guidance |
        | a live exact holder exceeds the bounded monotonic state-guard deadline | the caller never breaks the live guard, starts no repository process, exits SAFEWORD_TEST_CAPACITY_BUSY, and names status for retry guidance |

    @rejection
    Scenario Outline: An unavailable required platform primitive keeps shared capacity at one
      Given the operating system cannot provide <required-primitive>
      When the builder requests shared capacity above one
      Then Safeword starts no repository process, changes no durable state, retains capacity one, and exits nonzero with SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED plus `safeword project test-capacity status`
      Examples:
        | required-primitive |
        | its process-group or Job Object containment contract |
        | its required directory-durability operation |
        | handle-relative state creation and identity pinning |
        | a stable unique checkout filesystem identity |

    @rejection @wiring @process
    Scenario Outline: A missing native helper never bypasses its protocol boundary
      Given <protocol-state> and the packaged native helper is absent or fails its integrity check
      When a real public package-test wrapper requests admission
      Then <helper-outcome>
      Examples:
        | protocol-state | helper-outcome |
        | no current-protocol state exists | the wrapper reports that the helper is unavailable and legacy capacity-one serialization is active, uses only that legacy mutex, runs its unchanged invocation once to exit zero, and creates no current-protocol state |
        | current-protocol capacity-one state already exists | the wrapper does not fall back to the legacy mutex, starts no repository process, and exits SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED with the exact helper repair command |

    @rejection @wiring @process
    Scenario Outline: An enabled scheduler fails closed if its platform proof disappears
      Given canonical capacity is two and <lost-proof>
      When a real public wrapper requests admission
      Then it starts no repository process, leaves capacity and ownership unchanged, and exits nonzero with <code> and `safeword project test-capacity status`
      Examples:
        | lost-proof | code |
        | the containment primitive becomes unavailable | SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED |
        | machine or process creation identity becomes unverifiable | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE |
        | the required directory-durability primitive becomes unavailable | SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED |
        | handle-relative state creation becomes unavailable | SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED |
        | stable unique checkout filesystem identity becomes unavailable | SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED |

    @rejection
    Scenario Outline: Capacity-domain identity loss cannot silently switch admission guards
      Given an initialized scheduler encounters <domain-change>
      When a participating wrapper requests admission
      Then <domain-outcome>
      Examples:
        | domain-change | domain-outcome |
        | its recorded machine or user identity can no longer be verified | Safeword starts no repository process, changes no durable state, and exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status` until the recorded domain is located, proven idle, and explicitly reset |
        | `HOME`, `XDG_CONFIG_HOME`, or `APPDATA` points elsewhere while the OS account API still resolves the recorded canonical root | the wrapper uses the existing domain, runs its unchanged invocation once to exit zero, and creates no alternate scheduler state or checkout mutex |
        | project-local configuration and the process environment request a capacity different from the recorded canonical value | the wrapper ignores both overrides, admits under the recorded capacity, runs its unchanged invocation once to exit zero, and changes no capacity bytes or version |
        | another Linux PID namespace has the same machine ID, user ID and shared account home | each namespace derives a distinct domain, status warns that they must not share one checkout, and neither namespace interprets the other's process identities |

    @native-platform @platform-linux @platform-macos @platform-windows @wiring @process
    Scenario Outline: The public package-test entrypoint exercises every lifecycle through real collaborators
      Given temporary worktrees invoke the real public package-test command with real build and Vitest collaborators
      When the process harness triggers <lifecycle>
      Then keyed process and durable-state events prove <boundary>, exact invocation count, permit weight, FIFO position and terminal result through the real classifier, mutex, scheduler, container, build, and Vitest path
      Examples:
        | lifecycle | boundary |
        | one existing literal test-file argument per invocation | that exact unchanged file reaches Vitest once and completes under a focused permit |
        | a non-cancelled downstream collaborator exits 130 | the wrapper forwards 130 without SAFEWORD_TEST_CAPACITY_CANCELLED and accounts for every descendant |
        | focused and broad contention | two barrier-held focused lifetimes overlap, then one broad invocation runs once and alone after both complete |
        | cancellation while reserved | repository code never starts before durable active ownership |
        | cancellation while active | descendants disappear before capacity and checkout ownership return |
        | wrapper death with active descendants | the supervisor or Job Object tears down the real collaborators before reuse |
        | verified checkout owner death with empty container | exact ownership is reclaimed and the next unchanged invocation runs once without overlap |
        | checkout-owner reuse ambiguous at platform precision | the caller exits with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE and no repository process starts |

    @rejection @surface.safeword-cli
    Scenario Outline: Capacity input accepts only one canonical decimal integer and one confirmation flag
      Given durable capacity state and version are captured byte-for-byte
      When the builder runs `safeword project test-capacity set` with <input>
      Then no repository process starts, the command exits nonzero with SAFEWORD_TEST_CAPACITY_INVALID, names `safeword project test-capacity status` first, and durable bytes and version remain unchanged
      Examples:
        | input |
        | signed value `+2` |
        | signed value `-1` |
        | leading-zero value `02` |
        | whitespace-padded token ` 2 ` |
        | exponent token `2e0` |
        | multi-digit token `99` |
        | lower boundary token `0` |
        | upper boundary token `9` |
        | missing positional value |
        | duplicate positional values `2 3` |
        | `2 --confirm-current-protocol --confirm-current-protocol` |
        | `2 --confirm-current-protocol --confirm-current-protocol=false` |
        | `2 --confirm-current-protocol=true` |
        | `2 --confirm-current-protocol=false` |
        | unknown option after confirmation `2 --confirm-current-protocol --unknown` |
        | extra unsupported option `2 --confirm-current-protocol --format=json` |
        | extra non-option token `2 unexpected` |

    @rejection
    Scenario Outline: Unsafe capacity state changes fail without changing admission state
      Given the scheduler has <state>
      When the builder requests <capacity>, supplying `--confirm-current-protocol` exactly when the token is a valid value above one
      Then the request starts no repository process, exits nonzero with <code>, names `safeword project test-capacity status` as its exact first recovery command, and durable state bytes and version remain unchanged
      Examples:
        | state | capacity | code |
        | capacity 1 with one or more owners | 2 | SAFEWORD_TEST_CAPACITY_BUSY |
        | capacity 1 with one or more waiters | 2 | SAFEWORD_TEST_CAPACITY_BUSY |
        | capacity 8 with one or more owners | 1 | SAFEWORD_TEST_CAPACITY_BUSY |
        | capacity 1 with an authenticated recorded legacy mutex held | 2 | SAFEWORD_TEST_CAPACITY_BUSY |
        | capacity 1 with an owner marked reclaiming | 2 | SAFEWORD_TEST_CAPACITY_BUSY |
        | unavailable or conflicting machine identity | 2 | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE |

    @rejection
    Scenario Outline: Fail-closed errors follow stable precedence and recovery contracts
      Given a public capacity operation encounters <faults>
      When it exits without starting repository code
      Then it returns nonzero with <code> and names `safeword project test-capacity status` as the first recovery command
      Examples:
        | faults | code |
        | malformed or out-of-range input | SAFEWORD_TEST_CAPACITY_INVALID |
        | a checkout request, owner, waiter, or lost update | SAFEWORD_TEST_CAPACITY_BUSY |
        | unsafe permissions, path, schema, or durability | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE |
        | unverifiable process or capacity-domain identity | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE |
        | unavailable platform containment | SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED |
        | malformed input and unsafe capacity state | SAFEWORD_TEST_CAPACITY_INVALID |
        | unsafe capacity state and unverifiable domain identity | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE |
        | unverifiable domain identity and unavailable containment | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE |
        | unavailable containment and an existing owner | SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED |

    @rejection @surface.safeword-cli
    Scenario Outline: Reset input accepts exactly one domain and one idle confirmation
      Given durable capacity state and version are captured byte-for-byte
      When the builder runs `safeword project test-capacity reset` with <input>
      Then no repository process starts, the command exits nonzero with SAFEWORD_TEST_CAPACITY_INVALID, names `safeword project test-capacity status` first, and durable bytes and version remain unchanged
      Examples:
        | input |
        | `--expected-domain D --expected-domain D --confirm-idle` |
        | `--expected-domain D --confirm-idle --confirm-idle` |
        | `--confirm-idle` without `--expected-domain` |
        | `--expected-domain '' --confirm-idle` |
        | `--expected-domain D --confirm-idle=true` |
        | `--expected-domain --confirm-idle` with no domain value |
        | `--expected-domain D --confirm-idle --unknown` |
        | `--expected-domain D --confirm-idle unexpected` |

    @native-platform @platform-linux @platform-macos @platform-windows @wiring @process @surface.safeword-cli
    Scenario Outline: The public capacity command wires configuration protocol status and reset atomically
      Given isolated owner-only capacity state is exercised through the real Safeword CLI
      When the builder runs <public-command>
      Then process output, exit status, and durable state prove <public-outcome>
      Examples:
        | public-command | public-outcome |
        | `safeword project test-capacity set 2 --confirm-current-protocol` while idle | capacity two and the exact current protocol version commit together |
        | `safeword project test-capacity set 1` while idle at capacity two | confirmation is not required, the command exits zero, and capacity one plus the next version commit together |
        | `safeword project test-capacity set 1 --confirm-current-protocol` while idle at capacity two | the optional bare confirmation is accepted, the command exits zero, and capacity one plus the next version commit together |
        | `safeword project test-capacity set 1 --confirm-current-protocol=false` while idle | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |
        | two concurrent valid `set` commands while idle | both commit serially in guard order with consecutive versions and no partial observation |
        | barriers let `set 2` commit before wrapper admission | set exits zero at version N+1 with capacity two, then the wrapper registers under and observes capacity two |
        | barriers let wrapper admission register before `set 2` | wrapper observes capacity one, set exits nonzero with SAFEWORD_TEST_CAPACITY_BUSY, and durable capacity and version remain unchanged |
        | `safeword project test-capacity status` after a process-identity fault in an authenticated domain | the applicable nonzero identity code, authenticated domain ID and canonical location, and the first safe recovery action are reported without mutation |
        | `safeword project test-capacity status` when the domain itself cannot authenticate | the applicable nonzero identity code and direct locate-and-archive procedure are reported without a reset token or mutation |
        | `safeword project test-capacity status` in environments with distinct OS users or Linux PID namespaces | output states that each user or Linux PID namespace has a separate capacity domain and makes no cross-domain checkout-concurrency claim |
        | status followed by `reset --expected-domain <reported-domain> --confirm-idle` after the reported domain is proven idle | the exact domain ID copied verbatim from real status output is accepted and capacity one plus current protocol state commit together |
        | barriers let wrapper admission register immediately before reset obtains the guard | reset exits nonzero with SAFEWORD_TEST_CAPACITY_BUSY, the wrapper owner and version remain intact, and no update is lost |
        | barriers let reset obtain the guard and prove the recorded domain idle before wrapper admission | reset commits capacity one at version N+1, then the wrapper registers against that exact version with no owner lost |
        | `reset --expected-domain D` without `--confirm-idle` as the representative parser rejection | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |
        | `reset --expected-domain OTHER --confirm-idle` for recorded domain D | SAFEWORD_TEST_CAPACITY_INVALID returns, status names D, and durable state/version remain unchanged with no repository process |
        | reset against an incompatible durable schema | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE returns and durable state/version remain unchanged with no repository process |
        | reset while exact domain D has a checkout request, owner, or waiter | SAFEWORD_TEST_CAPACITY_BUSY returns and durable state/version remain unchanged with no repository process |
        | reset while exact domain D has only reclaiming weight | SAFEWORD_TEST_CAPACITY_BUSY returns and durable state/version remain unchanged with no repository process |
        | reset while exact domain D identity is unverifiable | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE returns and durable state/version remain unchanged with no repository process |

    @native-platform @platform-linux @platform-macos @wiring @process @surface.safeword-cli
    Scenario Outline: POSIX public commands disclose the deliberate-detachment limitation honestly
      Given an idle current-protocol scheduler on POSIX starts at capacity one
      When the builder runs <public-command>
      Then <disclosure-contract>
      Examples:
        | public-command | disclosure-contract |
        | `safeword project test-capacity set 2 --confirm-current-protocol` | before the zero exit and capacity-two commit, confirmation output states that deliberately detached descendants are not contained, directs the project to disable detachment, and says capacity one is only an additional participating-wrapper safeguard rather than containment |
        | `safeword project test-capacity status` while capacity is two | the zero-exit output repeats that detached descendants are not contained, directs the project to disable detachment, and never describes the current overlap guarantee as covering escape |
        | `safeword project test-capacity status` while capacity is one | the zero-exit output never claims capacity one contains, repairs, or makes safe a deliberately escaped descendant |
