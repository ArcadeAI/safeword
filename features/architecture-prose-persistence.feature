@architecture-prose-persistence
Feature: Per-section prose survives deterministic heals (JT852Q, layer A)

  The generated architecture doc's structural facts self-heal deterministically,
  but the per-section prose (a module's description) must survive that heal —
  otherwise the doc resets to placeholders on every structural change and can
  never accumulate real knowledge. Machine still owns the heading, the reconciled
  marker, the code-reference, and the stale/orphan markers; the prose block is
  preserved. No LLM — this is the deterministic foundation the resync skill needs.

  Rule: Prose survives a real (writing) heal — parse and render are exact inverses

    @architecture-prose-persistence.TB1.AC1
    Scenario: An unaffected section's prose is byte-identical across a writing heal
      Given a generated doc where module "auth" has the description "Handles login and tokens."
      When a new module "billing" is added and the project is healed
      Then the heal writes the document
      And module "auth" still shows exactly "Handles login and tokens."

    @architecture-prose-persistence.TB1.AC1
    Scenario: Prose survives a writing heal when the doc uses CRLF line endings
      Given a generated doc where module "auth" has the description "Handles login and tokens."
      And the document is re-encoded with CRLF line endings
      When a new module "billing" is added and the project is healed
      Then module "auth" still shows exactly "Handles login and tokens."

    @architecture-prose-persistence.NTB1.AC1
    Scenario: A multi-paragraph description survives a writing heal intact
      Given a generated doc where module "auth" has a two-paragraph description
      When a new module "billing" is added and the project is healed
      Then module "auth" still shows its full two-paragraph description

  Rule: An unchanged doc is a fixed point (no enforcement churn)

    @architecture-prose-persistence.TB1.AC1
    Scenario: Healing a doc with prose and no structural change is a no-op
      Given a generated doc where module "auth" has the description "Handles login and tokens."
      When the project is healed twice with no structural change
      Then the second heal reports unchanged
      And the document is byte-identical to before the heals

  Rule: Structure still heals while prose is kept

    @architecture-prose-persistence.TB1.AC2
    Scenario: A newly added module is born with the placeholder, not a neighbour's prose
      Given a generated doc where module "auth" has the description "Handles login and tokens."
      When a new module "billing" is added and the project is healed
      Then module "billing" shows exactly "No description yet — awaiting prose."
      And module "auth" still shows exactly "Handles login and tokens."

    @architecture-prose-persistence.TB1.AC2
    Scenario: A section whose prose was deleted falls back to the placeholder
      Given a generated doc where module "auth" has the description "Handles login and tokens."
      And module "auth" prose is deleted, leaving it empty
      When the project is healed
      Then module "auth" shows exactly "No description yet — awaiting prose."

    @architecture-prose-persistence.TB1.AC3
    Scenario: A structural change preserves the exact prose and flags it stale
      Given a generated doc where module "auth" has the description "Handles login and tokens."
      When the project's shape changes so module "auth" stamp lags, and it is healed
      Then module "auth" still shows exactly "Handles login and tokens."
      And module "auth" is flagged stale

    @architecture-prose-persistence.TB1.AC3
    Scenario: Re-healing an already-stale section keeps prose and one stale marker
      Given a generated doc where module "auth" is already flagged stale with the description "Handles login and tokens." preserved
      When a new module "billing" is added and the project is healed
      Then module "auth" still shows exactly "Handles login and tokens."
      And module "auth" carries exactly one stale marker

  Rule: Persistence applies to every doc that carries per-section prose

    @architecture-prose-persistence.NTB1.AC1
    Scenario: A monorepo leaf doc preserves its prose across a writing heal
      Given a monorepo leaf package whose module "api" has the description "REST surface."
      When a new module is added to that leaf and the project is healed
      Then the leaf's module "api" still shows exactly "REST surface."

    @architecture-prose-persistence.NTB1.AC1
    Scenario: The derived root index has no per-node prose to preserve
      Given a monorepo whose root index lists its packages
      When the project is healed with no structural change
      Then the root index is left unchanged
