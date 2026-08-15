@wip @surface.safeword-cli
Feature: Let parallel sessions share test capacity safely

  Background:
    Given process evidence keys every started wrapper, ticket, container, command and descendant with monotonic sequence events
    And every predetermined result is predeclared in its fixture's per-platform signal-disposition table, and every trusted attestation, independently verified identity and empty-container proof is fixed or authenticated before the action and never derived from the outcome under assertion
    And every scenario that opens capacity state uses a test-isolated domain root with deterministic machine and user identity fixtures

  @share-test-capacity.TBU1.R1
  Rule: share-test-capacity.TBU1.R1 — Separate worktrees using the current scheduler protocol may overlap focused file checks only within their shared bounded capacity

    Scenario: Focused checks in separate worktrees fill but never exceed shared capacity
      Given three real current-protocol wrappers in three distinct worktrees hold independent checkout mutexes and share capacity two
      When barriers hold the first two collaborators active before the third requests admission
      Then monotonic ready/release events show the first two repository-process lifetimes overlap, no more than two overlap, and after barriers release all three unchanged downstream invocations run exactly once and exit zero with the third starting only after a permit releases

    @wiring @process
    Scenario: Every focused process lifetime has one durable ownership interval
      Given three deterministic focused wrappers exercise admission, reservation and activation at shared capacity two while a barrier holds the first two active
      When the third wrapper requests admission and the bounded run completes with teardown proving every wrapper and descendant exited
      Then every repository-process lifetime has exactly one preceding atomic durable owner activation and one following atomic release, every owner transition has exactly one keyed wrapper, no unkeyed repository descendant exists, peak active weight is two, and every wrapper exits with its predetermined status

    @rejection @process
    Scenario: Duplicate owner releases do not change durable state
      Given an exact focused owner has released and the guarded durable state bytes and version are captured
      When that owner release is replayed
      Then the durable bytes and version remain unchanged and no repository process starts

    @rejection @process
    Scenario: Reservation failure starts no repository process
      Given an exact focused owner reservation is durable but activation will fail
      When the wrapper handles the activation failure
      Then no repository process starts and only that reservation is removed

    @wiring @process
    Scenario: Capacity eight admits eight focused lifetimes and gives a broad request all eight permits
      Given ten distinct real wrappers in ten distinct worktrees register FIFO tickets for nine focused requests followed by one broad request and share canonical capacity eight
      When barriers hold the first eight focused repository lifetimes active before focused wrapper nine and broad wrapper ten queue
      Then exactly eight focused lifetimes overlap, wrapper nine starts only after one releases, and after all nine focused requests exit zero wrapper ten atomically owns all eight permits, runs once and alone, and exits zero

    @rejection
    Scenario Outline: Broad-shaped invocations never consume a focused permit
      Given <fixture-state>, shared capacity is two with one focused owner active, this broad request at the live queue head with no earlier waiter, and its deterministic downstream collaborator terminates with its predetermined platform-resolved status
      When a worktree requests <invocation>
      Then no repository process for that request starts until the focused owner releases, after which it atomically owns all capacity, passes its original invocation unchanged downstream exactly once, accounts for the one terminated descendant, and exits with that predetermined platform-resolved status
      Examples:
        | fixture-state | invocation |
        | a contained `tests/` directory exists | argv `["tests/"]` |
        | no path fixture is required | empty argv `[]` |
        | no path fixture is required | argv `["--coverage"]` |
        | contained regular `alpha.test.ts` and `vitest.alt.ts` files exist | argv `["alpha.test.ts", "--config", "vitest.alt.ts"]` |
        | a contained regular `alpha.test.ts` file exists | argv `["alpha.test.ts", "--coverage"]` |
        | `missing.test.ts` is absent | argv `["missing.test.ts"]` |
        | `linked.test.ts` is a leaf symlink to a contained regular test file | argv `["linked.test.ts"]` |
        | `linked-dir` is an ancestor symlink to a contained directory with regular `alpha.test.ts` | argv `["linked-dir/alpha.test.ts"]` |
        | a contained regular non-test `src/alpha.ts` file exists | argv `["src/alpha.ts"]` |
        | contained regular `alpha.test.ts` and non-test `src/alpha.ts` files exist | argv `["alpha.test.ts", "src/alpha.ts"]` |
        | a contained regular `alpha.test.ts` file exists | argv `["alpha.test.ts", "--unknown"]` |
        | a contained regular `alpha.test.ts` file exists | argv `["--unknown", "alpha.test.ts"]` |

    @rejection @process
    Scenario: Focused classification rejects a symlinked ancestor that escapes the checkout
      Given a real checkout path crosses a symlinked directory to an external regular test file and the deterministic downstream collaborator exits zero
      When the public package-test command classifies that literal argument
      Then it treats the invocation as broad, passes the original argument unchanged downstream exactly once, never grants a focused permit, accounts for every descendant, and exits zero

    @rejection @process
    Scenario Outline: Literal metacharacter and option-shaped test filenames classify broad
      Given a contained regular file literally named <literal-token> exists inside the checkout and the deterministic downstream collaborator exits zero
      When the public package-test command classifies that exact argv token
      Then it assigns broad exclusive capacity, passes the token unchanged downstream exactly once, accounts for every descendant, and exits zero
      Examples:
        | literal-token |
        | `alpha*.test.ts` |
        | `alpha[1].test.ts` |
        | `-alpha.test.ts` |

    @rejection @process
    Scenario: Double-dash invocation classifies broad despite an existing test file
      Given a contained regular `alpha.test.ts` file exists and the deterministic downstream collaborator exits zero
      When the public package-test command classifies argv `["--", "alpha.test.ts"]`
      Then it assigns broad exclusive capacity, passes the original argv unchanged downstream exactly once, accounts for every descendant, and exits zero

    Scenario Outline: Focused filename boundaries are exact and case-sensitive
      Given canonical capacity is two, fixtures live in per-row directories, the classifier uses the literal argument basename bytes, and <arguments> resolve to existing regular files inside the canonical checkout root with no symlinked component at or below that root and the deterministic downstream collaborator exits zero
      When the public package-test command classifies them after checkout-relative rebasing
      Then it assigns <classification> with durable owner weight <weight>, passes every original argument downstream unchanged exactly once, accounts for every descendant, and the wrapper exits zero
      Examples:
        | arguments | classification | weight |
        | one `alpha.test.js` file | one focused permit | 1 |
        | one `alpha.spec.js` file | one focused permit | 1 |
        | one `alpha.test.jsx` file | one focused permit | 1 |
        | one `alpha.spec.jsx` file | one focused permit | 1 |
        | one `alpha.test.ts` file | one focused permit | 1 |
        | one `alpha.spec.ts` file | one focused permit | 1 |
        | one `alpha.test.tsx` file | one focused permit | 1 |
        | one `alpha.spec.tsx` file | one focused permit | 1 |
        | one `alpha.test.mjs` file | one focused permit | 1 |
        | one `alpha.spec.mjs` file | one focused permit | 1 |
        | one `alpha.test.mts` file | one focused permit | 1 |
        | one `alpha.spec.mts` file | one focused permit | 1 |
        | one `alpha.test.cjs` file | one focused permit | 1 |
        | one `alpha.spec.cjs` file | one focused permit | 1 |
        | one `alpha.test.cts` file | one focused permit | 1 |
        | one `alpha.spec.cts` file | one focused permit | 1 |
        | two valid `.test` and `.spec` files | one focused permit | 1 |
        | one `alpha.Test.ts` file | broad exclusive capacity | 2 |
        | one `alpha.test.TS` file | broad exclusive capacity | 2 |
        | one `alpha.tests.ts` file | broad exclusive capacity | 2 |
        | one `alpha.test.txt` file | broad exclusive capacity | 2 |
        | one `alpha.spec.ts.bak` file | broad exclusive capacity | 2 |
        | an absolute `alpha.test.ts` path canonically inside the checkout | one focused permit | 1 |
        | an `a/../alpha.test.ts` path that normalizes inside the checkout | one focused permit | 1 |
        | a repeated-separator path to `alpha.test.ts` | one focused permit | 1 |
        | a `space name.test.ts` argument passed as one token | one focused permit | 1 |
        | a subdirectory invocation `../other-package/alpha.test.ts` that exists only after checkout-relative rebasing | one focused permit | 1 |
        | an absolute checkout path reached through an operating-system-managed symlinked prefix above the checkout root | one focused permit | 1 |

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
    Scenario Outline: Test-shaped paths that are not regular files classify broad
      Given <path-kind> named `alpha.test.ts` exists inside the canonical checkout root and the deterministic downstream collaborator exits 23
      When the public package-test command classifies that literal argument
      Then it assigns broad exclusive capacity, passes the original argument unchanged downstream exactly once, accounts for every descendant, and the wrapper exits 23
      Examples:
        | path-kind |
        | a directory |
        | a FIFO or other non-regular file |

    @rejection
    Scenario: Current-protocol opt-in does not infer legacy wrapper activity
      Given a legacy package-test wrapper is running and holds the recorded legacy mutex while the current scheduler is idle at durable capacity one
      When the builder runs `safeword project test-capacity set 2 --confirm-current-protocol`
      Then the command exits zero, commits capacity two, and neither observes nor records the legacy wrapper as a scheduler owner

    Scenario: Status warns that legacy wrappers cannot share capacity
      Given the current scheduler is idle at capacity two while a legacy package-test wrapper holds the recorded legacy mutex
      When the builder runs `safeword project test-capacity status`
      Then zero-exit status identifies legacy processes as untracked, reports the same capacity, version, owner and waiter sets as the no-legacy control, omits the legacy holder from owners and waiters, and directs the operator to end every legacy execution, migrate participating worktrees, restore capacity one before any later legacy wrapper is used, and wait for the current scheduler to become idle before handoff

    @rejection
    Scenario Outline: Invalid confirmation or incompatible protocol never raises capacity
      Given canonical capacity is one and the public command requests capacity two
      When the public capacity command receives <confirmation>
      Then capacity, protocol and state version remain unchanged and the command exits nonzero with <code> and first recovery command <recovery>
      Examples:
        | confirmation | code | recovery |
        | argv `test-capacity set 2` without the flag | SAFEWORD_TEST_CAPACITY_INVALID | `safeword project test-capacity status` |
        | argv with `--confirm-current-protocol` while CLI expects protocol 2 and durable state has an incompatible schema with recorded protocol 1 | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE | `safeword project test-capacity status` |

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
        | integer `999999999999999999999999999999999999` beyond the parser's numeric range |
        | no positional capacity value |
        | `--confirm-current-protocol` with no positional capacity value |
        | duplicate positional values `2 3` |
        | `2 --confirm-current-protocol --confirm-current-protocol` |
        | `2 --confirm-current-protocol --confirm-current-protocol=false` |
        | `2 --confirm-current-protocol=true` |
        | `2 --confirm-current-protocol=false` |
        | unknown option after confirmation `2 --confirm-current-protocol --unknown` |
        | extra unsupported option `2 --confirm-current-protocol --format=json` |
        | extra non-option token `2 unexpected` |

  @share-test-capacity.TBU1.R2
  Rule: share-test-capacity.TBU1.R2 — Participating package-test commands in the same worktree remain serialized across their complete build and test lifetimes

    Scenario: Same-worktree commands serialize their complete build and test lifetimes
      Given canonical capacity is two, two real focused package-test wrapper processes target the same worktree, and every process event is keyed to wrapper, ticket, container and command
      When a barrier holds the first repository lifetime active until the second wrapper is observed waiting on the checkout mutex
      Then the second starts no repository descendant before every first-container descendant exits and the first wrapper releases scheduler ownership followed by its exact checkout ownership, after which both unchanged downstream invocations have run exactly once, every container is proven empty, and both wrappers exit zero

    @rejection
    Scenario Outline: A terminated capacity wait does not strand the checkout mutex
      Given an exact public wrapper holds <checkout-state> and a registered waiter ticket while waiting for capacity
      When the wait <termination>
      Then <scheduler-cleanup>, <checkout-cleanup>, no repository process starts, and the wrapper exits with <result>
      Examples:
        | checkout-state | termination | scheduler-cleanup | checkout-cleanup | result |
        | independently authenticated checkout ownership | is cancelled while guarded state remains authenticated | only that caller's waiter ticket is removed and unrelated scheduler state is unchanged | exact checkout ownership is released | its predetermined platform-resolved cancellation status |
        | independently authenticated checkout ownership | fails because guarded capacity state becomes unsafe | unsafe scheduler and waiter bytes remain untouched for explicit recovery | exact checkout ownership is released | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE and `safeword project test-capacity status` |
        | unverifiable checkout ownership | fails because guarded capacity state becomes unsafe | unsafe scheduler and waiter bytes remain untouched for explicit recovery | checkout bytes remain untouched and a second wrapper proves the mutex unavailable | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE and `safeword project test-capacity status` |

    @rejection @wiring @process
    Scenario Outline: Stranded unsafe waiter bytes have an explicit safe recovery path
      Given restart finds the exact dead caller ticket retained after an unsafe capacity wait and <recovery-state>
      When the builder runs status and follows <operator-action>
      Then <recovery-outcome>
      Examples:
        | recovery-state | operator-action | recovery-outcome |
        | the recorded domain and process identity become independently verifiable after the underlying access fault is repaired | the named authenticated retry without editing durable bytes | guarded recovery proves the exact caller absent, removes only its ticket at version N+1, the next wrapper runs its unchanged deterministic invocation once to exit zero, and all descendants exit |
        | the recorded domain identity remains unverifiable | the named locate-and-prove-idle procedure followed by reset only if proof succeeds | status exits with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE, reset also fails with that code while proof is unavailable, no bytes or version change, no repository process starts, and output gives the exact terminal operator procedure instead of bypassing the FIFO head |

    @rejection @process
    Scenario Outline: Checkout mutex crash recovery never overlaps repository code
      Given canonical capacity is two, a real focused public package-test wrapper dies while its checkout mutex has <owner-state>, and the second focused wrapper uses <fixture>
      When a second real wrapper in the same worktree requests the mutex
      Then <recovery>, observable build and Vitest events never overlap, and <waiter-terminal>
      Examples:
        | owner-state | fixture | recovery | waiter-terminal |
        | queued or reserved ownership with the exact wrapper instance absent | deterministic downstream exit 23 | only that abandoned wrapper ownership is reclaimed | the second wrapper runs its unchanged invocation exactly once, all descendants exit, and the wrapper exits 23 |
        | active ownership with a live recorded execution container | deterministic blocked fixture | the second wrapper emits an authenticated checkout-mutex waiter event while the keyed live container remains active | teardown cancels the second wrapper, removes only its waiter and checkout request, proves no descendant started, and it exits with its predetermined platform-resolved cancellation status while live ownership remains |
        | active ownership with the recorded container proven empty | deterministic terminating-descendant fixture | ownership is reclaimed before the second wrapper proceeds | the second wrapper runs its unchanged invocation exactly once, observes its only descendant terminate with the predetermined platform-resolved status, and exits with that status |
        | a reused or unverifiable wrapper or container identity | deterministic fixture that must not start | acquisition fails closed and names `safeword project test-capacity status` as the exact first recovery command | the second wrapper exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE and starts no repository process |

    @rejection @wiring @process
    Scenario: A stranded unsafe checkout mutex has an explicit safe recovery path
      Given an exact dead wrapper left an unsafe checkout-mutex record that a second wrapper cannot authenticate
      When the builder runs `safeword project test-capacity status`
      Then status names the checkout-mutex recovery procedure without mutating its bytes, and after the underlying artifact fault is repaired guarded recovery removes only the exact dead ownership before one waiting wrapper runs its unchanged invocation once

  @share-test-capacity.TBU1.R3
  Rule: share-test-capacity.TBU1.R3 — Broad verification drains focused work and runs with exclusive machine capacity without starvation

    Scenario: A head broad request waits for holders to drain and then runs alone
      Given keyed process events show focused owners active and another real wrapper has a broad request at the queue head
      When the focused owners finish
      Then after the focused owners exit zero, its unchanged downstream invocation runs exactly once and exits zero while atomically owning all capacity with no overlapping repository process

    @rejection @wiring @process
    Scenario: A broad request never holds a partial allocation
      Given a real public wrapper reaches the live queue head while only part of shared capacity is free and emits a keyed zero-permit waiter event
      When the scheduler records that admission decision under the state guard
      Then it starts no repository process before controlled teardown cancels that recorded waiter, removes only its waiter and checkout ownership, and exits with its predetermined platform-resolved cancellation status

  @share-test-capacity.TBU1.R4
  Rule: share-test-capacity.TBU1.R4 — A waiting broad run prevents newer focused runs from continuously overtaking it

    Scenario: Consecutive focused requests batch only before the first broad request
      Given shared capacity is two and keyed monotonic events assign real wrapper requests A, B, C and D consecutive FIFO tickets where A and B are focused, C is broad, and D is focused
      When capacity becomes available in queue order
      Then observable lifetimes for A and B overlap and exit zero, C starts only after both end and runs exclusively to zero, and D starts only after C ends and exits zero

    Scenario: A queued broad request is not starved by later focused arrivals
      Given shared capacity is two, focused holders A and B are active, broad request C is the queue head, and focused requests D through Z register behind C while A and B remain active
      When A and B exit zero
      Then C runs its unchanged invocation once and alone before every later focused request, then D through Z run in FIFO order without overtaking C

    @rejection @wiring @process
    Scenario: An unverifiable waiter is not skipped to admit newer work
      Given the real platform identity seam cannot verify the queue-head public wrapper
      When a newer focused request could otherwise fit
      Then the newer wrapper starts no repository process, removes only its own waiter ticket and checkout ownership, and exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE and `safeword project test-capacity status`

    Scenario: A verified dead queue-head waiter is pruned before the next FIFO admission
      Given shared capacity is one, the real platform identity seam proves dead ticket-1 absent, and live ticket-2 and ticket-3 wrappers wait in that order
      When another public wrapper evaluates the queue under the state guard
      Then it removes only dead ticket 1, admits ticket 2 before ticket 3, and after ticket 2 exits ticket 3 runs its unchanged downstream invocation once and exits zero

  @share-test-capacity.TBU1.R5
  Rule: share-test-capacity.TBU1.R5 — Capacity ownership changes atomically and abandoned ownership is recovered without PID-reuse mistakes or manual cleanup

    @native-platform
    Scenario Outline: Exact owner loss is recovered across every supported execution container
      Given the required native <platform> CI job runs a real package-test wrapper that is <stage> with its exact <container> identity and a second real public wrapper with a deterministic zero-exit collaborator waits behind it
      When the first wrapper process dies and the second wrapper triggers <recovery> after every first-container build or test descendant is proven absent
      Then one guarded recovery removes only the exact dead owner, returns its complete permit weight at version N+1, admits the waiting wrapper at N+2, runs its unchanged invocation exactly once to exit zero, and the complete keyed trace accounts for the dead wrapper, blocked child or supervisor, all descendants and one empty final owner set
      Examples:
        | platform | stage | container | recovery |
        | Linux | reserved before repository code can run | blocked execution-group leader and out-of-group supervisor | one guarded exact-wrapper transition |
        | Linux | active after container identity is durable | externally supervised process group | the two-observation reclaim-marker protocol |
        | macOS | reserved before repository code can run | blocked execution-group leader and out-of-group supervisor | one guarded exact-wrapper transition |
        | macOS | active after container identity is durable | externally supervised process group | the two-observation reclaim-marker protocol |
        | Windows | reserved before repository code can run | suspended Job Object process | one guarded exact-wrapper transition |
        | Windows | active after container identity is durable | kill-on-close Job Object | verified zero active-process count or the two-observation absent-job protocol |

    @wiring @process
    Scenario Outline: Cancellation releases ownership safely at every queue stage
      Given a real public package-test wrapper and process collaborator are <stage>
      When its request is cancelled
      Then <cleanup>, <process-outcome>, no unrelated ticket or owner changes, checkout ownership releases when safe, and the next live waiter completes
      Examples:
        | stage | cleanup | process-outcome |
        | queued | only its exact waiter ticket is removed | no repository process ever starts for the cancelled command |
        | reserved | the blocked container exits before its reservation is removed | no repository process ever starts for the cancelled command |
        | active | the recorded container is terminated and proven empty before ownership is removed | already-started descendants exit and no new descendant starts after cancellation |

    @rejection
    Scenario Outline: Verified occupancy keeps capacity held without treating the caller as a recovery failure
      Given an active POSIX owner has <identity-state>
      When scheduler recovery examines the owner twice under the state guard
      Then it keeps capacity unavailable, records the waiting wrapper behind the verified live owner, and teardown cancels that waiter with its predetermined platform-resolved cancellation status
      Examples:
        | identity-state |
        | a reused PID or PGID |
        | a missing leader with a surviving group member |
        | an apparent same-second macOS PID reuse |

    @native-platform @rejection
    Scenario Outline: Each platform creation-identity adapter fails closed at its real seam
      Given the required native <platform> CI job's real adapter reads <identity-source>
      When the reading is <failure>
      Then the exact process instance is not reclaimed and Safeword reports platform-specific recovery guidance
      Examples:
        | platform | identity-source | failure |
        | Linux | boot ID and proc stat start-time ticks | missing |
        | Linux | boot ID and proc stat start-time ticks | malformed |
        | Linux | boot ID and proc stat start-time ticks | permission-denied |
        | Linux | boot ID and proc stat start-time ticks | changed |
        | Linux | boot ID and proc stat start-time ticks | indicating PID reuse |
        | Windows | process creation FILETIME for the PID | missing |
        | Windows | process creation FILETIME for the PID | malformed |
        | Windows | process creation FILETIME for the PID | permission-denied |
        | Windows | process creation FILETIME for the PID | changed |
        | Windows | process creation FILETIME for the PID | indicating PID reuse |
        | macOS | LC_ALL=C process start time with conservative second-level precision | missing |
        | macOS | LC_ALL=C process start time with conservative second-level precision | malformed |
        | macOS | LC_ALL=C process start time with conservative second-level precision | permission-denied |
        | macOS | LC_ALL=C process start time with conservative second-level precision | changed |
        | macOS | LC_ALL=C process start time with conservative second-level precision | indicating same-second PID reuse |

    @native-platform @rejection @process
    Scenario Outline: Process identity is one authenticated snapshot or fails closed
      Given the required native <platform> adapter is held at barriers around its multi-read identity operation
      When <torn-observation> occurs before the snapshot is authenticated
      Then no owner or waiter is reclaimed, no repository process starts, the caller exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE, and the durable owner bytes remain unchanged
      Examples:
        | platform | torn-observation |
        | Linux | boot ID changes between the reads of boot identity and process start ticks |
        | Linux | the process exits and its PID is reused between two process-stat reads |
        | macOS | the process exits and its PID is reused within the conservative start-time interval |
        | Windows | the process handle identifies a different creation FILETIME than the pre-handle PID observation |

    @rejection @process @surface.safeword-cli
    Scenario Outline: Native platform evidence cannot be replaced by injected adapter coverage
      Given trusted current-commit native-filesystem evidence for every platform is already accepted, deterministic injected-adapter tests run every platform row on any host, and <native-job-state>
      When `safeword project test-capacity verify-native-evidence` verifies trusted CI attestations binding repository, workflow job identity, native runner OS, commit SHA and artifact digest before reading durable JSON keyed by process/container primitive IDs, observed identities and exact command exits
      Then <platform-gate-outcome>, output names every accepted attestation and artifact digest or missing platform, and <terminal-contract>
      Examples:
        | native-job-state | platform-gate-outcome | terminal-contract |
        | Linux, macOS and Windows native jobs all report their matching real seam | native and injected evidence are recorded separately and coverage completes | the command exits zero and emits exactly one completed evidence record for the current commit |
        | the Linux native job is unavailable or skipped | the Linux gate remains incomplete with Linux named and injected results cannot mark it passed | the command exits nonzero with SAFEWORD_TEST_CAPACITY_NATIVE_EVIDENCE_INCOMPLETE, names `safeword project test-capacity status` first, and emits no platform-pass or completed evidence record |
        | the macOS native job is unavailable or skipped | the macOS gate remains incomplete with macOS named and injected results cannot mark it passed | the command exits nonzero with SAFEWORD_TEST_CAPACITY_NATIVE_EVIDENCE_INCOMPLETE, names `safeword project test-capacity status` first, and emits no platform-pass or completed evidence record |
        | the Windows native job is unavailable or skipped | the Windows gate remains incomplete with Windows named and injected results cannot mark it passed | the command exits nonzero with SAFEWORD_TEST_CAPACITY_NATIVE_EVIDENCE_INCOMPLETE, names `safeword project test-capacity status` first, and emits no platform-pass or completed evidence record |

    @rejection @process @surface.safeword-cli
    Scenario Outline: Native filesystem evidence cannot be replaced by injected filesystem seams
      Given trusted current-commit process/container evidence for every platform and filesystem evidence for every other platform are already accepted and the required native <platform> job's <native-state> for owner and permission checks, link and reparse behavior, pinned parent identity, atomic rename, file flush and directory flush
      When deterministic injected tests run and `safeword project test-capacity verify-native-evidence` verifies a trusted CI attestation binding repository, workflow job identity, native runner OS, commit SHA and artifact digest before reading the job's durable JSON keyed by primitive ID, object identity, observed syscall events and exact exit status
      Then <native-gate-outcome>, the command output names the accepted attestation, artifact digest and platform, and <terminal-contract>
      Examples:
        | platform | native-state | native-gate-outcome | terminal-contract |
        | Linux | every success primitive completes and an authenticated unsupported-directory-flush fixture proves runtime fails closed | native and injected evidence are recorded separately and the Linux gate completes | the command exits zero and emits one completed current-commit record |
        | Linux | one named primitive is skipped or unavailable | the Linux gate remains incomplete with that primitive named | the command exits nonzero with SAFEWORD_TEST_CAPACITY_NATIVE_EVIDENCE_INCOMPLETE, names `safeword project test-capacity status` first, and emits neither a Linux-pass nor overall completed record |
        | macOS | every success primitive completes and an authenticated unsupported-directory-flush fixture proves runtime fails closed | native and injected evidence are recorded separately and the macOS gate completes | the command exits zero and emits one completed current-commit record |
        | macOS | one named primitive is skipped or unavailable | the macOS gate remains incomplete with that primitive named | the command exits nonzero with SAFEWORD_TEST_CAPACITY_NATIVE_EVIDENCE_INCOMPLETE, names `safeword project test-capacity status` first, and emits neither a macOS-pass nor overall completed record |
        | Windows | every success primitive completes and an authenticated unsupported-directory-flush fixture proves runtime fails closed | native and injected evidence are recorded separately and the Windows gate completes | the command exits zero and emits one completed current-commit record |
        | Windows | one named primitive is skipped or unavailable | the Windows gate remains incomplete with that primitive named | the command exits nonzero with SAFEWORD_TEST_CAPACITY_NATIVE_EVIDENCE_INCOMPLETE, names `safeword project test-capacity status` first, and emits neither a Windows-pass nor overall completed record |

    @rejection @process @surface.safeword-cli
    Scenario Outline: Native evidence rejects untrusted or mismatched provenance
      Given a durable native-evidence artifact has otherwise valid schema and contents but <provenance-fault>
      When `safeword project test-capacity verify-native-evidence` verifies it for the current repository and commit
      Then the named platform remains incomplete, the artifact is not consumed, existing evidence state remains byte-identical, no affected platform-pass or overall completion record is emitted, and the command exits nonzero with SAFEWORD_TEST_CAPACITY_NATIVE_EVIDENCE_INCOMPLETE naming <stable-reason> and `safeword project test-capacity status` first
      Examples:
        | provenance-fault | stable-reason |
        | has no trusted CI attestation or a forged signature | untrusted attestation |
        | is a replay from an earlier commit | wrong commit SHA |
        | was produced by a different repository or workflow job | wrong producer identity |
        | claims Linux while its attested runner OS is macOS | cross-platform mismatch |
        | has bytes whose digest differs from the attested digest | artifact digest mismatch |
        | has a matching trusted attestation and digest but malformed, truncated, or newer-incompatible durable evidence JSON | incompatible evidence schema |

    @wiring @process @surface.safeword-cli
    Scenario Outline: Repeated native-evidence verification is atomic and idempotent
      Given one trusted current-commit attestation and artifact set satisfies every native platform and primitive exactly once
      When <verification-race>
      Then both commands exit zero with the same accepted digests, durable evidence state contains exactly one platform-pass per platform and one overall completion record for the commit, no artifact is partially consumed, and the state version advances only for the single deduplicated commit
      Examples:
        | verification-race |
        | the verifier runs twice sequentially against the identical evidence set |
        | two verifier processes cross a barrier and contend on the evidence-state guard |

    @rejection @wiring @process @surface.safeword-cli
    Scenario Outline: Overall native evidence waits for both evidence classes on every platform
      Given trusted current-commit evidence is complete except for <missing-class>
      When `safeword project test-capacity verify-native-evidence` evaluates the complete attested set
      Then it exits nonzero with SAFEWORD_TEST_CAPACITY_NATIVE_EVIDENCE_INCOMPLETE, names `safeword project test-capacity status` first plus the missing class and platform, emits no overall completion record, and preserves every already accepted platform-class record unchanged
      Examples:
        | missing-class |
        | Linux process and container evidence |
        | Linux filesystem and durability evidence |
        | macOS process and container evidence |
        | macOS filesystem and durability evidence |
        | Windows process and container evidence |
        | Windows filesystem and durability evidence |

    @rejection @surface.safeword-cli
    Scenario Outline: Native-evidence verification rejects all arguments without consuming evidence
      Given valid durable native-evidence state is captured byte-for-byte
      When the builder runs `safeword project test-capacity verify-native-evidence` with <argument>
      Then it exits nonzero with SAFEWORD_TEST_CAPACITY_INVALID, names `safeword project test-capacity status` first, and durable evidence state remains unchanged
      Examples:
        | argument |
        | unknown option `--unknown` |
        | extra positional `unexpected` |
        | duplicate unknown option `--unknown --unknown` |

    @rejection
    Scenario: POSIX capacity commands disclose detached-descendant limits
      Given capacity is above one on POSIX
      When the builder reads test-capacity status
      Then status says deliberately detached descendants are not contained and directs the project to disable detachment before sharing capacity

    @process
    Scenario: Detached POSIX descendants remain an explicit unsupported fixture
      Given repository code deliberately escapes its recorded POSIX process group, a barrier holds that escaped process active after the ordinary group exits, and teardown retains its exact external process identity
      When the scheduler admits one new repository process
      Then keyed events show the newly admitted process overlaps the escaped process, the barrier releases it, and external-identity teardown proves both processes exit

    Scenario: Supervisor loss returns capacity only after a second empty-group observation
      Given an injected monotonic clock and a first guarded observation prove the recorded supervisor instance, group-leader instance, and process group absent and mark the owner reclaiming without returning capacity at the current state version and reclaim marker
      When the injected monotonic recovery interval passes with that guarded state version and reclaim marker unchanged, and the second observation proves the exact supervisor and leader instances absent and the group empty
      Then one guarded recovery returns capacity atomically at version N+1, admits the queued waiter at N+2, runs its unchanged invocation once to exit zero, and no admission observes a free intermediate state

    @rejection
    Scenario Outline: Supervisor loss holds capacity when the second observation remains unsafe
      Given an injected monotonic clock and a first guarded observation prove the recorded supervisor instance, group-leader instance, and process group absent and mark the owner reclaiming without returning capacity at the current state version and reclaim marker
      When the injected monotonic recovery interval passes with that guarded state version and reclaim marker unchanged, and the second observation finds <identity-state>
      Then capacity remains held fail-closed, new admissions never observe a free intermediate state, and the observed waiter remains queued behind the recorded owner until controlled teardown cancels it, removes only its own waiter and checkout request, and exits with its predetermined platform-resolved cancellation status
      Examples:
        | identity-state |
        | the group empty but the supervisor live |
        | the group empty but the leader PID reused |
        | a surviving group descendant |

    @rejection @process
    Scenario Outline: POSIX reclaim changes or ambiguous identity never release capacity
      Given the injected real-platform process seam's first absent observation marked an active POSIX owner reclaiming
      When the monotonic interval ends with <second-state>
      Then <recovery> and <caller-result>
      Examples:
        | second-state | recovery | caller-result |
        | a changed scheduler state version or reclaim marker | the current owner emits an authenticated live-owner event before the caller's queued-waiter event | controlled teardown cancels the caller, removes only its waiter and checkout request, proves no caller descendant started, and the caller exits with its predetermined platform-resolved cancellation status while current ownership remains |
        | a live or reused supervisor identity | the marker clears and ownership remains held behind an authenticated live-owner event | controlled teardown cancels the queued caller without a repository descendant and it exits with its predetermined platform-resolved cancellation status |
        | the PGID led by a different process incarnation | the marker clears and ownership remains held behind an authenticated live-owner event | controlled teardown cancels the queued caller without a repository descendant and it exits with its predetermined platform-resolved cancellation status |
        | an unverifiable group or creation identity | recovery fails closed | the caller starts no repository process and exits with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status` |

    @native-platform
    Scenario Outline: Wrapper death tears down live descendants before returning active capacity
      Given an active real package-test wrapper on <platform> has live contained build or Vitest descendants
      When the wrapper dies and its ownership pipe closes
      Then <container> terminates the descendants and the permit remains held until the container is proven empty
      Examples:
        | platform | container |
        | Linux | the recorded out-of-group supervisor and execution group |
        | macOS | the recorded out-of-group supervisor and execution group |
        | Windows | the recorded kill-on-close Job Object |

    @rejection @process
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
        | a PID or job name is reused | recovery fails closed rather than trusting the name or PID |

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

    @wiring @process
    Scenario Outline: Interrupted durable-state commits expose only one complete state
      Given the real filesystem seam interrupts a guarded scheduler-state commit <point>
      When a public current-protocol wrapper reads the durable state
      Then it observes <complete-state> and never admits from a partial transition
      Examples:
        | point | complete-state |
        | before atomic rename | the prior complete state |
        | after atomic rename and successful parent-directory flush | the new complete state |
        | after rename but before successful directory flush | journaled indeterminate state that admits nothing until guarded recovery re-flushes and resolves one complete side |

    @rejection @wiring @process
    Scenario Outline: A journal is durably published before any live-state replacement
      Given a subprocess performs a guarded transition through an interposed real-filesystem barrier that emits only after the named underlying write, rename or flush syscall returns with its recorded result at <journal-boundary>, and is killed only while that exact syscall boundary remains held
      When restart observes <observed-state> before admission
      Then <journal-durability-outcome>
      Examples:
        | journal-boundary | observed-state | journal-durability-outcome |
        | during journal temporary write | old live state, no journal, incomplete temporary bytes | temporary bytes are removed, old state remains byte-identical, and admission retries from old state |
        | after journal-file fsync but before journal rename | old live state, no journal, complete temporary journal | temporary bytes are removed, old state remains byte-identical, and admission retries from old state |
        | after journal rename but before successful parent-directory fsync | old live state and no journal after restart | restart authenticates the old state and retries it without inferring an unobservable transition |
        | after journal rename but before successful parent-directory fsync | old live state and a complete visible journal after restart | old-side recovery re-flushes the directory, retains old state, removes journal last, and admission proceeds |
        | after successful journal parent-directory fsync but before live rename | durable journal plus old live state | old-side recovery retains old state, removes journal last, and admission proceeds |
        | after live rename but before live-state parent-directory fsync | durable journal plus old live state after restart | old-side recovery retains old state, removes journal last, and admission proceeds |
        | after live rename but before live-state parent-directory fsync | durable journal plus new live state after restart | new-side recovery flushes and verifies new state, removes journal last, and admission proceeds under new state |

    @rejection @wiring @process
    Scenario Outline: Journal recovery resolves only an authenticated complete side
      Given restart finds <journal-state>
      When the public package-test wrapper requests admission through guarded recovery
      Then <journal-outcome> before any repository process starts
      Examples:
        | journal-state | journal-outcome |
        | a valid journal whose live state matches the old hash | the old state is retained, its directory is re-flushed, and the journal is removed last |
        | a valid journal whose live state matches the new hash | the directory is re-flushed, the new state is completed, and the journal is removed last |
        | a valid journal whose live state matches neither hash | admission exits with SAFEWORD_TEST_CAPACITY_STATE_UNSAFE and the journal and live state remain untouched |
        | a corrupt or permission-unsafe journal | admission exits with SAFEWORD_TEST_CAPACITY_STATE_UNSAFE and state remains untouched |
        | journal write or flush failure before live replacement | the prior durable state remains authoritative and admission exits fail-closed |
        | journal removal failure after successful recovery | admission remains fail-closed until the journal can be revalidated and removed |

    @rejection @wiring @process
    Scenario Outline: Every journal and rollback flush failure remains fail closed
      Given the interposed real-filesystem barrier returns <flush-failure> for a guarded transition or recovery
      When a public wrapper attempts admission and bounded teardown proves it and every descendant exited
      Then admission exits nonzero with SAFEWORD_TEST_CAPACITY_STATE_UNSAFE, starts no repository process, and <durable-outcome>
      Examples:
        | flush-failure | durable-outcome |
        | journal parent-directory flush failure | the prior live state remains authoritative and any visible journal is retained for authenticated recovery |
        | live-state parent-directory flush failure | the journal is retained and neither side authorizes admission until recovery resolves it |
        | rollback live-state parent-directory flush failure | the journal and current complete live side are retained without authorizing admission |
        | journal-removal parent-directory flush failure | the recovered live side and journal are retained and revalidated on the next attempt |

    @rejection @wiring @process
    Scenario Outline: Persistence failures and abandoned temporary state fail safely
      Given the injected real-filesystem seam makes a guarded state commit encounter <persistence-state>
      When another real wrapper reads scheduler state
      Then <outcome> and no partial state authorizes repository code
      Examples:
        | persistence-state | outcome |
        | temporary-file flush failure | the transition fails closed with the prior durable state authoritative |
        | atomic rename failure | the transition fails closed with the prior durable state authoritative |
        | containing-directory flush failure on a supporting platform | the durability result is indeterminate and admission fails closed |
        | an abandoned temporary file beside valid state | the valid live state remains authoritative and the validated abandoned file is removed under the guard before admission continues |
        | a permission-unsafe or symlinked temporary file | the transition fails closed without reading or replacing through that path |

    @rejection @process
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

    @rejection @wiring @process
    Scenario Outline: Every capacity artifact enforces owner-only identity and links
      Given <artifact> has <unsafe-property>
      When a real public set or package-test command opens the capacity domain
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
        | transaction journal | another owner or unsafe group/world permissions |
        | transaction journal | an unexpected hard-link count |
        | temporary state | another owner or unsafe group/world permissions |
        | temporary state | an unexpected hard-link count |

    @rejection @wiring @surface.safeword-cli
    Scenario Outline: Status reports a concrete repair for unsafe capacity artifacts
      Given <artifact> has <unsafe-property>
      When a real public status command opens the capacity domain
      Then it changes no state, reports the canonical domain and state location plus <repair>, and exits nonzero with SAFEWORD_TEST_CAPACITY_STATE_UNSAFE
      Examples:
        | artifact | unsafe-property | repair |
        | live state | another owner or unsafe group/world permissions | owner-only-permissions repair for the named live state followed by `safeword project test-capacity status` |
        | transaction journal | an unexpected hard-link count | hard-link remediation for the named journal followed by `safeword project test-capacity status` |
        | containing directory | world-writable permissions | owner-only-directory-permissions repair for the named capacity directory followed by `safeword project test-capacity status` |
        | transition guard | an unexpected hard-link count | hard-link remediation for the named transition guard followed by `safeword project test-capacity status` |
        | temporary state | another owner or unsafe group/world permissions | owner-only-permissions repair for the named temporary state followed by `safeword project test-capacity status` |

  @share-test-capacity.TBU1.R6
  Rule: share-test-capacity.TBU1.R6 — One validated shared setting governs every participating new-wrapper session and can conservatively restore today's single-run behavior

    @rejection @wiring @process @surface.safeword-cli
    Scenario Outline: First use creates or recovers one canonical capacity-one protocol state
      Given the canonical capacity domain has <initial-state>
      When <first-use-race>
      Then <initialization-outcome>
      Examples:
        | initial-state | first-use-race | initialization-outcome |
        | no guard, state, journal or temporary artifact | two first public wrappers cross a barrier before initialization | one owner-only guard and one current schema/protocol capacity-one state commit at version 1, both wrappers serialize, run unchanged once and exit zero, and no alternate domain is created |
        | no prior state and a first initializer terminated after its flushed temporary state but before rename | a second public wrapper starts after the terminated initializer and exact process absence are observed | the terminated wrapper exits with its predetermined platform-resolved termination status, guarded recovery removes only its authenticated temporary artifact, commits one complete version-1 capacity-one state, and the second invocation runs once to exit zero |
        | a symlinked, foreign-owned, permission-unsafe or malformed pre-existing canonical artifact | a public wrapper attempts initialization | it starts no repository process, changes no artifact, and exits nonzero with SAFEWORD_TEST_CAPACITY_STATE_UNSAFE and `safeword project test-capacity status` |
        | an idle compatible older schema and protocol | two public wrappers race the first migration | exactly one guarded migration commits current schema/protocol at version N+1 with capacity one, both wrappers observe that version, serialize and exit zero, and no partial state is visible |
        | a compatible older schema and protocol with a recorded owner or waiter | a public wrapper attempts migration | no migration commits, bytes and version remain unchanged, no repository process starts, and the wrapper exits nonzero with SAFEWORD_TEST_CAPACITY_BUSY and `safeword project test-capacity status` |
        | no current state after the recorded legacy mutex is authenticated idle | a barrier keeps the first current wrapper's transition guard held through capacity-one initialization and registration while a capacity-two set command waits | one guarded transition commits current protocol capacity one at version 1 and registers the wrapper before releasing the set command, set exits SAFEWORD_TEST_CAPACITY_BUSY, status names the legacy-to-current boundary, and no untracked legacy idleness is inferred |

    Scenario Outline: An idle scheduler adopts one canonical capacity for every participating session
      Given the current scheduler has no owners or waiters
      When real status commands are barrier-held before and after the real capacity command <set-command> commits <old-capacity> to <new-capacity>
      Then both status commands and the capacity command exit zero, independent outputs record one complete old value and version before commit and one complete new value and version after commit, and no partial, mixed, or skipped version
      Examples:
        | old-capacity | new-capacity | set-command |
        | 1 | 2 | `safeword project test-capacity set 2 --confirm-current-protocol` |
        | 2 | 1 | `safeword project test-capacity set 1` |
        | 1 | 8 | `safeword project test-capacity set 8 --confirm-current-protocol` |
        | 8 | 1 | `safeword project test-capacity set 1` |

    @rejection @process
    Scenario: Project-local configuration and process environment cannot override canonical capacity
      Given the isolated canonical domain has durable capacity one while a project-local configuration and each wrapper environment claim capacity eight
      When two real focused wrappers in distinct worktrees request admission together
      Then exactly one repository lifetime runs, the waiting wrapper starts only after release, and neither override changes the durable canonical capacity

    @process
    Scenario Outline: Distinct identity axes own separate capacity domains
      Given two isolated domains differ only in their deterministic <identity-axis> and each durable domain has capacity one
      When one real focused wrapper in each domain is held active
      Then both repository lifetimes overlap, and each domain records only its own owner, waiter, capacity, and state version
      Examples:
        | identity-axis |
        | OS user ID or SID |
        | machine identity |

    @rejection
    Scenario Outline: Capacity updates and admission serialize as one guarded transition
      Given an idle scheduler has canonical capacity one
      When <race>
      Then <outcome> and every wrapper observes the one committed capacity
      Examples:
        | race | outcome |
        | barriers give the capacity-2 command the guard before a concurrent capacity-3 command | capacity 2 commits at version N+1, then capacity 3 commits at N+2, and no reader observes a partial or skipped version |
        | barriers register a wrapper before a capacity-2 command can commit | capacity remains 1, the wrapper observes 1, and the set command exits SAFEWORD_TEST_CAPACITY_BUSY |

    @rejection
    Scenario: A reclaiming owner blocks a capacity update
      Given canonical capacity is two and an owner is marked reclaiming between its first and second absence observations
      When the builder runs `safeword project test-capacity set 1`
      Then the command exits nonzero with SAFEWORD_TEST_CAPACITY_BUSY, names `safeword project test-capacity status` first, and durable state bytes and version remain unchanged

    Scenario: Capacity one preserves the hardened machine-wide serialization baseline
      Given canonical shared capacity is one and real wrappers use real build and test collaborators
      When a barrier holds one repository lifetime active while at least one wrapper from another worktree is observed waiting
      Then exactly one repository lifetime is active, the waiter starts no repository descendant until release, and both unchanged invocations eventually run once and exit zero

    @wiring @surface.safeword-cli
    Scenario: Status describes a healthy busy capacity domain
      Given a healthy canonical domain has capacity two, version N, one authenticated active owner, and one FIFO waiter
      When the builder runs `safeword project test-capacity status`
      Then status exits zero and names the exact domain token, capacity two, version N, the owner and waiter identities, plus waiting for those records to drain before changing capacity

    @rejection @process
    Scenario: A held legacy mutex remains an explicit unsupported mixed-version boundary
      Given canonical capacity is one, a legacy package-test wrapper holds the recorded legacy mutex, and a current-protocol wrapper has an independent scheduler permit
      When barriers hold both repository lifetimes active
      Then keyed events prove the lifetimes can overlap without either wrapper observing or recording the other, and status directs the operator to end legacy work before mixing wrapper protocols

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
        | leaves a reused or unverifiable owner identity | recovery fails closed rather than running unlocked |

    @rejection @process
    Scenario Outline: Global guard ordering prevents deadlock on every terminal path
      Given two real worktrees contend while each wrapper acquires checkout ownership before scheduler capacity
      When the first wrapper reaches <terminal-path>
      Then <ordering-outcome> and the waiting wrapper reaches an observable result without deadlock
      Examples:
        | terminal-path | ordering-outcome |
        | successful test completion | scheduler capacity releases before checkout ownership |
        | build failure | scheduler capacity releases before checkout ownership |
        | Vitest failure | scheduler capacity releases before checkout ownership |
        | descendant teardown failure | both ownership layers remain fail-closed and the waiter exits with structured recovery guidance |

    @rejection
    Scenario: An unavailable platform containment primitive keeps shared capacity at one
      Given the operating system cannot prove its required process-group or Job Object contract
      When the builder requests shared capacity above one
      Then Safeword starts no repository process, changes no durable state, retains capacity one, and exits nonzero with SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED plus `safeword project test-capacity status`

    @rejection @wiring @process
    Scenario Outline: An enabled scheduler fails closed if its platform proof disappears
      Given canonical capacity is two and <lost-proof>
      When a real public wrapper requests admission
      Then it starts no repository process, leaves capacity and ownership unchanged, and exits nonzero with <code> and `safeword project test-capacity status`
      Examples:
        | lost-proof | code |
        | the containment primitive becomes unavailable | SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED |
        | machine or process creation identity becomes unverifiable | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE |

    @rejection
    Scenario: Capacity-domain identity loss cannot silently switch admission guards
      Given an initialized scheduler can no longer verify its recorded machine or user identity
      When a participating wrapper requests admission
      Then Safeword starts no repository process, changes no durable state, and exits nonzero with SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE plus `safeword project test-capacity status` until the recorded domain is located, proven idle, and explicitly reset

    @wiring @process
    Scenario: Public focused invocations reach Vitest once with one permit each
      Given canonical capacity is two and two temporary worktrees each invoke the real public package-test command with one existing literal test file
      When both focused wrappers are admitted and barriers hold their repository lifetimes active
      Then each unchanged file reaches Vitest exactly once under its own durable weight-one permit, both lifetimes overlap, and both wrappers exit zero

    Scenario: Public broad invocations reach Vitest unchanged under exclusive capacity
      Given a temporary worktree invokes the real public package-test command with a directory argument while one focused permit is active
      When the focused owner releases
      Then the unchanged directory argument reaches Vitest exactly once under all capacity and the broad wrapper exits zero

    Scenario: Public contention drains focused work before one broad invocation
      Given two real focused public wrappers are held active and a real broad public wrapper waits behind them
      When both focused wrappers exit zero
      Then the broad invocation runs exactly once and alone after both focused lifetimes end

    Scenario: Public active cancellation returns capacity only after descendants exit
      Given a real public wrapper has active contained build or Vitest descendants and another wrapper waits
      When the active wrapper is cancelled
      Then every active descendant exits before its capacity and checkout ownership return and the waiting wrapper starts only afterwards

    @rejection
    Scenario Outline: Unsafe capacity state changes fail without changing admission state
      Given the scheduler has <state>
      When the builder requests <capacity>
      Then the request starts no repository process, exits nonzero with <code>, names `safeword project test-capacity status` as its exact first recovery command, and durable state bytes and version remain unchanged
      Examples:
        | state | capacity | code |
        | capacity 1 with one or more owners | 2 | SAFEWORD_TEST_CAPACITY_BUSY |
        | capacity 1 with one or more waiters | 2 | SAFEWORD_TEST_CAPACITY_BUSY |
        | capacity 2 with one or more owners | 1 | SAFEWORD_TEST_CAPACITY_BUSY |
        | capacity 2 with one or more waiters | 1 | SAFEWORD_TEST_CAPACITY_BUSY |
        | capacity 2 with an owner marked reclaiming between first and second absence observations | 1 | SAFEWORD_TEST_CAPACITY_BUSY |
        | idle | 0 | SAFEWORD_TEST_CAPACITY_INVALID |
        | idle | 9 | SAFEWORD_TEST_CAPACITY_INVALID |
        | idle | 1.5 | SAFEWORD_TEST_CAPACITY_INVALID |
        | idle | blank input | SAFEWORD_TEST_CAPACITY_INVALID |
        | idle | malformed | SAFEWORD_TEST_CAPACITY_INVALID |
        | unavailable or conflicting machine identity | 2 | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE |

    @rejection
    Scenario Outline: Non-status fail-closed errors expose stable recovery contracts
      Given a non-status public capacity operation encounters <fault>
      When it exits without starting repository code
      Then it returns nonzero with <code> and names `safeword project test-capacity status` as the first recovery command
      Examples:
        | fault | code |
        | malformed or out-of-range input | SAFEWORD_TEST_CAPACITY_INVALID |
        | an owner, waiter, or lost update | SAFEWORD_TEST_CAPACITY_BUSY |
        | unsafe permissions, path, schema, or durability | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE |
        | unverifiable process or capacity-domain identity | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE |
        | unavailable platform containment | SAFEWORD_TEST_CAPACITY_PLATFORM_UNSUPPORTED |
        | incomplete native platform evidence | SAFEWORD_TEST_CAPACITY_NATIVE_EVIDENCE_INCOMPLETE |

    @wiring @process @surface.safeword-cli
    Scenario Outline: Public set commands wire canonical capacity atomically
      Given isolated owner-only capacity state is <precondition>
      When the builder runs <public-command>
      Then process output, exit status, and durable state prove <public-outcome>
      Examples:
        | precondition | public-command | public-outcome |
        | idle at capacity one | `safeword project test-capacity set 2 --confirm-current-protocol` | capacity two and the exact current protocol version commit together |
        | idle at capacity two | `safeword project test-capacity set 1` | confirmation is not required, the command exits zero, and capacity one plus the next version commit together |
        | idle at capacity two | `safeword project test-capacity set 1 --confirm-current-protocol` | the optional bare confirmation is accepted, the command exits zero, and capacity one plus the next version commit together |

    @wiring @process @surface.safeword-cli
    Scenario Outline: Reset validates an explicitly prepared capacity domain
      Given isolated owner-only capacity state is <precondition>
      When the builder runs <public-command>
      Then process output, exit status, and durable state prove <public-outcome>
      Examples:
        | precondition | public-command | public-outcome |
        | exact domain D is proven idle | `safeword project test-capacity reset --expected-domain D --confirm-idle` | capacity one and current protocol state commit together |
        | recorded exact domain is D | `safeword project test-capacity reset --expected-domain D` | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |
        | recorded exact domain is D | `safeword project test-capacity reset --confirm-idle` | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |
        | recorded exact domain is D | `safeword project test-capacity reset` | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |
        | recorded exact domain is D | `safeword project test-capacity reset --expected-domain OTHER --confirm-idle` | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE returns and durable state/version remain unchanged with no repository process |
        | an incompatible durable schema | `safeword project test-capacity reset --expected-domain D --confirm-idle` | SAFEWORD_TEST_CAPACITY_STATE_UNSAFE returns and durable state/version remain unchanged with no repository process |
        | exact domain D has an owner or waiter | `safeword project test-capacity reset --expected-domain D --confirm-idle` | SAFEWORD_TEST_CAPACITY_BUSY returns and durable state/version remain unchanged with no repository process |
        | exact domain D has an owner marked reclaiming between first and second absence observations | `safeword project test-capacity reset --expected-domain D --confirm-idle` | SAFEWORD_TEST_CAPACITY_BUSY returns and durable state/version remain unchanged with no repository process |
        | exact domain D identity is unverifiable | `safeword project test-capacity reset --expected-domain D --confirm-idle` | SAFEWORD_TEST_CAPACITY_IDENTITY_UNVERIFIABLE returns and durable state/version remain unchanged with no repository process |
        | recorded exact domain is D | `safeword project test-capacity reset --expected-domain D --expected-domain D --confirm-idle` | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |
        | recorded exact domain is D | `safeword project test-capacity reset --expected-domain D --confirm-idle --confirm-idle` | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |
        | recorded exact domain is D | `safeword project test-capacity reset --expected-domain --confirm-idle` | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |
        | recorded exact domain is D | `safeword project test-capacity reset --expected-domain D --confirm-idle --unknown` | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |
        | recorded exact domain is D | `safeword project test-capacity reset --expected-domain D --confirm-idle unexpected` | SAFEWORD_TEST_CAPACITY_INVALID returns and durable state/version remain unchanged with no repository process |

    @wiring @process @surface.safeword-cli
    Scenario Outline: Reset serializes with admission under the shared guard
      Given isolated owner-only capacity state is <precondition>
      When <race>
      Then <public-outcome>
      Examples:
        | precondition | race | public-outcome |
        | idle at capacity two | barriers let wrapper admission register immediately before reset obtains the guard | reset exits nonzero with SAFEWORD_TEST_CAPACITY_BUSY, the wrapper owner and version remain intact, and no update is lost |
        | idle at capacity two | barriers let reset obtain the guard and prove the recorded domain idle before wrapper admission | reset commits capacity one at version N+1, then the wrapper registers against that exact version with no owner lost |

    @rejection @surface.safeword-cli
    Scenario Outline: Public capacity status and dispatch reject unsupported arguments
      Given durable capacity state and version are captured byte-for-byte
      When the builder runs <public-command>
      Then no repository process starts, the command exits nonzero with SAFEWORD_TEST_CAPACITY_INVALID, and durable bytes and version remain unchanged
      Examples:
        | public-command |
        | `safeword project test-capacity status --unknown` |
        | `safeword project test-capacity status unexpected` |
        | `safeword project test-capacity status --format=json` |
        | `safeword project test-capacity` |
        | `safeword project test-capacity unknown` |

    @wiring @surface.safeword-cli
    Scenario: Status domain identifier is accepted verbatim by reset
      Given a real status command has emitted exact domain token D for an isolated idle domain at capacity two
      When the builder passes that exact emitted token to `safeword project test-capacity reset --expected-domain D --confirm-idle`
      Then reset exits zero and commits capacity one with current protocol state for that same domain

    @wiring @process @surface.safeword-cli
    Scenario Outline: POSIX public commands disclose the deliberate-detachment limitation honestly
      Given an idle current-protocol scheduler on POSIX starts at capacity one
      When the builder runs <public-command>
      Then <disclosure-contract>
      Examples:
        | public-command | disclosure-contract |
        | `safeword project test-capacity set 2 --confirm-current-protocol` | before the zero exit and capacity-two commit, confirmation output states that deliberately detached descendants are not contained, directs the project to disable detachment, and says capacity one is only an additional participating-wrapper safeguard rather than containment |
        | `safeword project test-capacity status` while capacity is two | the zero-exit output repeats that detached descendants are not contained, directs the project to disable detachment, and states the overlap guarantee applies only to participating wrappers |
        | `safeword project test-capacity status` while capacity is one | the zero-exit output states deliberate escape remains unsupported, directs the project to disable detachment before sharing capacity, and states capacity one adds no containment |
