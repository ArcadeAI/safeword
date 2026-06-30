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
    Scenario: The first fire digests the whole transcript so far under the digest cap
      Given a substantial session at its first Stop with no prior offset state
      When the retro decides to fire
      Then the delta window is the whole transcript so far and the digest cap applies to that whole

    @retro-recall.SM1.AC1
    Scenario: A later fire digests only the window since the previous fire's offset
      Given offset state recording the previous fire's byte offset on a grown transcript
      When the retro fires again
      Then the digested window begins at the previous offset minus the overlap, not at the transcript head

    @retro-recall.SM1.AC1
    Scenario: A back-half-only finding beyond the head cap is filed by the delta fire
      Given a transcript larger than the digest cap whose only friction appears after the previous fire's offset
      When safeword retro runs the delta fire over the window since that offset
      Then an issue carrying that finding's signature is filed, which a head-capped fire would have missed

    @retro-recall.SM1.AC1
    Scenario: The window re-includes the overlap region before the previous offset
      Given offset state recording the previous fire's byte offset
      When the next delta fire builds its window
      Then the window start index is the previous offset minus the overlap size, clamped at zero, so a boundary-straddling entry is contained in full

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

    @retro-recall.SM2.AC1
    Scenario: A fuzzy signature-search near-miss is rejected by the exact filter
      Given signature search returns an issue whose body carries a different retro signature
      When triage filters the search results
      Then that issue is not treated as a match and a new issue is created

  Rule: A stable session id reaches the extraction child

    @retro-recall.SM2.AC2
    Scenario: The resolved session id is forwarded to the child
      Given a Stop with a resolvable session id but no CLAUDE_SESSION_ID in the environment
      When the hook spawns the extraction child
      Then the child receives the resolved session id rather than the unknown fallback

    @retro-recall.SM2.AC2
    Scenario: No session id resolves, so nothing is filed under the unknown fallback
      Given a Stop where no session id resolves from the input or the environment
      When the hook evaluates the retro
      Then the retro does not fire and nothing is filed under an unknown session id

  Rule: Offset state survives concurrent Stops

    @retro-recall.SM2.AC3
    Scenario: Offset state is written atomically via temp-file then rename
      Given a fire records new offset state
      When the state is persisted
      Then it is written to a temp file and renamed over the state file, never written in place

    @retro-recall.SM2.AC3
    Scenario: A later sequential fire strictly advances the recorded offset
      Given a fire recorded an offset over a transcript that then grows
      When a later fire records its offset
      Then the new recorded offset is strictly greater than the prior offset

    @retro-recall.SM2.AC3
    Scenario: A concurrent reader never sees a torn state file
      Given an offset-state write whose temp file is written but not yet renamed
      When another Stop reads the offset state
      Then it reads either the complete prior state or the complete new state, never a partial one

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
    Scenario: A first Stop below the substance threshold does not fire
      Given a first Stop with no prior offset state and tool-uses below the substance threshold
      When a Stop is evaluated
      Then the retro does not fire and no offset state is written

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
      And growth at or above the re-arm threshold since the last fire
      When a Stop is evaluated
      Then the retro does not fire, the recursion guard taking precedence over the armed re-fire

    @retro-recall.TB1.AC2
    Scenario: A state-write failure still fires and leaves the offset unchanged
      Given the offset-state writer throws on persist
      When a re-fire is decided
      Then the retro still fires without throwing and the recorded offset is unchanged

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
