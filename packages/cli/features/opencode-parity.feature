@wip
Feature: Give OpenCode builders full Safeword protection

  @opencode-parity.TBU1.R1
  Rule: opencode-parity.TBU1.R1 — Explicit OpenCode selection installs its native catalogue and guard without changing defaults

    @surface.opencode @surface.safeword-cli
    Scenario Outline: Explicit OpenCode selection installs a complete non-empty Safeword catalogue
      Given a project with no OpenCode Safeword assets
      When the builder installs Safeword for OpenCode
      Then the non-empty observed `<catalogue-path>/*.md` file set equals its canonical inventory by name

      Examples:
        | catalogue-path     |
        | .opencode/commands |
        | .opencode/agents   |

    @surface.opencode @surface.safeword-cli
    Scenario: Generated OpenCode commands bind to their canonical skills
      Given the canonical action-command and skill inventories
      When Safeword generates the OpenCode command stub paths and bodies
      Then every canonical action-command has exactly one `.opencode/commands/<name>.md` stub in a non-empty complete set
      And every stub names its existing same-name canonical skill and forwards `$ARGUMENTS`
      And no stub is a symlink or contains a copied canonical skill body

    @surface.opencode @surface.safeword-cli
    Scenario: Generated OpenCode agents bind to their canonical procedures
      Given the canonical subagent and procedure inventories
      When Safeword generates the OpenCode agent stub paths and bodies
      Then every canonical subagent has exactly one `.opencode/agents/<name>.md` stub in a non-empty complete set
      And every stub names the one existing procedure target declared by that inventory entry
      And no stub is a symlink or contains a copied canonical procedure body

    @surface.opencode @surface.safeword-cli @surface.claude-code
    Scenario: OpenCode-only selection installs the shared canonical skills delivery
      Given a project with no Safeword integration assets and no `.claude/skills` delivery
      When the builder installs Safeword with `--agents=opencode`
      Then the non-empty `.claude/skills` set equals the canonical skill inventory

    @rejection @surface.opencode @surface.safeword-cli @surface.claude-code
    Scenario: OpenCode-only selection excludes Claude-owned surfaces
      Given a project with no Safeword integration assets
      When the builder installs Safeword with `--agents=opencode`
      Then shared `.claude/skills` are installed without Claude commands, agents, settings, hooks, or Claude profile integration

    @rejection @surface.opencode
    Scenario: OpenCode install leaves project plugin discovery paths non-executable
      Given pre-created `.opencode/plugin`, `.opencode/plugins`, `.opencode/command`, and `.opencode/agent` decoy directories with user siblings
      When the builder installs Safeword with `--agents=opencode`
      Then no decoy gains or loses an entry, their user siblings remain, and a non-empty complete OpenCode project catalogue exists only in `.opencode/commands` and `.opencode/agents` as declarative Markdown

    @surface.opencode @surface.safeword-cli
    Scenario Outline: Profile installation resolves the documented config root
      Given a <platform> fixture sets OPENCODE_CONFIG_DIR=<opencode-dir>, XDG_CONFIG_HOME=<xdg>, HOME=<home>, and USERPROFILE=<userprofile> with every candidate root pre-created as a named decoy
      When the builder installs Safeword for OpenCode
      Then `<expected-root>/plugins/safeword.js`, `<expected-root>/safeword/dispatcher.mjs`, and `<expected-root>/safeword/identity-v1.json` are installed
      And every candidate root other than `<expected-root>` remains byte-for-byte unchanged without any managed asset

      Examples:
        | platform       | opencode-dir | xdg   | home  | userprofile | expected-root                        |
        | Unix           | set          | set   | set   | unset       | FIXTURE_OPENCODE_CONFIG_DIR          |
        | Unix           | unset        | set   | set   | unset       | FIXTURE_XDG/opencode                 |
        | Unix           | unset        | unset | set   | unset       | FIXTURE_HOME/.config/opencode        |
        | Unix           | empty        | empty | set   | unset       | FIXTURE_HOME/.config/opencode        |
        | Unix           | empty        | set   | set   | unset       | FIXTURE_XDG/opencode                 |
        | Unix           | whitespace   | set   | set   | unset       | FIXTURE_XDG/opencode                 |
        | Unix           | unset        | whitespace | set | unset    | FIXTURE_HOME/.config/opencode        |
        | Unix           | unset        | unset | set   | set         | FIXTURE_HOME/.config/opencode        |
        | native Windows | unset        | unset | set   | set         | FIXTURE_USERPROFILE/.config/opencode |
        | native Windows | unset        | set   | set   | set         | FIXTURE_XDG/opencode                 |
        | native Windows | set          | set   | set   | set         | FIXTURE_OPENCODE_CONFIG_DIR          |
        | native Windows | whitespace   | set   | unset | set         | FIXTURE_XDG/opencode                 |
        | native Windows | whitespace   | whitespace | unset | set  | FIXTURE_USERPROFILE/.config/opencode |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: USERPROFILE alone is not a Unix config-root fallback
      Given a Unix fixture with only USERPROFILE set and named decoy roots pre-created
      When the builder installs Safeword for OpenCode
      Then installation fails action-required and no decoy, OpenCode project asset, or profile asset is created or changed

    @surface.opencode @surface.safeword-cli
    Scenario Outline: All profile lifecycle operations share one config-root resolver
      Given an injected Unix XDG profile fixture prepared for <operation>, a pre-created HOME decoy root, and a recording filesystem-access port
      When the builder runs `<operation>` for OpenCode
      Then among candidate profile roots only `FIXTURE_XDG/opencode` is inspected or changed and the HOME decoy remains byte-for-byte unchanged

      Examples:
        | operation |
        | install   |
        | uninstall |
        | status    |
        | conformance |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Lifecycle operations fail safely when no config root can be resolved
      Given OPENCODE_CONFIG_DIR, XDG_CONFIG_HOME, HOME, and USERPROFILE are unset with named decoy roots and literal fallback traps pre-created
      When the builder runs `<operation>` for OpenCode
      Then the operation <outcome>, no decoy or literal fallback trap is created or changed, and no OpenCode project asset is created or changed

      Examples:
        | operation | outcome                                             |
        | install   | fails action-required                               |
        | uninstall | reports action-required                             |
        | status    | reports action-required with one config-root action |
        | conformance | reports action-required without evidence           |

    @rejection @surface.safeword-cli
    Scenario: Omitted selection does not enroll OpenCode
      Given a project with no OpenCode Safeword assets
      When the builder installs Safeword without selecting an integration
      Then Claude and Codex assets are delivered successfully and no OpenCode asset is created

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Ambient OpenCode evidence does not imply selection
      Given OpenCode is on PATH and the project has authored opencode.json and stray `.opencode` content
      When the builder installs Safeword without selecting an integration
      Then Claude and Codex assets are delivered and no Safeword-managed OpenCode asset is created

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Omitted status selection neither reports nor probes OpenCode
      Given ambient OpenCode evidence and a recording OpenCode executable spy exist
      When the builder runs `safeword status`
      Then status reports only the default selected integrations and the OpenCode spy records no execution

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Explicit OpenCode selection does not become a persisted default
      Given a completed explicit OpenCode install and a recording OpenCode executable spy
      When the builder runs `<omitted-selection-command>` with `--agents` omitted
      Then <default-only-result>, the OpenCode spy records no execution, and existing OpenCode assets remain byte-for-byte unchanged

      Examples:
        | omitted-selection-command | default-only-result                                      |
        | safeword install          | only default Claude and Codex assets are reconciled      |
        | safeword status           | only default Claude and Codex integrations are reported  |
        | safeword plan install     | only default Claude and Codex effects are planned        |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Default install leaves prior explicit OpenCode project assets untouched
      Given a prior explicit OpenCode install has recognized retired and drifted managed command and agent stubs
      When the builder runs `safeword install` with `--agents` omitted
      Then those recognized OpenCode stubs are neither rewritten nor swept and only Claude and Codex surfaces are reconciled

    @rejection @surface.opencode @surface.openai-codex @surface.safeword-cli
    Scenario: OpenCode installation does not restore retired Codex project skills
      Given Safeword-owned project skills are retired from `.agents/skills`
      When the builder installs Safeword for OpenCode
      Then OpenCode assets are installed, no Safeword-owned `.agents/skills` entry is created, and Codex remains packaged-plugin delivered

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: OpenCode lifecycle preserves user configuration
      Given a completed managed OpenCode installation alongside user-authored project and profile opencode.json files
      When the builder <operation> Safeword for OpenCode
      Then both opencode.json files remain byte-for-byte unchanged

      Examples:
        | operation  |
        | installs   |
        | uninstalls |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: OpenCode install does not create absent user configuration
      Given the project and profile have no opencode.json
      When the builder installs Safeword for OpenCode
      Then the managed profile guard is installed and no opencode.json is created

    @rejection @surface.safeword-cli
    Scenario: Unknown integration selection is rejected
      Given no OpenCode Safeword assets are installed
      When the builder installs Safeword with an unknown `--agents` value
      Then installation fails without creating any integration asset

  @opencode-parity.TBU1.R2
  Rule: opencode-parity.TBU1.R2 — Covered OpenCode tool calls are denied before violating an active gate

    @surface.opencode
    Scenario Outline: Covered tool inputs reach the canonical pre-tool guard
      Given a shared independently pinned canonical PreToolUse envelope fixture and a valid covered OpenCode operation with a randomized sentinel side effect
      When OpenCode requests a covered <tool-kind> operation that <gate-result>
      Then the dispatcher envelope equals the pinned fixture with <mapped-input> in <canonical-slot> and the operation <operation-result>

      Examples:
        | tool-kind | mapped-input                    | canonical-slot | gate-result        | operation-result                         |
        | bash      | exact command                   | command        | satisfies the gate | proceeds and changes its sentinel target |
        | bash      | exact command                   | command        | violates the gate  | is denied with its sentinel unchanged    |
        | shell     | exact command                   | command        | satisfies the gate | proceeds and changes its sentinel target |
        | shell     | exact command                   | command        | violates the gate  | is denied with its sentinel unchanged    |
        | edit      | exact filePath                  | path           | satisfies the gate | proceeds and changes its sentinel target |
        | edit      | exact filePath                  | path           | violates the gate  | is denied with its sentinel unchanged    |
        | write     | exact filePath                  | path           | satisfies the gate | proceeds and changes its sentinel target |
        | write     | exact filePath                  | path           | violates the gate  | is denied with its sentinel unchanged    |
        | patch     | all Add/Update/Delete File targets | paths       | satisfies the gate | proceeds and changes its sentinel target |
        | patch     | all Add/Update/Delete File targets | paths       | violates the gate  | is denied with its sentinel unchanged    |

    @rejection @surface.opencode
    Scenario Outline: Guard failure denies closed
      Given an armed Safeword gate whose dispatcher has injected <failure-mode> and a covered operation independently proven to change its randomized target sentinel without that fault
      When OpenCode requests a covered tool operation
      Then the operation is denied before its target changes with one message that excludes command, path, dispatcher stderr, and environment values

      Examples:
        | failure-mode       |
        | spawn failure      |
        | exit 2 with an unparseable denial-reason payload |
        | timeout            |
        | unexpected exit 1  |
        | unexpected exit 127 |

    @surface.opencode
    Scenario Outline: The profile plugin honors the pinned dispatcher's exit contract
      Given a marked Safeword project and a profile plugin bound to the installed Safeword version
      When a covered operation makes the profile plugin invoke the dispatcher and it returns <dispatcher-result>
      Then the observed invocation resolves the installed version, sets `SAFEWORD_AGENT_RUNTIME=opencode`, uses exit-code denial mode, and the operation <operation-result>

      Examples:
        | dispatcher-result | operation-result                         |
        | exit 0            | proceeds and changes its intended target |
        | exit 2            | is denied before its target changes      |

    @rejection @surface.opencode
    Scenario: A policy denial exposes only a sanitized reason
      Given a marked Safeword project and randomized command, path, stderr, and environment sentinels
      When the version-pinned dispatcher denies a covered operation with exit 2
      Then OpenCode surfaces one denial reason containing none of the sensitive sentinels

    @rejection @surface.opencode
    Scenario: Covered command input is transported without a shell
      Given a randomized covered command contains semicolons, newlines, substitutions, and a sentinel side effect independently proven to occur under control shell evaluation
      When the profile plugin invokes the version-pinned dispatcher
      Then it spawns the dispatcher directly without a shell, passes the exact command only inside the canonical envelope, and the sentinel side effect is absent

    @rejection @surface.opencode
    Scenario: Every multi-target patch path reaches the canonical guard
      Given a patchText contains randomized Add, Update, and Delete targets with one gate-violating target
      When OpenCode requests that patch operation
      Then the canonical envelope contains all three exact targets, the operation is denied, and none of the sentinel targets change

    @rejection @surface.opencode
    Scenario: The profile plugin is inert outside Safeword projects
      Given OpenCode is running in a project without a Safeword project marker
      When OpenCode requests a covered tool operation
      Then the operation proceeds without spawning the Safeword dispatcher

    @rejection @surface.opencode
    Scenario: A project-less plugin load creates no activation evidence
      Given the matching managed profile plugin loads for a project without a Safeword marker
      When OpenCode activates the plugin
      Then no `safeword/activation-v1/<project-sha256>.json` record is created under the profile config root

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Marker resolution uncertainty self-disables without claiming protection
      Given the profile plugin encounters <resolution-failure> before it can classify the current project
      When OpenCode requests a covered tool operation
      Then the operation proceeds without spawning the dispatcher and `safeword/profile-error-v1.json` contains exactly schema version, Safeword version, plugin hash, error code, and observed_at with no project, session, call, path, or raw error

      Examples:
        | resolution-failure          |
        | permission failure          |
        | injected resolution timeout |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: A marker-resolution failure invalidates prior activation
      Given a bounded profile resolution-failure observation and otherwise current activation and conformance evidence
      When the builder runs `safeword status --agents=opencode`
      Then health invalidates activation and reports exactly one `safeword install --agents=opencode` action

    @surface.opencode @surface.safeword-cli
    Scenario: Successful project classification clears a prior resolution failure
      Given `safeword/profile-error-v1.json` contains a bounded resolution failure and the marked project is now readable
      When OpenCode handles a covered tool operation in that project
      Then the profile-error record is removed and one current `safeword/activation-v1/<project-sha256>.json` record is written atomically

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: A confirmed project with an unavailable dispatcher denies with repair
      Given a confirmed marked Safeword project whose identity-bound dispatcher is <dispatcher-state>
      When OpenCode requests a covered tool operation
      Then the operation is denied before its target changes with a sanitized `safeword install --agents=opencode` repair

      Examples:
        | dispatcher-state          |
        | absent                    |
        | pruned after upgrade      |
        | moved from its bound path |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Dispatcher unavailability outranks stale activation
      Given a confirmed marked project with an unavailable identity-bound dispatcher and older passing evidence
      When the builder runs `safeword status --agents=opencode`
      Then status prioritizes exactly one `safeword install --agents=opencode` action over restart

    @surface.opencode
    Scenario: The profile identity version governs every marked project
      Given the profile identity binds Safeword version A and a marked project advertises a different version B with recording dispatcher resolvers
      When OpenCode requests a covered tool operation in that project
      Then only version A's dispatcher is invoked and its decision governs the operation

    @rejection @surface.opencode
    Scenario Outline: Malformed covered-tool input denies closed
      Given an armed Safeword gate for an OpenCode project
      When OpenCode requests a covered <tool-kind> operation whose mapped input is <input-defect>
      Then the operation is denied rather than reclassified as uncovered

      Examples:
        | tool-kind | input-defect          |
        | bash      | absent command        |
        | bash      | non-string command    |
        | bash      | empty command string  |
        | shell     | non-string command    |
        | shell     | empty command string  |
        | shell     | absent command        |
        | edit      | absent filePath       |
        | edit      | non-string filePath   |
        | edit      | empty filePath string |
        | edit      | array filePath        |
        | write     | array filePath        |
        | write     | absent filePath       |
        | write     | non-string filePath   |
        | write     | empty filePath string |
        | patch     | unrecognized targets  |
        | patch     | absent patchText      |
        | patch     | non-string patchText  |
        | patch     | empty patchText       |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: An uncovered tool is observed without being presented as blocked
      Given an armed Safeword gate for an OpenCode project
      When OpenCode requests an uncovered tool operation
      Then no denial is thrown, the operation proceeds, and the call is recorded as uncovered without a blocking claim

    @surface.opencode
    Scenario: Shell lifecycle identifiers bind guard evidence to the tool call
      Given an armed Safeword gate and distinct randomized known OpenCode session and call identifiers
      When OpenCode requests an allowed shell operation
      Then the recorded hashes equal the hashes of those exact identifiers and differ from each other

    @rejection @surface.opencode
    Scenario: Activation evidence stores only hashed lifecycle identity
      Given a handled OpenCode hook contains raw session and call identifiers, command, prompt, and absolute path
      When activation evidence is persisted
      Then the record contains bound hashes and none of the raw identifiers or execution content

    @surface.opencode
    Scenario Outline: Activation evidence records OpenCode version only when known
      Given a handled OpenCode event whose runtime version is <version-state>
      When activation evidence is persisted
      Then the OpenCode version field is <field-state>

      Examples:
        | version-state | field-state                  |
        | known 1.18.23 | exactly `1.18.23`            |
        | unavailable   | omitted rather than invented |

    @surface.opencode
    Scenario: A marked project records plugin-load activation
      Given the matching managed profile plugin loads for a marked Safeword project
      When OpenCode activates the plugin before any tool call
      Then one atomically written activation record is bound to that project with event `plugin_load` and no call hash

    @surface.opencode
    Scenario Outline: OpenCode lifecycle capabilities produce their declared evidence
      Given an independently pinned OpenCode lifecycle contract expects <lifecycle-event> to be <capability>
      When the matching native OpenCode event is handled in a marked Safeword project
      Then the adapter declaration equals <capability> and activation evidence records <normalized-event> without claiming a stronger capability

      Examples:
        | lifecycle-event | capability | normalized-event |
        | session start   | observe    | session_start    |
        | prompt submit   | observe    | prompt_submit    |
        | pre tool        | block      | pre_tool         |
        | post tool       | observe    | post_tool        |
        | stop            | observe    | stop             |

    @surface.opencode @surface.safeword-cli
    Scenario: Activation evidence remains isolated between projects
      Given two marked Safeword projects share one injected OpenCode config root with current activation records
      When OpenCode handles a hook in the first project
      Then the second project's record remains byte-for-byte unchanged and both projects report current activation independently

    @rejection @surface.opencode
    Scenario: Observational lifecycle boundaries never deny
      Given a policy violation is visible only at an OpenCode post-tool or stop boundary declared observe
      When that observational event is handled
      Then evidence is recorded without throwing a denial or changing the completed operation

    @rejection @surface.opencode
    Scenario: Concurrent activation writes remain atomic
      Given two OpenCode processes reach an injected replacement barrier while writing activation for the same project
      When both writes complete
      Then one complete valid activation record remains with no partial or staging record

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Activation evidence write failure does not change the guard decision
      Given a marked Safeword project whose activation evidence destination rejects writes
      When the dispatcher <dispatcher-decision> a covered operation that <gate-result>
      Then the operation <operation-result>, the evidence failure is sanitized, and health does not claim current activation

      Examples:
        | dispatcher-decision | gate-result        | operation-result                         |
        | allows              | satisfies the gate | proceeds and changes its intended target |
        | denies              | violates the gate  | is denied before its target changes      |

  @opencode-parity.TBU1.R3
  Rule: opencode-parity.TBU1.R3 — Reconciliation preserves user content and assets still consumed by another integration

    @surface.opencode @surface.safeword-cli
    Scenario: Removing OpenCode preserves user-authored sibling content
      Given managed OpenCode assets have user-authored siblings
      When the builder runs `safeword uninstall --agents=opencode`
      Then Safeword-owned OpenCode assets are removed and user-authored siblings remain

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Singular catalogue compatibility directories remain user-owned on uninstall
      Given user-authored `.opencode/command` and `.opencode/agent` trees coexist with recognized managed plural-form stubs
      When the builder uninstalls Safeword for OpenCode
      Then the singular trees remain byte-for-byte unchanged while recognized plural-form stubs are reconciled

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Project catalogue collisions preserve user bytes
      Given `<managed-path>` contains <collision-state> user bytes at a canonical Safeword stub name
      When the builder <operation> Safeword for OpenCode
      Then the user bytes remain byte-for-byte unchanged and lifecycle reports action-required

      Examples:
        | managed-path       | collision-state             | operation  |
        | .opencode/commands | unrecognized preexisting    | installs   |
        | .opencode/agents   | unrecognized preexisting    | installs   |
        | .opencode/commands | modified formerly managed   | installs   |
        | .opencode/agents   | modified formerly managed   | installs   |
        | .opencode/commands | unrecognized preexisting    | uninstalls |
        | .opencode/agents   | unrecognized preexisting    | uninstalls |
        | .opencode/commands | modified formerly managed   | uninstalls |
        | .opencode/agents   | modified formerly managed   | uninstalls |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: A profile collision is not overwritten or removed
      Given the managed OpenCode <profile-path> contains an unrecognized user file
      When the builder <operation> Safeword for OpenCode
      Then the user file is preserved and the lifecycle reports action required

      Examples:
        | profile-path  | operation  |
        | plugin path   | installs   |
        | plugin path   | uninstalls |
        | identity path | installs   |
        | identity path | uninstalls |

    @surface.opencode @surface.safeword-cli
    Scenario: Install repairs recognized managed plugin drift
      Given the OpenCode profile contains a recognized but drifted Safeword plugin
      When the builder installs Safeword for OpenCode
      Then the plugin bytes equal the canonical plugin for the installed Safeword version, identity binds schema, Safeword version, relative path, and its SHA-256, and user siblings remain unchanged

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: A plugin without verifiable identity is handled conservatively
      Given canonical managed plugin bytes exist and the identity record is <identity-state>
      When the builder runs the OpenCode <operation> lifecycle request
      Then <outcome>
      And user siblings remain byte-for-byte unchanged with at most one next action

      Examples:
        | identity-state | operation  | outcome |
        | missing        | install   | the matching identity is repaired without changing plugin bytes or user siblings |
        | missing        | uninstall | the plugin is preserved and lifecycle reports exactly one identity repair action |
        | missing        | status    | health reports action-required with exactly one identity repair action and changes nothing |
        | unreadable     | install   | both files are preserved and lifecycle reports exactly one identity-collision action |
        | unreadable     | uninstall | both files are preserved and lifecycle reports exactly one identity-collision action |
        | unreadable     | status    | health reports action-required with exactly one identity-collision action and changes nothing |

    @surface.opencode @surface.safeword-cli
    Scenario Outline: A recognized identity without its plugin remains safely recoverable
      Given a valid recognized identity exists and its bound plugin is absent
      When the builder runs the OpenCode <operation> lifecycle request
      Then <outcome>
      And user siblings remain byte-for-byte unchanged with at most one next action

      Examples:
        | operation  | outcome |
        | install   | the bound plugin is restored atomically and user siblings remain unchanged |
        | uninstall | the orphan identity and bounded OpenCode evidence are removed while user siblings remain |
        | status    | health reports action-required with exactly one install action and changes nothing |

    @surface.opencode @surface.safeword-cli
    Scenario: Upgrade preserves user-owned OpenCode content
      Given a managed OpenCode integration with user-owned sibling content
      When the builder upgrades Safeword for OpenCode
      Then the plugin bytes equal the canonical plugin for the installed Safeword version, identity binds schema, Safeword version, relative path, and its SHA-256, and user-owned sibling content remains byte-for-byte unchanged

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Upgrade removes retired managed catalogue stubs
      Given a recognized managed OpenCode <catalogue-kind> stub no longer exists in the canonical inventory
      When the builder upgrades Safeword for OpenCode
      Then the retired managed stub is removed, user siblings remain, and the remaining non-empty managed <catalogue-kind> set equals the canonical inventory

      Examples:
        | catalogue-kind |
        | command        |
        | subagent       |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Uninstall preserves a user-modified managed plugin
      Given the installed Safeword OpenCode plugin was modified after installation
      When the builder uninstalls Safeword for OpenCode
      Then the modified plugin and its unchanged identity are preserved, lifecycle reports plugin drift action-required, and only empty Safeword-owned directories are pruned

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Repository-wide uninstall does not probe an unselected OpenCode runtime
      Given unselected OpenCode has no Safeword-managed project asset, Claude has a recognized managed project asset, and a recording OpenCode executable spy is on PATH
      When the builder runs repository-wide uninstall
      Then the Claude asset is swept while Safeword neither executes nor installs OpenCode

    @surface.opencode @surface.safeword-cli
    Scenario: Repository-wide uninstall sweeps managed OpenCode project assets without probing runtime
      Given unselected OpenCode has Safeword-managed project assets, a recognized managed profile plugin, and a recording OpenCode executable spy is on PATH
      When the builder runs repository-wide uninstall
      Then those project assets are removed without executing OpenCode and the managed profile plugin and identity remain

    @surface.opencode @surface.safeword-cli
    Scenario: Explicit OpenCode uninstall removes recognized managed assets
      Given matching managed stubs for the current project, a second marked project's managed assets, and profile plugin, identity, per-project activation, conformance, and profile-error records with user content
      When the builder runs `safeword uninstall --agents=opencode`
      Then current-project stubs, profile plugin, profile-owned dispatcher, identity, and all profile evidence bound to that removed plugin are removed while the second project's project assets and all user content remain

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: OpenCode health is read-only
      Given a resolvable OpenCode config root with plugin, identity, activation, conformance, profile-error, stale mismatched evidence, and user content
      When the builder runs `safeword status --agents=opencode`
      Then no file, directory, or evidence record is created or changed

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Profile installation fails atomically when the resolved root is not writable
      Given the injected OpenCode config root resolves and denies writes to its plugin staging destination
      When the builder installs Safeword for OpenCode
      Then installation reports action-required and leaves no partial plugin, staging file, identity, project mutation, or changed user content

    @rejection @surface.opencode @surface.github-actions-execution-sandbox
    Scenario: Interrupted profile installation leaves no loadable partial plugin
      Given a pinned real OpenCode discovery fixture, a complete managed plugin, and an upgrade interrupted before atomic replacement
      When OpenCode discovers profile plugins
      Then no partial Safeword plugin is loadable and the previous complete plugin remains intact

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Concurrent profile installs converge through one lock
      Given two installs of the same Safeword version target the same OpenCode config root
      When both installers reach an injected barrier after staging and contend for replacement
      Then both invocations report success and one complete plugin and one matching identity for that version remain with no staging file or conflict

  @opencode-parity.TBU1.R4
  Rule: opencode-parity.TBU1.R4 — A credential-free real process proves the supported OpenCode boundary

    @surface.opencode @surface.github-actions-execution-sandbox
    Scenario Outline: Pinned OpenCode proves native catalogue discovery
      Given an isolated OpenCode 1.18.23 CLI and loopback tool-capable provider
      When the builder runs `safeword conformance --agents=opencode`
      Then the real process discovers the specific installed <fixture-entry> <catalogue-kind>

      Examples:
        | catalogue-kind | fixture-entry     |
        | command        | bdd               |
        | subagent       | safeword-reviewer |
        | skill          | bdd               |

    @surface.opencode @surface.github-actions-execution-sandbox
    Scenario: Pinned OpenCode proves denial without a side effect
      Given an isolated OpenCode 1.18.23 CLI and loopback tool-capable provider
      When `safeword conformance --agents=opencode` makes the provider request the forbidden sentinel operation
      Then OpenCode surfaces the denial and the randomized sentinel file is absent

    @surface.opencode @surface.github-actions-execution-sandbox
    Scenario: The denial sentinel is capable of producing its side effect
      Given the identical isolated OpenCode conformance fixture with the Safeword gate disarmed
      When the conformance provider requests the sentinel operation
      Then the randomized sentinel file is created

    @surface.opencode @surface.github-actions-execution-sandbox
    Scenario: Pinned OpenCode invocation loads the referenced canonical skill
      Given the isolated OpenCode conformance fixture contains the generated `bdd` command and canonical `bdd` skill
      When `safeword conformance --agents=opencode` invokes `/bdd` with randomized arguments
      Then the real provider observes the canonical `bdd` skill body and the exact randomized arguments

    @rejection @surface.opencode @surface.github-actions-execution-sandbox
    Scenario Outline: The required conformance lane fails instead of skipping
      Given the pinned OpenCode fixture injects <fixture-fault> so it cannot prove <required-behavior>
      When required CI runs `safeword conformance --agents=opencode`
      Then the lane fails without recording passing conformance evidence

      Examples:
        | required-behavior     | fixture-fault                              |
        | command discovery     | withheld generated command stub           |
        | subagent discovery    | withheld generated subagent stub          |
        | skill discovery       | withheld canonical skill delivery         |
        | no-side-effect denial | disarmed policy with side-effect sentinel  |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Conformance fails safely when the OpenCode executable boundary is invalid
      Given the OpenCode executable is <executable-state>
      When the builder runs `safeword conformance --agents=opencode`
      Then no passing conformance evidence is persisted and exactly one executable-remediation action is reported

      Examples:
        | executable-state                 |
        | unresolvable                     |
        | differs from the explicitly requested fixture version |
        | exits non-zero before conformance |

    @rejection @surface.opencode @surface.github-actions-execution-sandbox
    Scenario: Persisted conformance evidence excludes sensitive execution content
      Given conformance used a randomized bearer token, prompt, command, environment, and temporary paths
      When passing conformance evidence is persisted
      Then exactly `safeword/conformance-v1/<opencode-version>-<plugin-hash>.json` contains only the bounded schema fields and none of that sensitive execution content

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Conformance evidence is rejected when a binding dimension differs
      Given passing conformance evidence whose <binding-dimension> differs from the current execution boundary
      When the builder runs `safeword status --agents=opencode`
      Then health rejects that evidence and recommends exactly `safeword conformance --agents=opencode`

      Examples:
        | binding-dimension |
        | schema version    |
        | Safeword version  |
        | OpenCode version  |
        | plugin hash       |
        | platform          |
        | architecture      |

    @surface.opencode @surface.safeword-cli
    Scenario: Bound conformance evidence does not expire by age alone
      Given passing conformance evidence matches the current platform, architecture, OpenCode version, and plugin hash
      When the builder runs `safeword status --agents=opencode` with the clock injected exactly 365 days after checked_at
      Then health still accepts the conformance evidence

    @surface.opencode @surface.safeword-cli
    Scenario: Future-dated conformance remains valid when bindings match
      Given passing conformance evidence matches every current binding and checked_at is exactly one day ahead of the injected clock
      When the builder runs `safeword status --agents=opencode`
      Then health accepts conformance and reports no conformance action

  @opencode-parity.NTB1.R1
  Rule: opencode-parity.NTB1.R1 — Health distinguishes installation, observation, and blocking capability plainly

    @surface.opencode @surface.safeword-cli
    Scenario: Healthy supported-process protection reports independent dimensions
      Given a matching profile plugin with current handled-hook activation and passing conformance
      When the builder runs `safeword status --agents=opencode`
      Then health reports `installed=true`, `activated=true`, `pre_tool=block`, `conformant=true`, and zero next actions

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: An uncovered lifecycle boundary is described as observational
      Given a matching OpenCode plugin with current handled-hook activation, passing conformance, and a stop boundary that cannot block
      When the builder runs `safeword status --agents=opencode`
      Then health reports `installed=true`, `activated=true`, `pre_tool=block`, `conformant=true`, stop advisory, and zero next actions

  @opencode-parity.NTB1.R2
  Rule: opencode-parity.NTB1.R2 — Incomplete states yield one truthful summary and at most one action

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Fully uninstalled health emits one consistent summary
      Given OpenCode has no managed profile plugin, identity, or evidence and no collision
      When the builder runs `safeword status --agents=opencode`
      Then exactly one action-required summary agrees with `installed=false` and exactly one install action

    @surface.opencode @surface.safeword-cli
    Scenario Outline: Repair priority selects one named next action
      Given OpenCode health has <simultaneous-conditions>
      When the builder runs `safeword status --agents=opencode`
      Then the result is action required with exactly one next action to <expected-action>

      Examples:
        | simultaneous-conditions                   | expected-action       |
        | a plugin collision and stale activation   | resolve the plugin collision |
        | a plugin collision and failed conformance | resolve the plugin collision |
        | a plugin collision and an identity collision | resolve the plugin collision |
        | an identity collision and managed plugin drift | resolve the identity collision |
        | an identity collision and no managed plugin | resolve the identity collision |
        | managed plugin drift and stale activation | repair plugin drift   |
        | managed plugin drift and failed conformance | repair plugin drift   |
        | no managed plugin and failed conformance  | install the plugin    |
        | no managed plugin and stale activation    | install the plugin    |
        | failed conformance and stale activation   | run conformance       |
        | stale activation with advisory stop only  | restart OpenCode      |

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Untested OpenCode versions are not called supported
      Given a stable OpenCode version without matching passing conformance
      When the builder runs `safeword status --agents=opencode`
      Then health reports unsupported with one conformance action

    @surface.opencode @surface.safeword-cli
    Scenario: Passing conformance supports its exact stable OpenCode version
      Given an injected non-baseline stable OpenCode 1.x version-reporting executable boundary and matching managed plugin identity
      When the builder runs passing conformance against that injected boundary and then status for the exact same boundary
      Then version-bound conformance evidence is persisted and health reports `conformant=true` with zero conformance actions

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: A changed managed plugin invalidates prior conformance
      Given passing conformance evidence is bound to the previously installed plugin hash
      When the builder runs `safeword status --agents=opencode` after a Safeword plugin upgrade
      Then prior conformance is not accepted and one conformance action is reported

  @opencode-parity.NTB1.R3
  Rule: opencode-parity.NTB1.R3 — Stale and observational evidence never becomes blocking proof

    @rejection @surface.opencode @surface.safeword-cli
    Scenario Outline: Invalid activation evidence remains non-current
      Given the managed plugin and conformance are valid and activation evidence is <evidence-state>
      When the builder runs `safeword status --agents=opencode`
      Then health reports a stale observation, does not promote an observational boundary, and gives one activation action

      Examples:
        | evidence-state      |
        | 7 days and 1 second old |
        | malformed           |
        | future dated        |
        | project mismatched  |
        | plugin mismatched   |
        | schema mismatched   |
        | Safeword mismatched |

    @surface.opencode @surface.safeword-cli
    Scenario: Activation at the seven-day boundary remains current
      Given bound activation evidence and a clock injected exactly seven days after observed_at
      When the builder runs `safeword status --agents=opencode`
      Then health reports current activation

    @rejection @surface.opencode @surface.safeword-cli
    Scenario: Missing activation evidence is not enforced protection
      Given the managed plugin and conformance are valid but no activation evidence exists
      When the builder runs `safeword status --agents=opencode`
      Then health reports action required and one activation action without claiming enforcement

  @opencode-parity.SWM1.R1
  Rule: opencode-parity.SWM1.R1 — Every integration declares one complete adapter contract

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario: All supported integrations satisfy the adapter registry
      Given the Claude, Codex, OpenCode, and Cursor adapters
      When the integration registry is validated
      Then the non-empty validated adapter ID set is exactly Claude, Codex, OpenCode, and Cursor
      And every adapter explicitly declares ownership, operations, capabilities, activation, and conformance including unavailable dimensions

    @rejection @surface.safeword-cli
    Scenario: An adapter without ownership declarations is rejected
      Given an adapter omits its owned and shared project surfaces
      When the integration registry is validated
      Then validation rejects the adapter before lifecycle coordination

    @rejection @surface.safeword-cli
    Scenario Outline: An adapter cannot claim a dimension it cannot honor
      Given an adapter declares <overstated-dimension> without a proof mechanism
      When the integration registry is validated
      Then validation rejects the overstated dimension

      Examples:
        | overstated-dimension |
        | activation           |
        | conformance          |

    @rejection @surface.safeword-cli @surface.claude-code
    Scenario: Generic conformance reports an unavailable adapter dimension truthfully
      Given the selected Claude adapter declares conformance unavailable
      When the builder runs `safeword conformance --agents=claude`
      Then the command reports the unavailable dimension without mutation or a passing claim

    @rejection @surface.safeword-cli
    Scenario: An injected unavailable lifecycle boundary never becomes proof
      Given an injected contract-test adapter declares one named lifecycle boundary unavailable
      When the registry status projector evaluates that adapter
      Then no activation proof is accepted for that boundary and the result reports unavailable without a capability claim or a second next action

    @rejection @surface.safeword-cli
    Scenario: The generic conformance command rejects an unknown integration
      Given the public command catalogue contains the generic conformance command
      When the builder runs `safeword conformance --agents=unknown`
      Then the command rejects the unknown selection without mutation or conformance evidence

    @surface.safeword-cli
    Scenario: Generic conformance is published as a host-neutral command
      Given the public Safeword command catalogue
      When the builder inspects `safeword --help`
      Then `safeword conformance --agents=<integration>` is listed exactly once without a host-specific alias
      And the published `--agents` value set is exactly `claude,codex,opencode,cursor`

  @opencode-parity.SWM1.R2
  Rule: opencode-parity.SWM1.R2 — Shared managed assets are removed only after their final consumer leaves

    @surface.safeword-cli @surface.claude-code @surface.opencode
    Scenario Outline: A shared asset survives while one selected consumer remains
      Given a managed skill catalogue consumed by Claude and OpenCode
      When <removed-integration> is removed while <remaining-integration> remains selected
      Then the removed integration's owned assets are gone and the retained non-empty `.claude/skills` set equals the canonical skill inventory

      Examples:
        | removed-integration | remaining-integration |
        | Claude              | OpenCode              |
        | OpenCode            | Claude                |

    @rejection @surface.safeword-cli @surface.opencode @surface.claude-code
    Scenario: The final consumer removes only Safeword-owned shared assets
      Given OpenCode is the final consumer of a managed skill catalogue with user siblings
      When OpenCode is removed
      Then reconciliation removes Safeword-owned catalogue entries and preserves user siblings

    @rejection @surface.openai-codex @surface.opencode @surface.safeword-cli
    Scenario: Codex does not retain the shared skills delivery after OpenCode leaves
      Given OpenCode is the final `.claude/skills` consumer, Codex remains selected, and user siblings exist
      When OpenCode is removed
      Then Safeword-owned `.claude/skills` entries are removed, user siblings remain, and Codex stays packaged-plugin delivered

  @opencode-parity.SWM1.R3
  Rule: opencode-parity.SWM1.R3 — Contract tests reject capability overstatement and coordinator bypass

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario: Lifecycle operations use the common adapter coordinator
      Given every supported integration is selected in a mixed lifecycle request
      When the lifecycle operation is planned
      Then the independently pinned result sequence is exactly project, Claude, Codex, OpenCode, Cursor

    @surface.safeword-cli @surface.opencode
    Scenario: OpenCode selection exposes its declared plan effects
      Given OpenCode is explicitly selected for a lifecycle plan
      When the builder runs `safeword plan install --agents=opencode`
      Then the plan includes each declared OpenCode project and profile effect exactly once

    @rejection @surface.safeword-cli @surface.opencode
    Scenario: Omitted plan selection excludes OpenCode effects
      Given ambient OpenCode evidence exists but OpenCode is not selected
      When the builder runs `safeword plan install`
      Then the plan contains Claude and Codex effects and no OpenCode effect

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Existing integration operations retain their recorded origin-main contract
      Given an immutable committed origin-main fixture for <integration> <operation> canonicalized with sorted entries, project-relative paths, a fixed clock, and a Safeword-version placeholder
      When the builder performs <operation> for <integration> through registry coordination without OpenCode selected
      Then the equivalently canonicalized CliResult and managed project tree match that named fixture byte-for-byte
      And its committed digest matches the origin-main fixture manifest

      Examples:
        | integration | operation |
        | Claude      | install   |
        | Claude      | upgrade   |
        | Claude      | check     |
        | Claude      | uninstall |
        | Codex       | install   |
        | Codex       | upgrade   |
        | Codex       | check     |
        | Codex       | uninstall |
        | Cursor      | install   |
        | Cursor      | upgrade   |
        | Cursor      | check     |
        | Cursor      | uninstall |

    @surface.safeword-cli @surface.claude-code @surface.openai-codex @surface.opencode
    Scenario: Mixed OpenCode selection preserves existing integration bytes
      Given committed origin-main install fixtures for Claude and Codex
      When the builder installs Safeword with Claude, Codex, and OpenCode selected
      Then Claude-owned and Codex-owned managed project bytes match their named fixtures byte-for-byte

    @surface.safeword-cli @surface.cursor @surface.opencode
    Scenario: OpenCode compatibility sweeping preserves the legacy Cursor sweep
      Given unselected OpenCode and Cursor both have recognized legacy managed project assets and recording executable spies for both runtimes are on PATH
      When the builder runs repository-wide uninstall
      Then both integrations' recognized managed project assets are swept without executing either runtime

    @rejection @surface.safeword-cli
    Scenario: A registered integration cannot be skipped by lifecycle coordination
      Given the integration registry includes a conforming sentinel adapter
      When a lifecycle operation selects the sentinel integration
      Then its declared lifecycle effect appears exactly once in the coordinated result

    @rejection @surface.safeword-cli
    Scenario Outline: Invalid adapter claims fail contract validation
      Given an adapter has <contract-defect>
      When the integration contract tests run
      Then the contract suite fails with the offending integration identified

      Examples:
        | contract-defect              |
        | a duplicate integration ID   |
        | an undeclared owned path      |
        | an overstated block capability |
        | a profile operation without a profile descriptor |
        | a fifth adapter operation named upgrade |
