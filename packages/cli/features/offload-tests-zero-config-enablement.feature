@wip
Feature: Enable remote verification without CI authoring

  @offload-tests.NTB1.R1
  @public-cli @surface.safeword-cli
  Rule: offload-tests.NTB1.R1 — Enabling remote verification requires no hand-authored CI workflow or translated test command

    Scenario Outline: One project option installs the managed workflow and preserves the normal test request
      Given local mode has no managed workflow or identity and a disposable repository independently records exact bundled workflow bytes
      When the builder runs `safeword project test-execution set remote-preferred` followed by `safeword project test --lane <lane>` at an eligible pushed tip
      Then the set command exits zero after exact workflow, identity and installed configuration bytes commit, the test command sends exactly one dispatch for <plan-kind> without a local plan invocation, and the builder edits no workflow or plan command
      Examples:
        | lane | plan-kind |
        | done | `test` |
        | full | `verify` |

    @rejection
    Scenario: Safeword never asks the builder to reproduce plan commands in workflow YAML
      Given a control commit and a second commit change only repository plan entries while an independent oracle records both exact resolver outputs and the managed workflow's byte digest
      When the public CLI dispatches both immutable commits and raw process events are captured
      Then the installed and executed workflow bytes remain digest-identical, each process trace equals only its commit's independently recorded resolver output, the traces differ exactly by the repository-only plan mutation, and no customer-authored workflow or translated command table is created or changed
