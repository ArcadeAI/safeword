# BDD source for ZFGWS1 (retro recall — delta re-arm + sonnet + async hook +
# signature dedupe). Proven by the vitest suite (tests named
# `retro-recall-delta-rearm.*` / co-located `*.test.ts` under src/retro,
# templates/hooks, and tests/hooks), whose unit + wiring scenarios mock only the
# process boundaries (the `claude -p` subprocess, the GitHub transport, the
# offset-state fs) — a shape the cucumber black-box lane can't drive. `@manual`
# excludes it from the cucumber acceptance lane while keeping it readable by
# codify / review-spec / safeword check.
@retro-recall-delta-rearm @manual
Feature: Retro recall — delta re-arm + sonnet + async hook + signature dedupe

  The invisible retro fires more than once per session; each fire digests only the
  NEW transcript since the last fire's offset (a pre-sliced window + small overlap),
  so the deltas tile the whole session. Extraction defaults to sonnet, the Stop
  hook is non-blocking (async), re-fires dedupe by content signature, and the
  egress guard is preserved unchanged for every window.

  Rule: Delta windows tile the whole session

    @retro-recall.SM1.AC1
    Scenario: The first fire digests from the start of the transcript
      Given a substantial session at its first Stop with no prior offset state
      When the retro decides to fire
      Then the delta window starts at offset zero, covering the whole transcript so far

    @retro-recall.SM1.AC1
    Scenario: A later fire digests only the window since the previous fire's offset
      Given offset state recording the previous fire's byte offset on a grown transcript
      When the retro fires again
      Then the digested window begins at the previous offset, not the transcript head

    @retro-recall.SM1.AC1
    Scenario: A back-half-only finding reaches the egress pipeline
      Given a grown transcript whose only friction appears after the previous fire's offset
      When the delta fire runs auto-extraction
      Then that finding reaches the egress pipeline instead of being lost to the head cap

    @retro-recall.SM1.AC1
    Scenario: The overlap re-includes the boundary so a straddling finding appears whole
      Given a finding that straddles the previous window's end boundary
      When the next delta fire builds its window
      Then the window re-includes the prior overlap region so the finding appears whole in one fire

  Rule: Extraction defaults to sonnet at both model sites

    @retro-recall.SM1.AC2
    Scenario: The runner builds the extractor with sonnet by default
      Given no retro model override in config
      When the auto-extract runner constructs the headless extraction
      Then the headless argv requests the sonnet model, not haiku

    @retro-recall.SM1.AC2
    Scenario: The headless extraction default is sonnet when no model is passed
      Given the headless extraction is invoked without an explicit model
      When it builds the argv
      Then the requested model is sonnet

    @retro-recall.SM1.AC2
    Scenario: A configured model overrides the sonnet default
      Given the retro model is configured as haiku
      When the auto-extract runner constructs the headless extraction
      Then the headless argv requests the configured haiku model

  Rule: Re-fires dedupe by content signature, not the model-generated title

    @retro-recall.SM2.AC1
    Scenario: A repeat signature under a different title opens no second issue
      Given an open issue already carries a finding's retro signature
      And a re-fire produces the same signature under a different title
      When triage processes the re-fire
      Then no new issue is created and the existing issue is matched

    @retro-recall.SM2.AC1
    Scenario: A genuinely new signature opens a new issue
      Given no open issue carries the finding's retro signature
      When triage processes the finding
      Then a new issue is created

    @retro-recall.SM2.AC1
    Scenario: The issue body embeds the searchable signature marker
      Given a finding assembled into a draft
      When the issue body is built
      Then it contains the finding's retro signature in a form signature search can match

  Rule: A stable session id reaches the extraction child

    @retro-recall.SM2.AC2
    Scenario: The resolved session id is forwarded to the child
      Given a Stop with a resolvable session id but no CLAUDE_SESSION_ID in the environment
      When the hook spawns the extraction child
      Then the child receives the resolved session id rather than the unknown fallback

  Rule: Offset state survives concurrent Stops

    @retro-recall.SM2.AC3
    Scenario: Offset state is written atomically via temp-file then rename
      Given a fire records new offset state
      When the state is persisted
      Then it is written to a temp file and renamed over the state file, never written in place

    @retro-recall.SM2.AC3
    Scenario: The recorded offset only advances across fires
      Given offset state from a previous fire
      When a later fire records its offset
      Then the recorded offset is greater than or equal to the previous offset

  Rule: The retro Stop hook is non-blocking

    @retro-recall.TB1.AC1
    Scenario: The generated Claude Stop settings register the retro hook async
      Given the generated Claude settings hooks
      When the retro Stop hook entry is inspected
      Then it is registered with async true

    @retro-recall.TB1.AC1
    Scenario: The retro Stop hook is not registered asyncRewake
      Given the generated Claude settings hooks
      When the retro Stop hook entry is inspected
      Then it does not carry asyncRewake, which would surface stderr into the chat

  Rule: Re-fire cadence is bounded and fail-open

    @retro-recall.TB1.AC2
    Scenario: Growth below the re-arm threshold holds the fire
      Given offset state from a prior fire and growth below the re-arm threshold
      When a Stop is evaluated
      Then the retro does not fire and the offset state is unchanged

    @retro-recall.TB1.AC2
    Scenario: Growth at the re-arm threshold re-fires
      Given growth at the re-arm threshold since the last fire
      When a Stop is evaluated
      Then the retro fires and records the new offset and count

    @retro-recall.TB1.AC2
    Scenario: The backstop caps total fires per session
      Given the fire count has reached the runaway backstop
      When a Stop is evaluated with further growth
      Then the retro does not fire

    @retro-recall.TB1.AC2
    Scenario: A retro child never re-fires
      Given the environment marks this process as a retro child
      When a Stop is evaluated
      Then the retro does not fire, the recursion guard taking precedence over every other gate

    @retro-recall.TB1.AC2
    Scenario: A state-write failure still fires
      Given the offset-state writer throws on persist
      When a re-fire is decided
      Then the retro still fires and does not throw

  Rule: Every delta window passes the full egress pipeline unchanged

    @retro-recall.NTB1.AC1
    Scenario: A secret in a back-half finding is redacted before filing
      Given a delta-window finding whose free text contains a secret
      When it flows through the egress pipeline
      Then the secret is redacted in the filed issue body

    @retro-recall.NTB1.AC1
    Scenario: A delta-window finding with an unresolved surface is dropped
      Given a delta-window finding naming a surface outside safeword
      When it flows through the egress pipeline
      Then it is dropped and nothing is filed
