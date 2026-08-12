@wip
Feature: Reconcile managed verification workflows safely

  @offload-tests.TBU1.R8
  Rule: offload-tests.TBU1.R8 — Setup and upgrade preserve customer workflow changes or surface a conflict instead of overwriting them

    @public-cli @surface.safeword-cli
    Scenario: An unchanged managed workflow upgrades transactionally
      Given byte-recorded live workflow, identity and installed configuration exactly match the old installed base and independently recorded bundled bytes define the new identity
      When `safeword setup` reconciles the newer managed workflow while a filesystem recorder observes every write, fsync, rename, unlink and directory fsync
      Then setup exits zero and the recorder shows the required journaled event order
      And all three live members exactly match the new bundled set with no staged or journal artifact
      And a second `safeword setup` exits zero without filesystem mutation

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

    @rejection @public-cli @surface.safeword-cli @proof.pending-vitest
    Scenario: The reconciliation failure manifest covers every production durability site
      Given an independent syscall interceptor enumerates every production write, fsync, rename, unlink and cleanup site
      And a literal failure-class inventory contains EACCES, ENOSPC, EIO, short-write, interruption-before-call and interruption-after-success, with a fixed applicability or impossibility reason for every operation-class cell
      When the harness enumerates production sites and generated applicable fixture IDs without running reconciliation
      Then operation set equality and full operation-by-failure-class set and cardinality equality cover every applicable cell once, assert every impossibility reason, and reject missing, extra, collapsed or skipped cells

    @rejection @public-cli @surface.safeword-cli
    Scenario: Each reconciliation syscall failure recovers from its observed state
      Given the reconciliation failure manifest passed completeness and one labeled cell is selected
      When the harness injects only that cell's failure and then retries without the fault
      Then each isolated result records observable live, staged, and journal bytes without predicting durability
      And restart reaches one complete result for every manifest label without early termination

    @rejection @public-cli @surface.safeword-cli
    Scenario Outline: Reconciliation paths reject hostile objects and replacement races
      Given each workflow, identity, configuration, journal and staged path is independently subjected to <hostile-path-state>
      When the public CLI reconciles while a recorder watches opened object and parent identities
      Then reconciliation follows no link and writes only through verified parent handles
      And it trusts no substituted bytes and performs no unjournaled mutation
      And restart completes the classified durable journal state or reports conflict without further mutation
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
