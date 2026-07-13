Feature: Audit checks namespace domain docs for emptiness and drift

  Audit's Project Documentation Checks reconcile the three namespace domain
  docs — personas.md, surfaces.md, glossary.md — against what the code actually
  references, and report empty scaffolds. Detection is a deterministic bash
  block in the skill; content judgment stays human-owned.

  Each "When audit runs the domain-docs check" operates on an isolated fixture
  project (its own namespace root and features/), never the live repo. The check
  keys on real reference positions and ignores HTML-commented scaffold examples:
  surface references come from Gherkin @surface tag lines in features/**; persona
  references come from spec.md `**Persona:** … (CODE)` lines after HTML comments
  are stripped; entry counts ignore `##` headings that sit inside a `<!-- … -->`
  comment. A slug or code that appears only in prose or inside a comment is not a
  reference.

  @audit-domain-docs.TB1.R1 @surface.claude-code @surface.openai-codex @surface.cursor
  Rule: audit-domain-docs.TB1.R1 — A surface referenced by a scenario tag but absent from the surfaces inventory is a drift error

    @rejection
    Scenario: Surface tag with no matching inventory entry is reported
      Given a fixture feature file with a tag line "@surface.safeword-cli"
      And the fixture surfaces.md is populated but has no entry whose heading slugifies to safeword-cli
      When audit runs the domain-docs check
      Then it reports an E008 surface-drift error naming safeword-cli

    Scenario: Every referenced surface tag resolves, including multi-word headings
      Given the fixture surfaces.md defines "## Claude Code on the Web" and "## Cursor"
      And the fixture feature files tag only @surface.claude-code-on-the-web and @surface.cursor
      When audit runs the domain-docs check
      Then it reports no surface-drift error

    Scenario: A surface defined in the inventory but referenced by no tag is not reported
      Given the fixture surfaces.md defines a surface whose slug appears in no @surface tag
      When audit runs the domain-docs check
      Then it reports no surface-drift error for that surface

    Scenario: A surface slug that appears only in prose is not treated as a reference
      Given a fixture feature file that mentions "@surface.safeword-cli" only inside a step's prose, not on a tag line
      And the fixture surfaces.md has no Safeword CLI entry
      When audit runs the domain-docs check
      Then it reports no surface-drift error

  @audit-domain-docs.TB1.R2 @surface.claude-code @surface.openai-codex @surface.cursor
  Rule: audit-domain-docs.TB1.R2 — A persona named in a spec but absent from the personas inventory is a drift error

    @rejection
    Scenario: Persona code named in a live spec Persona line but undefined is reported
      Given a fixture ticket spec.md with an uncommented line "**Persona:** Growth Marketer (GM)"
      And the fixture personas.md has no entry with code GM
      When audit runs the domain-docs check
      Then it reports an E009 persona-drift error naming GM

    Scenario: Every persona code referenced in a live spec line resolves to an inventory entry
      Given every uncommented spec.md **Persona:** code has a matching personas.md entry
      When audit runs the domain-docs check
      Then it reports no persona-drift error

    Scenario: A persona code appearing only in a commented-out spec example is not reported
      Given a fixture spec.md whose only "**Persona:** … (GM)" line sits inside an HTML comment
      And the fixture personas.md has no entry with code GM
      When audit runs the domain-docs check
      Then it reports no persona-drift error

  @audit-domain-docs.TB1.R3 @surface.claude-code @surface.openai-codex @surface.cursor
  Rule: audit-domain-docs.TB1.R3 — A domain doc with no uncommented entries is reported empty with an offer to fill it from its template

    @rejection
    Scenario: A verbatim surfaces scaffold is reported empty
      Given the fixture surfaces.md is the install scaffold, whose only "##" headings sit inside its HTML comment
      When audit runs the domain-docs check
      Then it reports a W008 empty-doc warning for surfaces.md
      And the warning names the template packages/cli/templates/surfaces-template.md to fill from

    @rejection
    Scenario: A verbatim glossary scaffold is reported empty
      Given the fixture glossary.md is the install scaffold, whose only "##" headings sit inside its HTML comment
      When audit runs the domain-docs check
      Then it reports a W008 empty-doc warning for glossary.md naming the template packages/cli/templates/glossary-template.md to fill from

    Scenario: A populated domain doc is not reported empty
      Given the fixture surfaces.md has one or more uncommented "##" entries
      When audit runs the domain-docs check
      Then it reports no empty-doc warning for surfaces.md

    Scenario: An absent domain doc is skipped, not reported empty
      Given the fixture namespace root has no surfaces.md file at all
      When audit runs the domain-docs check
      Then it reports no empty-doc warning for surfaces.md and does not error

    Scenario: An empty domain doc suppresses its own drift codes
      Given the fixture surfaces.md is an empty scaffold with no uncommented entries
      And a fixture feature file carries a tag line "@surface.safeword-cli"
      When audit runs the domain-docs check
      Then it reports the W008 empty-doc warning for surfaces.md
      And it reports no E008 surface-drift error

  @audit-domain-docs.TB1.R4 @surface.claude-code @surface.openai-codex @surface.cursor
  Rule: audit-domain-docs.TB1.R4 — Human-curated content is never reported as an error; content staleness is advisory only

    Scenario: A fully-populated, in-sync docs set produces no domain-doc findings
      Given the fixture personas.md, surfaces.md, and glossary.md are all populated
      And every referenced surface slug and persona code resolves to an entry
      When audit runs the domain-docs check
      Then it reports no domain-doc error or warning

    Scenario: Editing a curated definition changes no finding
      Given a fixture that is the in-sync docs set with one glossary term's definition reworded
      When audit runs the domain-docs check
      Then it reports the same result as the in-sync set — no E-code or W-code for that term

    Scenario: The skill instructs that glossary and description prose is advisory, never an error
      Given the installed audit skill guidance
      When a reader reaches the domain-docs check
      Then it states that glossary term meaning and persona or surface descriptions are advisory-only and never emitted as an error code
