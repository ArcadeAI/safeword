@wip @surface.safeword-cli @surface.claude-code @surface.openai-codex
Feature: Keep reviews focused on authored changes

  Independent review preserves its bounded packet while treating explicitly
  declared generated output as visible reduced scope rather than a reason to
  abandon every eligible authored input.

  @focused-review.TBU1.R1
  Rule: focused-review.TBU1.R1 — An explicitly generated oversized target is excluded only from the reviewer packet and remains visible in the result

    Scenario: Generated artifacts one byte over the per-target packet limit leave authored input reviewable and visible
      Given a review has one authored target and two generated targets each one byte over the per-target packet limit
      And an independent reviewer is available
      When a builder runs the public review command
      Then the reviewer receives exactly the authored target with its original raw content
      And excluded_targets exactly names both generated target paths in supplied order
      And the command exits successfully with no errors

    Scenario: A repeated generated target has one ordered exclusion
      Given a review has one authored target and the same oversized generated target twice
      And an independent reviewer is available
      When a builder runs the public review command
      Then excluded_targets exactly names the repeated generated target once
      And the reviewer receives exactly the authored target with its original raw content
      And the command exits successfully with no errors

    Scenario: Generated path aliases have one canonical ordered exclusion
      Given a review has one authored target and the same generated oversized target supplied first as generated/../generated/output.js and then as generated/output.js
      And an independent reviewer is available
      When a builder runs the public review command
      Then excluded_targets exactly names generated/output.js once
      And the reviewer receives exactly the authored target with its original raw content
      And the command exits successfully with no errors

    Scenario: A generated target at the individual packet boundary remains reviewable
      Given a review has a generated target with 131072 two-byte UTF-8 characters and exactly 262144 raw content bytes
      And an independent reviewer is available
      When a builder runs the public review command
      Then the reviewer receives exactly the generated target with its original raw content
      And the result has no excluded_targets
      And the command exits successfully with no errors

    Scenario: A generated target below the individual packet limit remains reviewable
      Given a review has a generated target with 262143 raw content bytes
      And an independent reviewer is available
      When a builder runs the public review command
      Then the reviewer receives exactly the generated target with its original raw content
      And the result has no excluded_targets
      And the command exits successfully with no errors

    Scenario: A repeated eligible target is reviewed and aggregate-counted once
      Given a review has four eligible targets each with exactly 262144 raw content bytes and repeats the first target
      And an independent reviewer is available
      When a builder runs the public review command
      Then the reviewer receives exactly four eligible targets with their original raw content in first-supplied canonical order
      And the result has no excluded_targets
      And the command exits successfully with no errors

    Scenario: An eligible lexical alias is reviewed and aggregate-counted once
      Given a review has four eligible targets each with exactly 262144 raw content bytes and supplies the first target again as nested/../first-target.js
      And an independent reviewer is available
      When a builder runs the public review command
      Then the reviewer receives exactly four eligible targets with their original raw content in first-supplied canonical order
      And the result has no excluded_targets
      And the command exits successfully with no errors

    Scenario Outline: Lexical normalization defines target identity before intermediate symlink traversal
      Given a review supplies a generated oversized target as link/../generated/output.js
      And link is an intermediate symlink pointing <destination>
      And an independent reviewer is available
      When a builder runs the public review command
      Then Git attribute lookup, excluded_targets, and reviewer packet paths use generated/output.js without link
      And the command exits successfully with no errors

      Examples:
        | destination              |
        | another in-project path  |
        | a path outside the project |

    Scenario: An eligible target at the packet boundary does not require Git attribute resolution
      Given a review has a target with exactly 262144 raw content bytes
      And Git attribute resolution would exit unsuccessfully if called
      And an independent reviewer is available
      When a builder runs the public review command
      Then the reviewer receives exactly the target with its original raw content
      And Git attribute lookup is never called
      And the command exits successfully with no errors

  @focused-review.TBU1.R2
  Rule: focused-review.TBU1.R2 — An oversized target without an explicit generated marker still prevents the review from running

    @rejection
    Scenario Outline: A non-true generated attribute does not launch a reviewer
      Given a review has an oversized target with linguist-generated <attribute>
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_TOO_LARGE
      And the failed result has no excluded_targets

      Examples:
        | attribute |
        | false              |
        | unset              |
        | set-without-value  |
        | TRUE               |
        | True               |
        | yes                |
        | true-with-whitespace |

    @rejection
    Scenario: Unavailable Git attribute resolution does not permit omission
      Given a review has an oversized target and Git attribute resolution exits unsuccessfully
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE
      And the failed result has no excluded_targets

    @rejection
    Scenario Outline: A bounded Git attribute lookup failure does not permit omission
      Given a review has an oversized target and Git attribute resolution <failure>
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE
      And the failed result has no excluded_targets

      Examples:
        | failure                                      |
        | exceeds its configured execution timeout     |
        | exceeds its configured captured output limit |

    @rejection
    Scenario: An eligible target changed after bounded capture does not reach attribute lookup
      Given a review has an eligible target replaced after bounded packet capture with different content of the same byte length and restored timestamp
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_CHANGED
      And Git attribute lookup is never called
      And the failed result has no excluded_targets

    @rejection
    Scenario: An eligible target changed after oversized classification cannot reach a reviewer
      Given a review has one eligible target and one oversized target marked generated
      And Git attribute lookup has classified the oversized target
      And the eligible target is atomically replaced after Git attribute lookup with different content of the same byte length and restored timestamp
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_CHANGED
      And the failed result has no excluded_targets

    @rejection
    Scenario Outline: A generated marker cannot bypass non-regular target validation
      Given a review has an oversized target marked generated that is <defect>
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code <error_code>
      And Git attribute lookup is never called
      And the failed result has no excluded_targets

      Examples:
        | defect       | error_code               |
        | a directory   | REVIEW_TARGET_NOT_REGULAR |
        | a named pipe  | REVIEW_TARGET_NOT_REGULAR |

    Scenario: An oversized generated sparse target is omitted without reading or decoding its bytes
      Given a review has one authored target and an 8 GiB sparse target marked generated
      And an independent reviewer is available
      When a builder runs the public review command
      Then the reviewer receives exactly the authored target with its original raw content
      And excluded_targets exactly names the sparse generated target
      And the command reads no bytes from the sparse generated target
      And the command exits successfully with no errors

    @rejection
    Scenario Outline: An oversized generated target changed after metadata validation fails before omission
      Given a review has one authored target and an oversized target marked generated
      And the generated target changes after metadata validation to <replacement>
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code <error_code>
      And the command reads no bytes from the changed generated target
      And the failed result has no excluded_targets

      Examples:
        | replacement                       | error_code                         |
        | a named pipe                       | REVIEW_TARGET_CHANGED               |
        | a symlink escaping the project     | REVIEW_TARGET_OUTSIDE_PROJECT       |
        | an atomically replaced same-sized regular file with a restored timestamp | REVIEW_TARGET_CHANGED |
        | an in-place size change             | REVIEW_TARGET_CHANGED               |

    @rejection
    Scenario Outline: Non-attribute target failures are reported in supplied order
      Given a review submits the exact target sequence <first_target> then <second_target>
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code <error_code>
      And Git attribute lookup is never called
      And the failed result has no excluded_targets

      Examples:
        | first_target             | second_target             | error_code                         |
        | an outside-project target | a named pipe              | REVIEW_TARGET_OUTSIDE_PROJECT       |
        | a named pipe              | an outside-project target | REVIEW_TARGET_NOT_REGULAR           |

    Scenario Outline: Successful generated classification does not change the first supplied target failure
      Given a review submits the exact target sequence <first_target> then <second_target>
      And Git attribute lookup completes successfully for every valid oversized target
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code <error_code>
      And Git attribute lookup receives each valid oversized target once
      And the failed result has no excluded_targets

      Examples:
        | first_target                              | second_target                         | error_code                         |
        | invalid UTF-8 text                         | an oversized unmarked target          | REVIEW_TARGET_INVALID_TEXT          |
        | an oversized unmarked target               | invalid UTF-8 text                    | REVIEW_TARGET_TOO_LARGE             |
        | eligible targets exceeding aggregate size  | an oversized unmarked target          | REVIEW_PACKET_TOO_LARGE             |
        | an oversized unmarked target               | eligible targets exceeding aggregate size | REVIEW_TARGET_TOO_LARGE          |

    Scenario: Full preflight classifies a valid oversized target after an earlier invalid target
      Given a review submits a named pipe followed by an oversized target marked generated
      And Git attribute lookup completes successfully for the valid oversized target
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_NOT_REGULAR
      And metadata validation runs once for each submitted target
      And Git attribute lookup receives only the valid oversized target
      And the failed result has no excluded_targets

    @rejection
    Scenario Outline: Malformed Git attribute output does not permit omission
      Given a review has an oversized target and Git attribute resolution returns <malformation>
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE
      And the failed result has no excluded_targets

      Examples:
        | malformation        |
        | no complete record  |
        | duplicate records   |
        | a missing tuple field |
        | a missing NUL terminator |
        | the wrong attribute name |
        | one record for a different path |
        | one matching record and one unrelated extra record |
        | invalid UTF-8 bytes |
        | an empty path field |
        | an empty attribute field |
        | an empty value field |
        | a surplus NUL-delimited field |
        | trailing non-NUL bytes |

    @rejection
    Scenario Outline: A multi-target attribute failure is atomic in either supplied order
      Given a review has two oversized targets in <order>, one marked generated and one with malformed Git attribute output
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE
      And the failed result has no excluded_targets

      Examples:
        | order                     |
        | generated then malformed  |
        | malformed then generated  |

    @rejection
    Scenario Outline: Attribute-resolution failure takes precedence over an unmarked oversized target in either order
      Given a review has an oversized unmarked target and an oversized target with Git attribute resolution failure in <order>
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE
      And the failed result has no excluded_targets

      Examples:
        | order                                      |
        | unmarked then attribute-resolution failure |
        | attribute-resolution failure then unmarked |

    @rejection
    Scenario Outline: The public CLI reports each preflight failure as a JSON envelope
      Given <preflight_failure>
      And an independent reviewer is available
      When a builder runs `safeword review run quality-review --json --cwd project-root`
      Then stdout is the versioned JSON result envelope whose errors[0].code is <error_code>
      And stdout has no data.excluded_targets
      And stderr is empty
      And the command exits nonzero

      Examples:
        | preflight_failure                                           | error_code                           |
        | an oversized target without a generated marker              | REVIEW_TARGET_TOO_LARGE              |
        | an oversized target with Git attribute resolution failure   | REVIEW_TARGET_ATTRIBUTE_UNAVAILABLE  |
        | no submitted targets                                        | REVIEW_NO_ELIGIBLE_TARGETS           |
        | a target outside the project                                | REVIEW_TARGET_OUTSIDE_PROJECT        |
        | a named pipe target                                         | REVIEW_TARGET_NOT_REGULAR            |
        | a target that changes after bounded capture                 | REVIEW_TARGET_CHANGED                |
        | invalid UTF-8 text                                          | REVIEW_TARGET_INVALID_TEXT           |
        | eligible targets exceeding the aggregate packet limit       | REVIEW_PACKET_TOO_LARGE              |

    @rejection
    Scenario: Mixed marked and unmarked oversized targets fail atomically
      Given a review has an authored target, an oversized generated target, and an oversized unmarked target
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_TOO_LARGE
      And the failed result has no excluded_targets

    Scenario: Generated omission retains a review exactly at the aggregate packet limit
      Given a review has an oversized target marked generated and four eligible targets each with 131072 two-byte UTF-8 characters and 262144 raw content bytes
      And an independent reviewer is available
      When a builder runs the public review command
      Then the reviewer receives exactly the eligible targets
      And the reviewer receives each eligible target's original raw content
      And excluded_targets exactly names the generated target
      And the command exits successfully with no errors

    @rejection
    Scenario: Generated omission cannot weaken the aggregate packet limit
      Given a review has an oversized target marked generated, four eligible targets each with 131072 two-byte UTF-8 characters and 262144 raw content bytes, and one eligible target of one raw content byte
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_PACKET_TOO_LARGE
      And the failed result has no excluded_targets

  @focused-review.SWM1.R1
  Rule: focused-review.SWM1.R1 — A review with no eligible targets reports that condition rather than asking a reviewer to approve an empty packet

    @rejection
    Scenario: All generated oversized targets stop before reviewer launch
      Given a review has only oversized targets marked generated
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_NO_ELIGIBLE_TARGETS
      And the failed result has no excluded_targets

    @rejection
    Scenario: An empty submitted target list stops before reviewer launch
      Given a review has no submitted targets
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_NO_ELIGIBLE_TARGETS
      And the failed result has no excluded_targets

  @focused-review.SWM1.R2
  Rule: focused-review.SWM1.R2 — Safeword's own generated runtime outputs use the same repository marker the command reads

    Scenario: A Git-marked generated target is selected without a path heuristic
      Given a review has one authored target and an oversized arbitrary target marked generated by Git attributes
      And an independent reviewer is available
      When a builder runs the public review command
      Then the result exposes the arbitrary target in excluded_targets
      And the reviewer receives exactly the authored target with its original raw content
      And the command exits successfully with no errors

    Scenario Outline: Git attribute lookup safely keeps generated paths project-relative
      Given a review has one authored target and a generated oversized target at <path>
      And an independent reviewer is available
      When a builder runs the public review command
      Then excluded_targets exactly names <path>
      And the reviewer receives exactly the authored target with its original raw content
      And Git attribute lookup receives the canonical project-relative path <path>
      And Git attribute lookup runs through isolated empty Git metadata against the committed project tree without a shell
      And Git attribute lookup supplies <path> as one literal NUL-terminated stdin field
      And the command exits successfully with no errors

      Examples:
        | path                      |
        | nested/generated file.js  |
        | --generated-output.js     |

    Scenario Outline: Git attribute lookup preserves special generated paths as one literal NUL-delimited stdin value
      Given a review has one authored target and a generated oversized target at <path>
      And an independent reviewer is available
      When a builder runs the public review command
      Then excluded_targets exactly names <path>
      And the reviewer receives exactly the authored target with its original raw content
      And Git attribute lookup supplies <path> as one literal NUL-terminated stdin field and returns exactly one UTF-8 NUL-terminated tuple of canonical path, linguist-generated, and value
      And the command exits successfully with no errors

      Examples:
        | path                                  |
        | :(top)generated-output.js              |

    Scenario: Git attribute lookup preserves a generated filename containing an actual newline code point
      Given a review has one authored target and a generated oversized target whose filename contains an actual U+000A code point
      And an independent reviewer is available
      When a builder runs the public review command
      Then Git attribute lookup sends and receives the target as exact NUL-delimited UTF-8 bytes
      And excluded_targets exactly names the generated target
      And the command exits successfully with no errors

    Scenario: Project Git info attributes cannot override a committed generated marker
      Given a review project HEAD .gitattributes marks an oversized target generated
      And the project's .git/info/attributes marks the same target false
      And global and system Git attributes mark the same target false
      And an independent reviewer is available
      When a builder runs the public review command
      Then excluded_targets exactly names the generated target
      And the reviewer receives exactly the authored target with its original raw content
      And the command exits successfully with no errors

    Scenario: Attribute classification ignores a working-tree marker removal
      Given a review project HEAD .gitattributes marks an oversized target generated
      And the project working-tree .gitattributes is atomically replaced with an equally sized unmarked file before classification
      And an independent reviewer is available
      When a builder runs the public review command
      Then excluded_targets exactly names the generated target
      And the reviewer receives exactly the authored target with its original raw content
      And the command exits successfully with no errors

    @rejection
    Scenario: Attribute classification ignores an uncommitted marker addition
      Given a review project HEAD .gitattributes leaves an oversized target unmarked
      And the project working-tree .gitattributes is atomically replaced with an equally sized generated marker before classification
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_TOO_LARGE
      And the failed result has no excluded_targets

    @rejection
    Scenario: External Git attributes cannot create a generated exception
      Given a review project has an oversized target without a .gitattributes generated marker
      And the project's .git/info/attributes and global Git attributes mark that target generated
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_TOO_LARGE
      And the failed result has no excluded_targets

    Scenario: Hostile project Git configuration and inherited environment cannot redirect committed classification
      Given a review project HEAD .gitattributes marks an oversized target generated
      And project Git configuration and inherited environment variables redirect attribute and object lookup to hostile values
      And an independent reviewer is available
      When a builder runs the public review command
      Then excluded_targets exactly names the generated target
      And the reviewer receives exactly the authored target with its original raw content
      And the command exits successfully with no errors

    Scenario: Distinct hard-linked generated targets remain distinct exclusions
      Given a review has one authored target and two distinct hard-linked oversized targets marked generated
      And an independent reviewer is available
      When a builder runs the public review command
      Then excluded_targets exactly names both hard-link target paths in supplied order
      And the reviewer receives exactly the authored target with its original raw content
      And the command exits successfully with no errors

    Scenario: The CLI returns the reduced scope in its JSON stdout envelope
      Given a review has one authored target and one oversized target marked generated
      And an independent reviewer is available
      When a builder runs `safeword review run quality-review --json --cwd project-root` with both targets
      Then stdout is the versioned JSON result envelope whose data.excluded_targets exactly names the generated target
      And stderr is empty
      And the command exits successfully with no errors

    Scenario: A reviewer failure after packet finalization reports the reduced scope
      Given a review has one authored target and one oversized target marked generated
      And the independent reviewer fails after receiving its packet
      When a builder runs `safeword review run quality-review --json --cwd project-root` with both targets
      Then stdout is the versioned JSON result envelope whose errors[0].code is REVIEW_ROUTES_EXHAUSTED and whose data.excluded_targets exactly names the generated target
      And stderr is empty
      And the command exits nonzero

    @rejection
    Scenario Outline: A target outside the project cannot reach Git attribute lookup
      Given a review has a target path outside the project at <path>
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_OUTSIDE_PROJECT
      And Git attribute lookup is never called
      And the failed result has no excluded_targets

      Examples:
        | path                           |
        | ../outside-file.js             |
        | nested/../../outside-file.js   |
        | /tmp/outside-file.js           |

    @rejection
    Scenario: A project-relative symlink escaping the project cannot reach Git attribute lookup
      Given a review has a project-relative symlinked target resolving outside the project
      And an independent reviewer is available
      When a builder runs the public review command
      Then no reviewer is asked to review it
      And the command exits nonzero with errors[0].code REVIEW_TARGET_OUTSIDE_PROJECT
      And Git attribute lookup is never called
      And the failed result has no excluded_targets

    Scenario: Safeword's generated plugin runtime declares the same marker
      Given Safeword's plugin/runtime/cli.js generated output
      When its Git attributes are checked
      Then plugin/runtime/cli.js resolves linguist-generated to true
