@retro-rearm-timing @manual
Feature: retro re-arm timing — see the whole session, not just its opening

  The invisible retro fires extraction once, at the first Stop with
  >= SUBSTANCE_THRESHOLD tool-use events, then a once-per-session sentinel
  suppresses it forever. On a real session that first Stop lands at 0.2% in, so
  the extractor reads only the opening (0XEMEE concept test). This feature
  replaces the boolean sentinel with a re-arm gate: record the tool-use count at
  each fire, and re-fire on a later Stop once the transcript has grown by
  >= REARM_GROWTH_THRESHOLD tool-uses since the last fire. The fuller transcript
  reaches extraction; the existing occurrence ledger (RV9JT4) dedupes filings so
  re-fires never open duplicates. Fail-open and recursion-guarded as before.
  Tagged @manual — proven by vitest, excluded from the cucumber lane.

  Rule: First substantial Stop fires and records the fire-count (TB1.AC1)

    @retro-rearm-timing.TB1.AC1
    Scenario: A substantial session fires on the first qualifying Stop
      Given a transcript with at least the substance threshold of tool-use events
      And the session has not fired before
      When the re-arm decision evaluates the Stop
      Then it decides to run extraction over that transcript
      And it records the transcript's tool-use count as the last-fired count

    @retro-rearm-timing.TB1.AC1
    Scenario: A trivial session never fires
      Given a transcript below the substance threshold of tool-use events
      When the re-arm decision evaluates the Stop
      Then it decides not to run extraction
      And it records no last-fired count

  Rule: A later Stop re-fires only after enough growth (TB2.AC1)

    @retro-rearm-timing.TB2.AC1
    Scenario: A later Stop re-fires once the transcript has grown past the re-arm threshold
      Given the session last fired at a recorded tool-use count
      And the current transcript has grown by at least the re-arm growth threshold since then
      When the re-arm decision evaluates the Stop
      Then it decides to run extraction over the current, fuller transcript
      And it updates the last-fired count to the current count

    @retro-rearm-timing.TB2.AC1
    Scenario: A later Stop does not re-fire before the growth threshold (cost bound)
      Given the session last fired at a recorded tool-use count
      And the current transcript has grown by less than the re-arm growth threshold since then
      When the re-arm decision evaluates the Stop
      Then it decides not to run extraction
      And it leaves the last-fired count unchanged

    @retro-rearm-timing.TB2.AC2
    Scenario: A re-fire passes the current transcript, not the first-fire transcript, to extraction
      Given the session fired earlier on a shorter transcript
      And the transcript has since grown past the re-arm threshold with new content at its end
      When the re-arm decision re-fires
      Then the transcript handed to extraction includes the new end-of-session content

  Rule: A finding that only appears after the first fire is still surfaced (TB2.AC3)

    @retro-rearm-timing.TB2.AC3
    Scenario: A back-half finding reaches the pipeline on the re-fire
      Given the first fire ran over a transcript that did not contain a given friction
      And a later, grown transcript contains that friction near its end
      When the re-arm decision re-fires and the injected extractor reads the fuller transcript
      Then that friction is among the raw findings handed to the egress pipeline

  Rule: Re-fires never open duplicate issues (TB3.AC1)

    @retro-rearm-timing.TB3.AC1
    Scenario: A finding already filed by an earlier fire is not re-filed on a re-fire
      Given an earlier fire filed a finding with a given manifestation
      And a re-fire surfaces a finding with that same manifestation
      When the re-fire's findings pass through the occurrence ledger
      Then no duplicate issue is created for that manifestation

    @retro-rearm-timing.TB3.AC1
    Scenario: A genuinely new manifestation on a re-fire is filed
      Given an earlier fire filed a finding with a given manifestation
      And a re-fire surfaces a finding with a different manifestation
      When the re-fire's findings pass through the occurrence ledger
      Then an issue is created for the new manifestation

  Rule: Guards and fail-open behavior are preserved (NTB1.AC1)

    @retro-rearm-timing.NTB1.AC1
    Scenario: A retro headless child never fires (recursion guard)
      Given the process is a retro headless child
      When the re-arm decision evaluates the Stop
      Then it decides not to run extraction, before any other gate

    @retro-rearm-timing.NTB1.AC1
    Scenario: A failure to record the fire-count never blocks Stop
      Given recording the last-fired count will fail
      When the re-arm decision fires
      Then it still decides to run extraction
      And it does not throw

    @retro-rearm-timing.NTB1.AC2
    Scenario: The re-arm state is keyed to the resolved session id
      Given a Stop payload that resolves a session id by the documented precedence
      When the re-arm decision records a fire
      Then the last-fired count is stored under that session id
