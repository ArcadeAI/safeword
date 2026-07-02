# BDD source for 7D8PJP (invisible retro — Claude/cloud path). Proven by the
# vitest suite (tests named `invisible-retro-claude.*` under src/retro and
# tests/hooks), whose command/hook-level scenarios mock the `claude -p` subprocess
# and the GitHub transport boundaries — a shape the cucumber black-box lane can't
# drive. `@manual` excludes it from the cucumber acceptance lane while keeping it
# readable by codify / review-spec / safeword check.
@invisible-retro-claude @manual
Feature: Invisible retro — synchronous headless claude -p extraction

  Runs the retro session-retrospective out-of-band, in a separate isolated
  headless `claude -p` session launched by the Stop hook, instead of injecting
  `additionalContext` into the user's conversation. Works in a Claude cloud
  session, preserves the egress guard unchanged, and files via the environment's
  own GitHub access.

  Rule: The retro trigger never touches the user's conversation

    @invisible-retro-claude.TB1.AC1
    Scenario: invisible-retro-claude.TB1.AC1.stop_hook_emits_no_conversation_context
      Given a substantial Claude session at Stop
      When the retro stop hook runs
      Then it writes no `hookSpecificOutput.additionalContext`
      And it writes no other conversation-visible output on stdout

    @invisible-retro-claude.TB1.AC1
    Scenario: invisible-retro-claude.TB1.AC1.fail_open_stays_silent_when_extraction_errors
      Given a substantial Claude session at Stop
      And the headless extractor exits non-zero or returns invalid JSON
      When the retro stop hook runs
      Then it writes no `hookSpecificOutput.additionalContext`
      And it does not throw or block Stop (exits zero)
      And it files nothing

    @invisible-retro-claude.TB1.AC2
    Scenario: invisible-retro-claude.TB1.AC2.extraction_runs_as_an_out_of_band_subprocess
      Given a substantial Claude session at Stop
      When the retro stop hook decides to run
      Then it spawns a separate `claude -p` subprocess given the transcript digest as input
      And the subprocess runs from a neutral cwd, not appending to the user's transcript

  Rule: It authenticates and completes in a Claude cloud session

    @invisible-retro-claude.TB2.AC1
    Scenario: invisible-retro-claude.TB2.AC1.headless_argv_omits_bare_flag
      Given the Claude headless extractor argv is constructed
      Then it contains `-p` and `--output-format json`
      And it does not contain `--bare`
      And `--allowed-tools` permits `Read` and excludes write and Bash tools

    @invisible-retro-claude.TB2.AC2
    Scenario: invisible-retro-claude.TB2.AC2.extraction_runs_synchronously
      Given the retro stop hook decides to run
      When extraction is invoked
      Then the hook awaits the extraction to completion before returning
      And it does not detach the extraction as a background process

    @invisible-retro-claude.TB2.AC3
    Scenario: invisible-retro-claude.TB2.AC3.large_transcript_is_digested_before_extraction
      Given a transcript larger than the digest cap containing the assistant marker "MARKER_X" and a tool-use named "TOOL_Y"
      When the digest is built
      Then the digest is at or below the cap
      And the digest contains "MARKER_X" and "TOOL_Y"
      And the digest omits an oversized raw tool-result body present in the transcript

  Rule: The egress guard is unchanged and still fails closed

    @invisible-retro-claude.NTB1.AC1
    Scenario: invisible-retro-claude.NTB1.AC1.auto_extracted_findings_pass_the_egress_guard
      Given `safeword retro --auto-extract` with the extractor returning a finding
      And the finding's free-text contains a secret and a customer path
      When the command runs with the GitHub transport mocked
      Then the assembled body contains neither the secret nor the customer path
      And a finding whose `safeword_surface` does not resolve is dropped, not filed

    @invisible-retro-claude.NTB1.AC2
    Scenario: invisible-retro-claude.NTB1.AC2.hook_early_returns_under_retro_child_sentinel
      Given the environment has `SAFEWORD_RETRO_CHILD=1`
      When the retro stop hook runs
      Then it returns immediately without invoking extraction
      And the headless extractor is spawned with `SAFEWORD_RETRO_CHILD=1` set

  Rule: Filing uses the environment's GitHub access, gated once per session

    @invisible-retro-claude.SM1.AC1
    Scenario: invisible-retro-claude.SM1.AC1.filing_succeeds_without_a_github_token
      Given no `GITHUB_TOKEN` is present but an agent GitHub transport is available
      When `safeword retro --auto-extract` files a finding
      Then the assembled, sanitized artifact is written via the agent transport
      And the command does not fail for lack of a token

    @invisible-retro-claude.SM1.AC1
    Scenario: invisible-retro-claude.SM1.AC1.token_present_uses_the_rest_transport
      Given a `GITHUB_TOKEN` is present
      When `safeword retro --auto-extract` files a finding
      Then the write is performed by the existing REST transport

    @invisible-retro-claude.SM1.AC2
    Scenario: invisible-retro-claude.SM1.AC2.extraction_fires_once_when_sentinel_unset
      Given a substantial session whose once-per-session sentinel is not set
      When the retro stop hook runs
      Then it invokes extraction exactly once
      And it sets the once-per-session sentinel

    @invisible-retro-claude.SM1.AC2
    Scenario: invisible-retro-claude.SM1.AC2.extraction_fires_at_most_once_per_session
      Given the once-per-session sentinel is already set for this session
      When the retro stop hook runs again
      Then it does not invoke extraction a second time
