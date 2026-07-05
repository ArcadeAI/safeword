Feature: Managed-file provenance refresh on upgrade

  Safeword records what it actually writes for each managed file (a provenance
  manifest under .safeword/), so upgrade can bring files the customer never
  edited — including ctx-generated toolchain configs — to current output, while
  a file whose bytes differ from safeword's recorded write is never touched.
  Pre-manifest installs adopt only by byte-identity to current output; anything
  unprovable stays unmanaged. (#849)

  @managed-file-refresh.TB1.R1
  Rule: managed-file-refresh.TB1.R1 — an upgrade brings every pristine managed file to current resolved output

    Scenario: Setup records provenance for the managed files it writes
      Given a fresh project with no safeword install
      When safeword setup runs
      Then the provenance manifest records every managed file setup wrote
      And each recorded hash matches that file's on-disk content

    Scenario: Setup on a clone of an installed project preserves existing provenance
      Given a clone of an installed project with a committed provenance manifest
      When safeword setup runs
      Then the manifest still records every previously recorded managed file

    Scenario: A pristine static managed file is refreshed when its template changes
      Given an installed project whose managed file matches its recorded provenance
      And safeword now resolves different content for that file
      When safeword upgrade runs
      Then the file contains the newly resolved content
      And the manifest records the new content for that file

    Scenario: A deleted managed file is recreated and regains provenance
      Given an installed project whose managed file was deleted
      When safeword upgrade runs
      Then the file exists with currently resolved content
      And the manifest records the new content for that file

    @rejection
    Scenario: An unrecorded file that differs from resolved output is not brought current
      Given an installed project with a managed-path file that has no provenance entry
      And that file's content differs from the currently resolved output
      When safeword upgrade runs
      Then the upgrade succeeds
      And the file's bytes are unchanged

  @managed-file-refresh.TB1.R2
  Rule: managed-file-refresh.TB1.R2 — every refresh is reported; no managed file changes silently

    Scenario: Upgrade output names each refreshed managed file
      Given an installed project whose managed file matches its recorded provenance
      And safeword now resolves different content for that file
      When safeword upgrade runs
      Then the upgrade output reports that file as updated

    @rejection
    Scenario: Diff previews a pending refresh without writing it
      Given an installed project whose managed file matches its recorded provenance
      And safeword now resolves different content for that file
      When safeword diff runs
      Then the diff output reports that file as pending update
      And the file's bytes are unchanged

  @managed-file-refresh.TB1.R3
  Rule: managed-file-refresh.TB1.R3 — a managed file already at current output is never rewritten

    @rejection
    Scenario: A pristine, current managed file is left unwritten on upgrade
      Given an installed project whose managed file matches its recorded provenance
      And safeword resolves identical content for that file
      When safeword upgrade runs
      Then the upgrade output does not report that file
      And the file is not rewritten

  @managed-file-refresh.TB2.R1
  Rule: managed-file-refresh.TB2.R1 — upgrade never rewrites a managed file whose bytes differ from safeword's recorded write

    @rejection
    Scenario: A customized managed file survives a shipped change untouched
      Given an installed project whose managed file was edited after install
      And safeword now resolves different content for that file
      When safeword upgrade runs
      Then the upgrade succeeds
      And the file's bytes are exactly as the customer left them
      And the upgrade output does not report that file as updated

  @managed-file-refresh.TB2.R2
  Rule: managed-file-refresh.TB2.R2 — pristine status is re-derived from on-disk bytes at every upgrade

    @rejection
    Scenario: An edit made after an earlier refresh protects the file on the next upgrade
      Given an installed project whose managed file was refreshed by a previous upgrade
      And the customer then edited that file
      And safeword now resolves different content for that file
      When safeword upgrade runs
      Then the upgrade succeeds
      And the file's bytes are exactly as the customer left them

  @managed-file-refresh.TB2.R3
  Rule: managed-file-refresh.TB2.R3 — no manifest state survives uninstall or reset

    @rejection
    Scenario Outline: Reset removes the provenance manifest in either mode
      Given an installed project with a recorded provenance manifest
      When safeword <command> runs
      Then no provenance manifest remains in the project

      Examples:
        | command      |
        | reset        |
        | reset --full |

  @managed-file-refresh.SM1.R1
  Rule: managed-file-refresh.SM1.R1 — provenance covers generator output as well as static templates

    Scenario: A pristine generated toolchain config is refreshed when its generator output changes
      Given an installed project whose generated managed config matches its recorded provenance
      And safeword's generator now resolves different content for that config
      When safeword upgrade runs
      Then the config contains the newly resolved content
      And the manifest records the new content for that config

    @rejection
    Scenario: A config whose generator now resolves nothing is left untouched
      Given an installed project whose generated managed config matches its recorded provenance
      And safeword's generator now resolves no content for that config
      When safeword upgrade runs
      Then the config's bytes are unchanged
      And the upgrade succeeds

  @managed-file-refresh.SM1.R2
  Rule: managed-file-refresh.SM1.R2 — byte-identity to current resolved output is the only adoption path into provenance

    Scenario: A pre-manifest file identical to resolved output gains provenance without a write
      Given an installed project with no provenance manifest
      And a managed file whose content equals the currently resolved output
      When safeword upgrade runs
      Then the manifest records that file
      And the file is not rewritten

    Scenario: A file matching resolved output but not its record has its record healed
      Given an installed project whose managed file equals the currently resolved output
      And that file's recorded provenance does not match its content
      When safeword upgrade runs
      Then the file is not rewritten
      And the manifest records the current content for that file

    Scenario: An adopted file is refreshed by a later shipped change
      Given an installed project whose managed file was adopted into provenance by a previous upgrade
      And safeword now resolves different content for that file
      When safeword upgrade runs
      Then the file contains the newly resolved content

    @rejection
    Scenario: A pre-manifest file that differs from resolved output is never adopted
      Given an installed project with no provenance manifest
      And a managed file whose content differs from the currently resolved output
      And an upgrade has already run without adopting that file
      And safeword now resolves different content for that file
      When safeword upgrade runs
      Then the upgrade succeeds
      And the file's bytes are unchanged
      And the manifest records no entry for that file

    @rejection
    Scenario: A corrupt manifest refreshes nothing and does not fail the upgrade
      Given an installed project whose provenance manifest is unparseable
      And safeword now resolves different content for a pristine managed file
      When safeword upgrade runs
      Then the upgrade succeeds
      And no managed file is rewritten
      And the manifest file's bytes are unchanged
      And the upgrade output warns that the provenance manifest is unreadable

    Scenario: A configKey-overridden managed file stays fully suppressed
      Given a fresh project with a configKey path override configured
      When safeword setup and then upgrade run
      Then the overridden managed file is not written
      And the manifest gains no entry for that file
