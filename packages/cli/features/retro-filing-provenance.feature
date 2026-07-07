# BDD source for G19QG7 (retro filing provenance + reconcile sweep). Proven by
# the vitest suite (co-located `*.test.ts` under src/retro), whose unit + wiring
# scenarios mock only the process boundaries (the GitHub transport, git state,
# the clock) — a shape the cucumber black-box lane can't drive. `@manual`
# excludes it from the cucumber acceptance lane while keeping it readable by
# codify / review-spec / safeword check.
@retro-filing-provenance @manual
Feature: Retro filing provenance and reconcile sweep

  Retro files issues eagerly at Stop events and never looks back, so issues filed
  from intermediate session states stay open after the fix merges. Every encounter
  now records environment-aware code-state provenance (dogfood: safeword short HEAD
  SHA + capture time; customer install: installed safeword version), and a
  flag-only reconcile sweep marks open issues whose surface changed after the
  newest recorded code state as possibly-resolved.

  @retro-filing-provenance.SM1.R1
  Rule: retro-filing-provenance.SM1.R1 — Every encounter records environment-aware provenance, newest visible

    Scenario: A dogfood-session encounter records the safeword short HEAD SHA and capture time
      Given a retro encounter captured in the safeword dogfood repo
      When safeword retro files the encounter, with only the GitHub transport, git state, and clock mocked
      Then the issue's ledger provenance carries the safeword repo's short commit SHA and the capture time

    Scenario: A customer-install encounter records the installed safeword version and capture time
      Given a retro encounter captured in a customer project where safeword is an installed package
      When the encounter is recorded on its tracker issue
      Then the ledger provenance carries the installed safeword version and the capture time, and no commit SHA

    Scenario: A recurrence bump surfaces the newest encounter's provenance
      Given an open issue whose ledger records an older encounter's provenance
      When a later session's encounter bumps the issue
      Then the ledger's newest provenance reflects the later encounter's code state

    Scenario: A recurrence bump onto a pre-provenance ledger preserves its counts and gains provenance
      Given an open retro issue whose ledger predates provenance and records existing occurrence counts
      When a new encounter bumps the issue
      Then the existing occurrence counts are preserved unchanged and the ledger now carries the new encounter's provenance

    @rejection
    Scenario: Unresolvable git state never blocks filing
      Given a dogfood session whose commit state cannot be resolved
      When the encounter is filed
      Then the issue is filed with provenance omitted rather than failing or inventing a value

  @retro-filing-provenance.SM1.R2
  Rule: retro-filing-provenance.SM1.R2 — Provenance is code-assembled, bounded, and never carries a customer repo identifier

    Scenario: Customer-install provenance contains no customer repo identifier
      Given a retro encounter captured in a customer project on a customer feature branch
      When the ledger comment is rendered
      Then it carries the safeword version and no customer branch name, repository name, or commit SHA

    @rejection
    Scenario: Attacker-shaped provenance in an upstream ledger is coerced, never echoed
      Given an upstream ledger comment whose provenance fields hold oversized or non-token-shaped values
      When retro parses that ledger and re-renders it for a new encounter
      Then the rendered provenance contains only bounded token-shaped values, with malformed fields dropped

  @retro-filing-provenance.SM2.R1
  Rule: retro-filing-provenance.SM2.R1 — Reconcile flags an issue whose surface was touched after its newest recorded code state

    Scenario: A dogfood-provenance issue is flagged when its surface changed after the capture time
      Given an open retro issue whose newest provenance is a dogfood encounter
      And the issue's surface was touched on the default branch after that capture time
      When the reconcile CLI mode runs, with only the GitHub transport mocked
      Then the issue is marked possibly-resolved

    Scenario: A version-provenance issue is flagged when its surface changed after that release's tag date
      Given an open retro issue whose newest provenance is an installed-version encounter
      And the issue's surface was touched on the default branch after that version's release-tag date
      When the reconcile sweep runs
      Then the issue is marked possibly-resolved

    Scenario: A mixed ledger keys on the newest code state, not the newest wall clock
      Given an open retro issue with a dogfood encounter and a later-in-time encounter from an older installed version
      And the issue's surface has commits after the old version's release-tag date but none after the dogfood capture time
      When the reconcile sweep runs
      Then the issue is left unmarked

    @rejection
    Scenario: An issue whose surface is untouched since its newest code state is not flagged
      Given an open retro issue whose surface has no commits after its newest code-state date
      When the reconcile sweep runs
      Then the issue is left unmarked

  @retro-filing-provenance.SM2.R2
  Rule: retro-filing-provenance.SM2.R2 — Reconcile only flags; it never closes

    @rejection
    Scenario: Flagging leaves the issue open and touches nothing but a comment and label
      Given an open retro issue eligible for flagging
      When the reconcile sweep flags it
      Then only a possibly-resolved comment and label are added and the issue remains open

  @retro-filing-provenance.SM2.R3
  Rule: retro-filing-provenance.SM2.R3 — Reconcile is idempotent

    @rejection
    Scenario: A re-run against unchanged state adds no duplicate flags
      Given an open retro issue already marked possibly-resolved
      When the reconcile sweep runs again with no new commits on the issue's surface
      Then no additional comment or label is added

  @retro-filing-provenance.SM2.R4
  Rule: retro-filing-provenance.SM2.R4 — Unreconcilable issues are left untouched

    @rejection
    Scenario: An issue without recorded provenance is skipped
      Given an open retro issue filed before provenance existed
      When the reconcile sweep runs
      Then the issue is left untouched

    @rejection
    Scenario: A process-surfaced issue is skipped
      Given an open retro issue whose surface is a process area rather than a file path
      When the reconcile sweep runs
      Then the issue is left untouched

    @rejection
    Scenario: A version whose release-tag date cannot be resolved is skipped
      Given an open retro issue whose newest provenance is a version with no resolvable release tag
      When the reconcile sweep runs
      Then the issue is left untouched rather than keyed to a guessed date

  @retro-filing-provenance.SM2.R5
  Rule: retro-filing-provenance.SM2.R5 — The sweep considers only open, retro-labeled issues

    @rejection
    Scenario: Closed and non-retro issues are never considered
      Given a closed retro issue and an open issue without the retro label, each with reconcilable provenance
      When the reconcile sweep runs
      Then the sweep's issue listing requests only open, retro-labeled issues, and neither fixture receives a comment or label

  @retro-filing-provenance.SM2.R6
  Rule: retro-filing-provenance.SM2.R6 — The sweep bounds its API operations per run, and applied flags land complete

    Scenario: A run over more flaggable issues than the bound flags completely up to it and defers the rest
      Given more flaggable open retro issues than the per-run operation bound
      When the reconcile sweep runs
      Then it flags at most the bounded number, each applied flag carries both its comment and its label, and the remaining issues are left unmarked for a later run

  @retro-filing-provenance.SM2.R7
  Rule: retro-filing-provenance.SM2.R7 — A per-issue transport failure never sinks the sweep or flags on partial data

    @rejection
    Scenario: A failing surface-commits query isolates to its issue
      Given two flaggable issues where the surface-commits query fails for the first
      When the reconcile sweep runs
      Then the first issue is left untouched and the second is still flagged
