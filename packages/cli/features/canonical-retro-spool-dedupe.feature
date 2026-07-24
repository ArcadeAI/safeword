@manual @canonical-retro-spool-dedupe
Feature: Keep cloud-spooled retro filing from bypassing duplicate checks

  Cloud filing receives code-assembled drafts. It preserves their canonical
  identity and applies the same exact merge authority as direct CLI triage.

  @canonical-retro-spool-dedupe.SWM1.R1
  Rule: canonical-retro-spool-dedupe.SWM1.R1 — New cloud spool records retain the code-owned canonical identity

    @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A current spooled draft round-trips its canonical signature
      Given a code-assembled draft with a canonical signature
      When the cloud filing spool is written and read
      Then the draft retains that canonical signature

    @rejection @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A malformed canonical signature spool field rejects the spool line
      Given a spool line whose canonical signature is not a string
      When the cloud filing spool is read
      Then the malformed line is not offered for filing

  @canonical-retro-spool-dedupe.SWM1.R2
  Rule: canonical-retro-spool-dedupe.SWM1.R2 — Cloud filing uses a canonical identity only when it agrees with the code-owned body marker

    @rejection @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A canonical field that differs from the body marker cannot select an issue
      Given a sealed spooled draft whose canonical field differs from its exact body marker
      When the cloud filer processes the draft
      Then it does not acknowledge an issue selected by the mismatched canonical field

    @rejection @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A missing canonical body marker disables canonical fallback
      Given a sealed spooled draft whose body has no canonical marker for its canonical field
      When the cloud filer processes the draft
      Then it does not acknowledge an issue selected by the canonical field

    @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A legacy match remains usable when canonical fallback is disabled
      Given a sealed spooled draft with a mismatched canonical field and an open issue with its exact legacy marker
      When the cloud filer processes the draft
      Then it comments only on the legacy-marker issue

  @canonical-retro-spool-dedupe.SWM1.R3
  Rule: canonical-retro-spool-dedupe.SWM1.R3 — Cloud filing uses exact legacy-first canonical matching without title guesses

    @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A legacy match takes precedence over a canonical match
      Given a spooled draft whose legacy marker and canonical marker each match a different open issue
      When the cloud filer processes the draft
      Then it comments only on the legacy-marker issue without creating a new issue
      And the canonical-marker issue receives no acknowledgement

    @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A canonical recurrence is acknowledged on its existing issue
      Given a spooled draft with no matching legacy signature and an open issue with its exact canonical marker
      When the cloud filer processes the draft
      Then it comments on that issue without creating a new issue

    @rejection @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A same-title issue without an exact marker is not acknowledged
      Given a spooled draft and an open issue with the same title but no exact matching marker
      When the cloud filer processes the draft
      Then it creates a new issue
      And the same-title issue receives no acknowledgement

    @rejection @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A pull request marker is not acknowledged as an issue
      Given a spooled draft whose exact marker appears only on a pull request
      When the cloud filer processes the draft
      Then it creates a new issue
      And the pull request receives no acknowledgement

    @rejection @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A closed issue marker is not acknowledged
      Given a spooled draft whose exact marker appears only on a closed issue
      When the cloud filer processes the draft
      Then it creates a new issue
      And the closed issue receives no acknowledgement

    @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: The shipped Claude/Cursor filer agent and Codex plugin filer skill direct the current spool contract
      Given a current JSONL spool line read by the executable spool reference
      When the Claude/Cursor filer agent and Codex plugin filer skill are loaded
      Then each directs an exact legacy-marker search first and a canonical-marker fallback only when supplied
      And each limits candidates to open issues and never uses a title match as duplicate authority

  @canonical-retro-spool-dedupe.SWM1.R4
  Rule: canonical-retro-spool-dedupe.SWM1.R4 — Older spool records remain fileable through legacy signature matching

    @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: A legacy spooled draft is acknowledged by its legacy signature
      Given a legacy spool line without a canonical signature and an open issue with its exact legacy marker
      When the cloud filer processes the draft
      Then it comments on the existing issue

    @rejection @surface.claude-code-on-the-web @surface.openai-codex-cloud
    Scenario: An unmatched legacy draft is filed as new
      Given a legacy spool line without a canonical signature and no issue with its exact legacy marker
      When the cloud filer processes the draft
      Then it creates a new issue
      And no existing candidate receives an acknowledgement
