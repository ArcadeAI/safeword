@surface.safeword-cli @proof.vitest
Feature: Upgrade remote-test workflows safely

  Background:
    Given released v1 differs from the current Safeword workflow

  @upgrade-remote-test-workflows-safely.TBU1.R1
  Rule: upgrade-remote-test-workflows-safely.TBU1.R1 — Only exact released Safeword workflows authorize managed lifecycle changes

    Scenario Outline: Setup upgrades an unchanged released predecessor across checkout line endings
      Given the remote-test workflow contains exact released v1 bytes with <line endings> line endings
      And the fixture guard confirms the exact on-disk bytes use <line endings>
      When the builder runs remote workflow setup
      Then setup succeeds with exactly the current Safeword LF bytes and this attempt's private file absent

      Examples:
        | line endings |
        | LF           |
        | CRLF         |

    @rejection
    Scenario Outline: Setup preserves a customer-edited predecessor across checkout line endings
      Given exact released v1 bytes with <line endings> line endings have one customer-added lone carriage return
      And the fixture guard confirms the exact on-disk bytes use <line endings>
      When the builder runs remote workflow setup
      Then setup returns action required with the customer's exact workflow bytes unchanged

      Examples:
        | line endings |
        | LF           |
        | CRLF         |

    Scenario: Disable removes an unchanged released workflow
      Given the remote-test workflow contains exact released v1 bytes
      When the builder runs remote workflow disable
      Then the remote-test workflow file is absent

    @rejection
    Scenario Outline: Disable preserves a customer-edited workflow across checkout line endings
      Given exact released v1 bytes with <line endings> line endings have one customer-added lone carriage return
      And the fixture guard confirms the exact on-disk bytes use <line endings>
      When the builder runs remote workflow disable
      Then disable returns action required with the customer's exact workflow bytes unchanged

      Examples:
        | line endings |
        | LF           |
        | CRLF         |

    @rejection
    Scenario Outline: Disable never removes a workflow that no longer revalidates as released v1
      Given the remote-test workflow contains exact released v1 bytes
      And disable pauses after classifying the workflow as historical
      When <change> before disable resumes
      Then disable returns action required and <final state>

      Examples:
        | change                                                         | final state                                                        |
        | another process writes customer-owned bytes                    | the customer's exact bytes remain                                  |
        | the filesystem adapter fails the workflow revalidation read    | after the injected failure clears, exact released v1 bytes remain  |

    Scenario Outline: Disable completes when the commit-time state already needs no file
      Given the remote-test workflow contains exact released v1 bytes
      And disable pauses after classifying the workflow as historical
      When another process <change> before disable resumes
      Then disable succeeds and the remote-test workflow file is absent

      Examples:
        | change                                      |
        | installs the exact current Safeword workflow |
        | deletes the workflow                         |

  @upgrade-remote-test-workflows-safely.TBU1.R2
  Rule: upgrade-remote-test-workflows-safely.TBU1.R2 — Interrupted upgrades expose complete predecessor or successor bytes and retry safely

    @rejection
    Scenario Outline: A changed or unreadable workflow prevents historical publication
      Given the remote-test workflow contains exact released v1 bytes
      And setup pauses after preparing the complete replacement
      When another process <change> before setup resumes
      Then setup returns action required, <final state>, and removes this attempt's private file

      Examples:
        | change                                             | final state                                                         |
        | writes customer-owned workflow bytes                | the customer's exact bytes remain                                   |
        | makes the filesystem adapter's workflow revalidation read fail | after the injected failure clears, exact released v1 bytes remain  |

    Scenario Outline: Setup converges when the commit-time state needs no preservation
      Given the remote-test workflow contains exact released v1 bytes
      And setup pauses after preparing the complete replacement
      When another process <change> before setup resumes
      Then setup succeeds with the exact current workflow installed and removes this attempt's private file

      Examples:
        | change                                      |
        | installs the exact current Safeword workflow |
        | deletes the workflow                         |

    @rejection
    Scenario: Failed private-file preparation preserves the released predecessor
      Given the remote-test workflow contains exact released v1 bytes
      And replacement preparation fails after writing the private replacement file
      When the builder runs remote workflow setup
      Then setup returns action required, the complete released v1 remains, and this attempt's private file is removed

    @rejection
    Scenario: Failed publication preserves the released predecessor
      Given the remote-test workflow contains exact released v1 bytes
      And the filesystem adapter fails the publication rename
      When the builder runs remote workflow setup
      Then setup returns action required, the complete released v1 remains, and this attempt's private file is removed

    Scenario: Publication never writes through the visible workflow path
      Given the remote-test workflow contains exact released v1 bytes
      When the builder runs remote workflow setup
      Then the instrumented filesystem adapter observes one complete private file published by rename without opening the visible workflow path for writing, truncating it, or writing to it

    Scenario: Retry ignores foreign crash residue and installs the current workflow
      Given exact released v1 bytes and residue at another invocation's unique private path remain from an interrupted setup
      When the builder retries remote workflow setup
      Then the complete current workflow is installed without changing the foreign residue
