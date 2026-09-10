# The real generator, installed Codex runtime, status, and host-parity boundaries
# are exercised in codex-plugin-version.test.ts and
# scripts/codex-plugin-generation.test.ts rather than duplicated as Cucumber steps.
@proof.vitest
Feature: Keep cachebusted Codex plugins operational

  @cachebusted-codex.TBU1.R1
  Rule: cachebusted-codex.TBU1.R1 — Every generated Codex artifact uses one validated effective plugin version

    @surface.safeword-cli @surface.openai-codex
    Scenario Outline: An accepted effective version is stamped throughout the bundle
      Given the package version is 0.83.1
      And the requested Codex plugin version is "<version>"
      When the Codex plugin bundle is generated
      Then the plugin manifest, runtime package, generated workflow commands, bundled CLI, and profile proof name <version>

      Examples:
        | version |
        | 0.83.1 |
        | 0.83.1+codex.20260909051010 |

    @rejection @surface.safeword-cli
    Scenario Outline: An invalid or incompatible effective version is rejected before output changes
      Given the package version is 0.83.1
      And the requested Codex plugin version is "<version>"
      When the Codex plugin bundle is generated
      Then generation fails without changing the shipped bundle

      Examples:
        | version |
        | not-a-version |
        | 0.84.0+codex.20260909051010 |

  @cachebusted-codex.TBU1.R2
  Rule: cachebusted-codex.TBU1.R2 — A cachebusted bundle executes and identifies itself from its exact installed directory

    @surface.openai-codex
    Scenario: A cachebusted workflow resolves its own installed runtime
      Given the package version is 0.83.1
      And codex plugin add installed both 0.83.1 and 0.83.1+codex.20260909051010 bundles
      When the generated workflow from the cachebusted bundle runs
      Then its CLI reports 0.83.1+codex.20260909051010 from that bundle's runtime

    @surface.openai-codex
    Scenario: Profile status accepts the cachebusted bundle identity
      Given the package version is 0.83.1
      And the generated 0.83.1+codex.20260909051010 bundle is installed by codex plugin add
      When the Safeword profile status is queried
      Then status reports the installed cachebusted version without a version repair instruction

  @cachebusted-codex.SWM1.R1
  Rule: cachebusted-codex.SWM1.R1 — Default generation remains deterministic at the package version

    @surface.safeword-cli
    Scenario: Generation without an override reproduces the checked-in release bundle
      Given no effective Codex plugin version is requested
      When the Codex plugin bundle is generated
      Then the checked-in bundle matches deterministic generation at the package version

  @cachebusted-codex.SWM1.R2
  Rule: cachebusted-codex.SWM1.R2 — Claude Code and Cursor artifacts remain independent of the Codex effective version

    @surface.claude-code @surface.cursor @surface.safeword-cli
    Scenario: A Codex cachebuster does not alter other host catalogues
      Given the Claude Code and Cursor artifacts match their canonical sources
      When a cachebusted Codex plugin bundle is generated
      Then the Codex bundle names the cachebusted version while the Claude Code and Cursor artifacts remain byte-identical

  @cachebusted-codex.SWM1.R3
  Rule: cachebusted-codex.SWM1.R3 — The upstream design records a task-bound plugin-root contract without making delivery depend on it

    @surface.safeword-cli
    Scenario: The host proposal is explicit and independently adoptable
      Given the ticket design record exists at .project/tickets/0HZBXF-keep-cachebusted-codex-plugins-operational/design.md
      When its Upstream Codex contract section is validated
      Then it specifies a task-bound plugin root and states that Safeword delivery does not depend on host adoption
