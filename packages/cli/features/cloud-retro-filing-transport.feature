# BDD source for BNGK9W (cloud retro filing — try-REST-then-agent-subagent). Proven
# by the vitest suite (unit + wiring; the GitHub REST transport, the agent/MCP
# filing seam, and the spool fs are the only mocked boundaries) — a shape the
# cucumber black-box lane can't drive. `@manual` excludes it from the acceptance
# lane while keeping it readable by codify / review-spec / safeword check.
@cloud-retro-filing-transport @manual
Feature: Cloud retro filing — try-REST-then-agent-subagent transport

  The invisible retro files directly via REST when a token works (silent), and in a
  cloud container where the REST token 401s it spools the post-egress drafts and
  lets the live agent file them via its GitHub MCP — so findings reach the tracker
  where most real sessions run, without a mid-turn hijack and without leaking raw
  text to disk.

  Rule: Transport selection files locally and defers in cloud

    @cloud-retro-filing.SM1.AC2
    Scenario: A valid token files directly via REST and surfaces nothing
      Given a substantial session whose REST transport has a valid token
      When the retro files its drafts
      Then all drafts are filed via REST and drained from the spool
      And no fallback line is surfaced to the conversation

    @cloud-retro-filing.SM1.AC1
    Scenario: A REST failure leaves the drafts spooled for the agent path
      Given a substantial session whose REST transport rejects with an auth error
      When the retro attempts to file its drafts
      Then the sanitized drafts remain in the session spool
      And the outcome signals that agent filing is needed

    @cloud-retro-filing.SM1.AC1
    Scenario: A partial REST result marks only the drafts REST actually filed
      Given two spooled drafts where REST files one and rejects the other with an auth error
      When the retro files its drafts
      Then a fresh read of the persisted spool yields only the rejected draft
      And the outcome signals that agent filing is needed for the rejected draft

  Rule: Findings from a cloud session reach the tracker

    @cloud-retro-filing.SM1.AC1
    Scenario: The filing subagent posts each spooled draft body verbatim
      Given a session spool holding two sanitized drafts the REST path could not file
      When the agent filing path files them through the mocked agent transport
      Then the transport receives exactly two posts
      And each post's body byte-equals the corresponding spooled draft body, signature marker included

    @cloud-retro-filing.SM1.AC1
    Scenario: A draft the subagent could not post stays spooled for the next boundary
      Given a session spool holding two unfiled drafts
      When the agent filing path posts one draft successfully and the other post throws
      Then a fresh read of the persisted spool yields only the draft that failed to post
      And a later boundary still surfaces exactly one line for the remaining draft

  Rule: No duplicates across the fallback

    @cloud-retro-filing.SM1.AC3
    Scenario: A filed draft is drained from the persisted spool
      Given a spool holding two drafts, one of which has been filed and marked filed
      When a fresh read of the persisted spool is taken
      Then the re-read spool yields only the unfiled draft

    @cloud-retro-filing.SM1.AC3
    Scenario: A boundary with no unfiled drafts neither re-nudges nor re-files
      Given every spooled draft for the session has been marked filed
      When a later session boundary evaluates the spool
      Then no fallback line is surfaced
      And nothing is filed again

  Rule: The cloud fallback stays near-invisible

    @cloud-retro-filing.TB1.AC1
    Scenario: Extraction and spooling add nothing to the conversation
      Given the async Stop hook runs extraction and spools the drafts
      When the hook completes
      Then the drafts are present in the persisted spool
      And the hook writes no conversation-visible output

    @cloud-retro-filing.TB1.AC2
    Scenario: Unfiled drafts at a boundary surface exactly one factual line
      Given the session spool holds several unfiled drafts
      When a session boundary evaluates whether to nudge
      Then exactly one line is surfaced, referencing the count of unfiled drafts

    @cloud-retro-filing.TB1.AC2
    Scenario: No unfiled drafts means the boundary stays silent
      Given the session spool holds no unfiled drafts
      When a session boundary evaluates whether to nudge
      Then no line is surfaced

    @cloud-retro-filing.TB1.AC2
    Scenario: The fallback line is a statement, not an imperative
      Given the session spool holds unfiled drafts
      When the fallback line is built
      Then the line contains none of the imperative markers run, file, please, you must, or should
      And the line names the unfiled-draft fact — the count and where the drafts are

    @cloud-retro-filing.TB1.AC2
    Scenario: The fallback nudges once per unfiled batch
      Given unfiled drafts were surfaced once and their batch marker was persisted
      When a fresh boundary evaluation reads the same set of unfiled draft signatures
      Then no line is surfaced

    @cloud-retro-filing.TB1.AC2
    Scenario: A batch that gains a new unfiled draft nudges again
      Given unfiled drafts were surfaced once and their batch marker was persisted
      When a newly-spooled unfiled draft joins the batch and a fresh boundary evaluates it
      Then exactly one line is surfaced again

  Rule: No leak on disk

    @cloud-retro-filing.NTB1.AC1
    Scenario: Only post-egress draft fields reach the spool
      Given a raw finding carrying a secret and a customer path
      When it flows through the egress pipeline and its draft is spooled
      Then the spool file contains only the sanitized signature, title, body, and labels
      And the spool file contains neither the secret nor the customer path
