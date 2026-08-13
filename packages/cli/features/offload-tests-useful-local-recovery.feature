@wip
Feature: Recover locally when remote prerequisites are missing

  @offload-tests.NTB1.R3
  @public-cli @surface.safeword-cli
  Rule: offload-tests.NTB1.R3 — Missing authentication, workflow availability, or a pushed revision produces a useful local recovery instead of a dead end

    Scenario Outline: A missing remote prerequisite explains and starts safe local recovery
      Given effective remote-preferred mode lacks <prerequisite> and the deterministic local plan exits 23 with stable invocation-boundary fingerprints
      When the builder runs `safeword project test --lane <lane>`
      Then no dispatch or pending record is created, output names <reason-code> and local fallback with HEAD and dirty state, the real resolver selects <plan-kind>, its unchanged plan runs exactly once, every descendant exits, and the command exits 23 with evidence-qualified local failure
      Examples:
        | prerequisite | lane | plan-kind | reason-code |
        | GitHub authentication | done | `test` | SAFEWORD_REMOTE_AUTH_UNAVAILABLE |
        | the installed managed workflow | full | `verify` | SAFEWORD_REMOTE_WORKFLOW_UNAVAILABLE |
        | a pushed branch-tip revision | done | `test` | SAFEWORD_REMOTE_REVISION_UNPUSHED |

    @rejection
    Scenario: Helpful recovery never bypasses request validation or dispatch authority
      Given a request is invalid, accepted remotely, or dispatch-indeterminate
      When Safeword chooses a recovery path
      Then it does not automatically execute the local lane

    @rejection @public-cli @surface.safeword-cli
    Scenario: Public-behavior scenarios cannot omit their declared surface tag
      Given an independent Gherkin AST walker classifies steps invoking the public CLI, builder commands, persistence, output or exit behavior
      When it compares those scenarios with inherited feature, rule and scenario tags
      Then every classified scenario inherits `@public-cli` and `@surface.safeword-cli`, inherited multi-surface scenarios are explicitly permitted, pure sandbox scenarios need only their sandbox tag, and any future mismatch fails Gherkin lint
