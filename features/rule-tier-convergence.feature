Feature: Converge spec grammar on a single Rule tier

  The criteria tier between a JTBD and its scenarios is named Rule, and only Rule.
  The "one criteria kind, never both" split retires with the mixed-criteria guard;
  legacy `.AC` keeps parsing as a deprecated alias with a plain-language nudge; and
  `safeword migrate-ac` rewrites an `.AC` corpus to `.R` in one pass.

  Rule: New authoring surfaces present only the Rule tier

    @rule-tier-convergence.SM1.R1
    Scenario: The scaffolded spec template offers Rule headings as the criteria tier
      Given the shipped spec template
      When an author reads its Jobs To Be Done guidance
      Then it scaffolds a numbered Rule heading as the criteria under a JTBD

    @rule-tier-convergence.SM1.R1 @rejection
    Scenario: No authoring surface still offers Acceptance Criteria as a co-equal tier
      Given the shipped spec template and bdd skill guidance
      When an author reads how to decompose a JTBD
      Then no surface presents Acceptance Criteria as a criteria tier to choose
      And no surface states that a JTBD declares one criteria kind, never both

  Rule: A JTBD mixing AC and Rule headings is no longer an error

    @rule-tier-convergence.SM1.R2
    Scenario: A JTBD declaring both an AC heading and a Rule heading raises no check issue
      Given a ticket spec whose JTBD declares both an AC heading and a numbered Rule heading
      When safeword check runs
      Then no mixed-criteria issue is reported

    @rule-tier-convergence.SM1.R2 @rejection
    Scenario: The mixed-criteria guard no longer exists to flag any JTBD
      Given a ticket spec whose JTBD declares both an AC heading and a numbered Rule heading
      When safeword check runs
      Then the check reports no issue that names the JTBD as mixing criteria kinds

  Rule: Coverage speaks one Rule vocabulary regardless of legacy spelling

    @rule-tier-convergence.SM1.R2
    Scenario: An uncovered criterion is reported in Rule terms
      Given a ticket spec declaring a criterion that no feature scenario references
      When safeword check runs
      Then an uncovered advisory names that criterion in Rule terms

    @rule-tier-convergence.SM1.R2
    Scenario Outline: Coverage drift is worded identically for a Rule id and a legacy AC id
      Given a feature scenario whose lineage reference is <reference> and drifts as <drift>
      When safeword check runs
      Then a <drift> advisory names <reference> with one Rule vocabulary

      Examples:
        | reference   | drift  |
        | demo.SM1.R9 | stale  |
        | demo.SM1.AC9 | stale  |
        | gone.SM1.R1 | orphan |
        | gone.SM1.AC1 | orphan |

  Rule: The intake-exit gate requires a Rule and names Rules when none is present

    @rule-tier-convergence.SM1.R3
    Scenario: A JTBD declaring a numbered Rule satisfies the intake-exit gate
      Given a ticket spec whose JTBD declares a numbered Rule and no skip line
      When the intake-exit gate evaluates test-definitions creation
      Then the gate allows the creation

    @rule-tier-convergence.SM1.R3 @rejection
    Scenario: A JTBD with no criteria and no skip is denied, naming the Rule heading to add
      Given a ticket spec whose JTBD declares no criteria and no skip line
      When the intake-exit gate evaluates test-definitions creation
      Then the gate denies the creation
      And the denial message names a numbered Rule heading as the criterion to add

  Rule: Legacy AC still parses, gates, and traces coverage unchanged

    @rule-tier-convergence.NTB1.R1
    Scenario: An AC-only spec satisfies the intake-exit gate
      Given a ticket spec whose JTBD declares only an Acceptance Criterion heading
      When the intake-exit gate evaluates test-definitions creation
      Then the gate allows the creation

    @rule-tier-convergence.NTB1.R1
    Scenario: A legacy AC reference is traced as covered exactly as before
      Given a ticket spec declaring an AC and a feature scenario referencing it
      When safeword check runs
      Then the coverage report attributes the scenario to that criterion
      And no uncovered, stale, or orphan advisory is reported for it

    @rule-tier-convergence.NTB1.R1
    Scenario: An AC-shaped tag under a persona-code-R JTBD parses as an AC, never a rule
      Given a feature scenario tagged "@feat.R1.AC1"
      When safeword check runs
      Then the coverage report attributes the scenario to criterion "feat.R1.AC1"
      And no stale or orphan rule advisory is reported for "feat.R1"

    @rule-tier-convergence.NTB1.R1
    Scenario: A terminal R tag under a persona-code-R JTBD parses as that JTBD's rule
      Given a feature scenario tagged "@feat.R1.R2"
      When safeword check runs
      Then the coverage report attributes the scenario to criterion "feat.R1.R2"

    @rule-tier-convergence.NTB1.R1 @rejection
    Scenario: A legacy AC reference the spec never declared is still reported stale
      Given a ticket spec declaring an AC and a feature scenario referencing a different AC number under the same JTBD
      When safeword check runs
      Then a stale advisory names the undeclared AC reference

  Rule: Using legacy AC surfaces a plain-language deprecation nudge, never a block

    @rule-tier-convergence.NTB1.R2
    Scenario: An in-progress spec using an AC heading draws a deprecation advisory
      Given an in-progress ticket whose spec uses an AC heading
      When safeword check runs
      Then a deprecation advisory names safeword migrate-ac as the fix
      And the advisory states the AC name is retired in favor of the Rule tier

    @rule-tier-convergence.NTB1.R2
    Scenario: An in-progress feature using an AC tag draws a deprecation advisory
      Given an in-progress ticket whose feature file uses an AC lineage tag
      When safeword check runs
      Then a deprecation advisory names safeword migrate-ac as the fix

    @rule-tier-convergence.NTB1.R2 @rejection
    Scenario: A Rule-only in-progress ticket draws no deprecation advisory
      Given an in-progress ticket whose spec and feature use only Rule lineage
      When safeword check runs
      Then no deprecation advisory is reported

    @rule-tier-convergence.NTB1.R2
    Scenario: The deprecation nudge is a zero-exit advisory, not a blocking issue
      Given an in-progress ticket whose spec uses an AC heading and is otherwise healthy
      When safeword check runs
      Then the AC deprecation is reported as an advisory and not as a health issue

  Rule: The codemod rewrites .AC to .R across specs, feature tags, and ledger refs

    @rule-tier-convergence.TB1.R1
    Scenario Outline: migrate-ac rewrites an AC reference to the same-numbered Rule reference
      Given a <artifact> containing the AC reference "<before>"
      When safeword migrate-ac runs
      Then the <artifact> contains "<after>" and no longer contains "<before>"

      Examples:
        | artifact              | before                     | after                     |
        | spec heading          | #### demo.SM1.AC3          | #### demo.SM1.R3          |
        | feature tag           | @demo.SM1.AC3              | @demo.SM1.R3              |
        | test-definitions ref  | ### Scenario: demo.SM1.AC3.happy | ### Scenario: demo.SM1.R3.happy |

    @rule-tier-convergence.TB1.R1
    Scenario: A migrated declaration and its scenario reference stay linked
      Given a spec declaring an AC and a feature scenario referencing it
      When safeword migrate-ac runs
      Then the spec heading and the scenario tag both carry the same rewritten Rule id
      And safeword check reports the criterion as covered

    @rule-tier-convergence.TB1.R1 @rejection
    Scenario: The codemod leaves non-AC tokens untouched
      Given a spec whose JTBD id and Rule headings contain the letter R but no AC reference
      When safeword migrate-ac runs
      Then no heading or tag is modified

  Rule: The codemod is idempotent, previewable, and refuses collisions

    @rule-tier-convergence.TB1.R2
    Scenario: Re-running migrate-ac on already-migrated files changes nothing
      Given a project whose specs and features already use only Rule lineage
      When safeword migrate-ac runs
      Then no file is modified

    @rule-tier-convergence.TB1.R2
    Scenario: A dry run previews the rewrites without writing any file
      Given a spec and feature using AC lineage
      When safeword migrate-ac runs with the dry-run flag
      Then it reports the rewrites it would make
      And no file on disk is modified

    @rule-tier-convergence.TB1.R2 @rejection
    Scenario: An AC that would collide with an existing Rule number is refused, not renumbered
      Given a JTBD declaring both AC1 and an existing R1 heading
      When safeword migrate-ac runs
      Then it refuses to migrate that JTBD and reports the collision
      And the JTBD's headings are left unchanged
