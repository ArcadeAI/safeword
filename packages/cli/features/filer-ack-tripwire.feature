# BDD source for GH644A (#658 — filer ack + bare-drain tripwire). Proven by the
# vitest suite (unit + hook wiring; fs and the filing post seam are the only
# mocked boundaries) — hook-internal state transitions the cucumber black-box
# lane can't drive. `@manual` excludes it from the acceptance lane while keeping
# it readable by codify / review-spec / safeword check.
@filer-ack-tripwire @manual
Feature: Filer ack + bare-drain tripwire — a drained spool no longer self-certifies

  GH628F's stop gate treats a drained spool as proof of filing, and #644 G7
  observed a cooperative agent forging that ack by draining inline. The filer now
  stamps a per-signature ack (naming the issue) before draining, and the gate
  converts an unacked removal into one deduped self-report signal — destroyed
  findings become counted telemetry, never silence, and honest filing is never
  punished.

  Rule: Unacked removals trip once per batch; acked or pending removals stay silent

    @filer-ack-tripwire.SM1.AC1
    Scenario: A dispatched signature vanishing without an ack captures one RetroBareDrain signal
      Given the gate dispatched a batch and snapshotted its signatures
      And a dispatched signature is later gone from the spool with no ack recorded
      When the gate evaluates again
      Then exactly one RetroBareDrain self-report signal is captured for the batch

    @filer-ack-tripwire.SM1.AC1
    Scenario: A tripped batch does not trip again
      Given a batch that already captured its RetroBareDrain signal
      When the gate evaluates again with the same unacked removal
      Then no further signal is captured

    @filer-ack-tripwire.SM1.AC1
    Scenario: A new dispatched batch re-arms the tripwire after an earlier trip
      Given a batch that already tripped
      And a new batch is dispatched and snapshotted
      When the new batch suffers an unacked removal
      Then a new RetroBareDrain signal is captured for the new batch

    @filer-ack-tripwire.SM1.AC2
    Scenario: Removals covered by shape-valid ack lines trip nothing
      Given every removed dispatched signature has a shape-valid ack line
      When the gate evaluates again
      Then no RetroBareDrain signal is captured

    @filer-ack-tripwire.SM1.AC2
    Scenario: Torn ack lines are skipped; the partially acked batch still trips once
      Given two dispatched signatures both gone from the spool
      And an ack file mixing torn lines with one shape-valid ack for the first
      When the gate evaluates again
      Then one RetroBareDrain signal is captured for the batch and no error is raised

    @filer-ack-tripwire.SM1.AC2
    Scenario: Dispatched signatures still sitting in the spool trip nothing
      Given the gate dispatched and snapshotted a batch
      And every dispatched signature is still in the spool
      When the gate evaluates again
      Then no RetroBareDrain signal is captured

  Rule: Absent or pre-upgrade state fails open

    @filer-ack-tripwire.SM1.AC3
    Scenario Outline: Degraded marker or ack state disarms the tripwire without changing gate behavior
      Given <state>
      When the gate evaluates after the spool emptied
      Then no signal is captured and no error is raised
      And the gate's dispatch and cap decision matches GH628F semantics for the same spool state

      Examples:
        | state                                                    |
        | an attempt marker written before this feature, no snapshot |
        | a missing attempt marker                                  |
        | a corrupt, unparseable attempt marker                     |
        | no ack file and no snapshotted dispatch                   |

    @filer-ack-tripwire.SM1.AC3
    Scenario: Capture-off suppresses the tripwire; file-off alone does not
      Given an unacked removal is present at evaluation time
      Then no signal is captured when selfReport.capture is false
      And a signal is still captured when capture is true and selfReport.file is false

  Rule: The filer acks before it drains

    @filer-ack-tripwire.SM2.AC2
    Scenario: The filing seam records each ack after its post and before any drain
      Given two spooled drafts where the post succeeds for one and throws for the other
      When the filing seam runs
      Then at the moment the second post is invoked, the first ack line is already on disk while its draft is still spooled
      And the successful draft ends acked and drained; the failed draft ends unacked and spooled

    @filer-ack-tripwire.SM2.AC1
    Scenario: Shipped prompts and the guide carry the ack procedure and drain prohibition
      Given the installed filer agent definitions, the dispatch text, and the filing guide
      Then both agent definitions instruct ack-after-post-before-drain
      And the dispatch text states that only the filer drains the spool
      And the guide's inline-fallback section documents appending the signature-and-issue ack record

  Rule: The tripwire observes; it never surfaces or loops

    @filer-ack-tripwire.TB1.AC1
    Scenario: A tripped evaluation emits nothing and decides exactly as an ack-clean one
      Given a bare drain that trips at this evaluation, driven through the real Stop hook entry
      When the hook returns
      Then its output contains no continuation and no context line
      And the dispatch decision equals what an ack-clean evaluation of the same spool state returns

    @filer-ack-tripwire.TB1.AC1
    Scenario: The captured signal is allowlist-shaped and the retro spool is untouched
      Given a tripped bare drain
      Then the captured record carries errorClass RetroBareDrain with allowlist-only fields deduping to one signature group
      And the retro draft spool contents are byte-identical before and after the trip
