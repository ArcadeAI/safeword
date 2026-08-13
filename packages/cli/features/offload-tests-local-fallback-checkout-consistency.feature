Feature: Prove local fallback checkout consistency

  @wip @offload-tests.TBU1.R13
  @public-cli @surface.safeword-cli
  Rule: offload-tests.TBU1.R13 — Local fallback identifies its checkout state at both command-invocation boundaries and refuses evidence when those states differ

    Scenario Outline: Matching endpoint fingerprints qualify the raw local result
      Given an independent recorder captures exact HEAD and Git-visible record bytes at both invocation boundaries
      And it computes each reference SHA-256 with every domain tag and length prefix
      And both complete record sets and expected digests are byte-identical
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
