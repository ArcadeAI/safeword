Feature: Install the boundary gate into host repos (ZJMZ50, #810 child 2)

  Setup and upgrade wire `safeword boundary` into a host repo's git hooks:
  marker-guarded shim lines for husky hosts, copy-paste snippets for hook
  managers safeword won't auto-edit, silence everywhere hooks could never
  fire. Warn-only by contract — an installed shim can never block a commit
  or push.

  @host-repo-boundary-install.TB1.R1
  Rule: host-repo-boundary-install.TB1.R1 — A husky host gains the commit and push shims without losing a byte of its own hook content

    Scenario: Setup appends both shims to existing husky hooks
      Given a husky host whose pre-commit hook runs the team's own linter
      When safeword setup runs
      Then the pre-commit hook still contains the team's linter line
      And the pre-commit hook contains the boundary commit shim
      And the pre-push hook contains the boundary push shim

    Scenario: Setup creates a missing hook file beside an existing one
      Given a husky host with a pre-commit hook but no pre-push hook
      When safeword setup runs
      Then the pre-push hook exists and contains the boundary push shim

    @rejection
    Scenario: Conflicting manager signals do not get a silent shim
      Given a host carrying both a .husky directory and a lefthook config
      And git's hooks path points outside the .husky directory
      When safeword setup runs
      Then no boundary shim is appended to the husky hooks
      And the output contains the lefthook integration snippet

  @host-repo-boundary-install.TB1.R2
  Rule: host-repo-boundary-install.TB1.R2 — Re-running setup or upgrade never duplicates a shim

    Scenario: A second setup run leaves the hooks byte-identical
      Given a husky host where safeword setup has already installed the shims
      And the pre-commit hook contains the boundary commit shim
      When safeword setup runs again
      Then the pre-commit and pre-push hooks are byte-identical to before
      And the boundary commit shim appears exactly once in the pre-commit hook

    @rejection
    Scenario: Upgrade over an installed shim adds no duplicate
      Given a husky host where safeword setup has already installed the shims
      When safeword upgrade runs
      Then the boundary commit shim appears exactly once in the pre-commit hook

  @host-repo-boundary-install.TB1.R3
  Rule: host-repo-boundary-install.TB1.R3 — A lefthook or pre-commit host gets an exact integration snippet, never an edited config file

    Scenario: Lefthook host receives a snippet and an untouched config
      Given a host managing hooks with lefthook
      When safeword setup runs
      Then the output contains a lefthook snippet invoking the boundary gate
      And the lefthook config file is byte-identical to before
      And no husky hook files are created

    Scenario: Pre-commit-framework host receives a snippet and an untouched config
      Given a host managing hooks with the pre-commit framework
      When safeword setup runs
      Then the output contains a pre-commit local-hook snippet invoking the boundary gate
      And the pre-commit config file is byte-identical to before
      And no husky hook files are created

    Scenario: Bare host is pointed at husky without any hook writes
      Given a git host with no hook manager at all
      When safeword setup runs
      Then the output recommends husky with the steps to adopt it
      And nothing is written under the git hooks directory
      And no husky directory is created

    Scenario: A host with husky merely installed but never initialized is nudged, not shimmed
      Given a host with husky in its dependencies but no .husky directory
      When safeword setup runs
      Then no husky hook files are created
      And the output recommends completing the husky setup

    @rejection
    Scenario: Pasting the printed snippet quiesces the nudge
      Given a lefthook host whose config contains the snippet exactly as setup printed it
      When safeword upgrade runs
      Then the upgrade completes successfully
      And the output contains no lefthook integration snippet

  @host-repo-boundary-install.TB1.R4
  Rule: host-repo-boundary-install.TB1.R4 — The installed shim can never block a commit or push

    Scenario Outline: The emitted shim invokes the boundary gate when the binary is present
      Given a <hook> hook file as emitted by setup, in a host whose safeword binary records its invocation
      When the hook runs under husky's strict shell with an empty PATH
      Then the boundary gate was invoked at the <boundary> boundary

      Examples:
        | hook       | boundary |
        | pre-commit | commit   |
        | pre-push   | push     |

    Scenario: The emitted shim passes when safeword's binary is absent
      Given a hook file as emitted by setup, in a host with no dependencies installed
      When the hook runs under husky's strict shell
      Then the hook exits successfully

    @rejection
    Scenario: The emitted shim passes even when the boundary gate crashes
      Given a hook file as emitted by setup, in a host whose safeword binary exits with an error
      When the hook runs under husky's strict shell
      Then the hook exits successfully

  @host-repo-boundary-install.TB1.R5
  Rule: host-repo-boundary-install.TB1.R5 — safeword reset removes the shims and leaves the host's own hook content intact

    Scenario: Reset restores a pre-existing hook byte-for-byte
      Given a husky host whose pre-commit hook carried the team's own linter line before setup
      And the pre-commit hook contains the boundary commit shim
      When safeword reset runs
      Then the pre-commit hook is byte-identical to its pre-setup content

    Scenario: Reset removes a hook file that setup alone created
      Given a husky host whose pre-push hook was created by setup and never edited
      And the pre-push hook contains the boundary push shim
      When safeword reset runs
      Then the pre-push hook file no longer exists

    @rejection
    Scenario: Reset spares hook lines the user added after setup
      Given a husky host whose pre-commit hook gained a user-written line after setup
      And the pre-commit hook contains the boundary commit shim
      When safeword reset runs
      Then the user-written line survives in the pre-commit hook
      And the boundary shims are gone from the pre-commit hook

  @host-repo-boundary-install.SM1.R1
  Rule: host-repo-boundary-install.SM1.R1 — Shims install, heal, and revert through the same managed-surface machinery, gated on the detected hook-manager world

    Scenario: Upgrade heals a stale shim block in place
      Given a husky host carrying a shim block from an older safeword version
      When safeword upgrade runs
      Then the pre-commit hook contains the current shim exactly once
      And no stale shim content remains

    @rejection
    Scenario: A deleted shim block returns on upgrade
      Given a husky host where the user removed the shim block after setup
      When safeword upgrade runs
      Then the pre-commit hook contains the boundary commit shim again

  @host-repo-boundary-install.SM1.R2
  Rule: host-repo-boundary-install.SM1.R2 — A host where the hooks could never fire gets no hook writes

    @rejection
    Scenario: Non-git directory gets no hook writes and no hook nudge
      Given a project directory that is not a git repository
      When safeword setup runs
      Then setup completes successfully
      And no husky hook files are written
      And the output contains no hook integration nudge

    Scenario: Setup in a monorepo subdirectory plants no dead hooks
      Given a git repository whose root is above the setup directory
      When safeword setup runs
      Then no husky hook files are written beneath the setup directory
      And the output notes that git hooks belong at the repository root
