# Contract behavior source: implementation remains pending under @wip.
# Demo journey: the @demo propagation anchor plus "Coverage includes every supported host without an author checklist",
# "A stale generated host output fails the required check", and "An impossible required guarantee produces actionable recovery".
@wip
Feature: Reduce duplicated maintenance and agent drift for Safeword maintainers

  @consistent-host-contract.SWM1.R1
  Rule: consistent-host-contract.SWM1.R1 — Shared behavior has one authoritative definition

    @demo @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode @surface.safeword-cli
    Scenario: One shared policy change reaches every applicable agent
      Given each supported exact-version runtime lane currently accepts a ticket without the newly required verification marker
      And both CLI and TUI runtime lanes are included for OpenCode V1 and V2
      And the shared verification policy now requires that marker without changes to host policy files
      When the normal derivation and conformance entry point runs without a host list
      Then Claude Code, Codex, Cursor, OpenCode V1, and OpenCode V2 each reject that ticket through the shared verification decision

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario: One shared skill change reaches every applicable agent
      Given each supported exact-version installed runtime lane loads the previous revision of a canonical Safeword skill
      And both CLI and TUI runtime lanes are included for OpenCode V1 and V2
      And only the canonical skill and its referenced guide are updated
      When the normal delivery refresh is applied without a host list
      Then Claude Code, Codex, Cursor, OpenCode V1, and OpenCode V2 each load the revised skill and resolve its revised guide without equivalent per-host authored edits

    @rejection
    Scenario: A partially propagated revision cannot satisfy the shared change
      Given a shared policy revision has reached three supported agents while one still executes the previous rule
      When the change completion evidence is evaluated
      Then completion is rejected and identifies the agent still running the previous policy

    @rejection
    Scenario: An interface that leaves parallel policy ownership does not count as consolidation
      Given a refactoring introduces a shared interface but retains independently authored equivalent host policy
      When maintenance reduction evidence is evaluated
      Then the consolidation claim is rejected and identifies the remaining parallel authoring paths

    Scenario: Completed consolidation identifies removed maintenance paths
      Given shared behavior previously required equivalent edits in multiple host policy owners
      And consolidation has replaced those owners with one shared decision and necessary host translations
      When the maintainer evaluates completion evidence
      Then the evidence identifies the removed independent authoring paths and the remaining required translations

  @consistent-host-contract.SWM1.R2
  Rule: consistent-host-contract.SWM1.R2 — Every supported agent is accounted for automatically

    @surface.safeword-cli
    Scenario: Coverage includes every supported host without an author checklist
      Given a shared behavior has a disposition for every supported host
      When the maintainer runs the required coverage check without selecting hosts
      Then the check passes with complete coverage for Claude Code, Codex, Cursor, and both supported OpenCode version lanes

    @rejection
    Scenario: A missing host disposition prevents completion
      Given one supported host has no disposition for a shared behavior
      When the required coverage check runs
      Then it rejects the change and identifies the missing behavior and host

    @rejection
    Scenario Outline: A newly shipped component cannot disappear from coverage
      Given a new canonical "<component>" is present but absent from the derived host coverage
      When the required coverage check runs
      Then it rejects the change and identifies the unaccounted component

      Examples:
        | component |
        | skill |
        | guide |
        | native command wrapper |
        | helper-agent entrypoint |

    @rejection
    Scenario: The inventory includes handlers beyond the five common events
      Given shipped session-end, asynchronous, and shell handlers have no contract classification
      When the required inventory coverage check runs
      Then it rejects the incomplete inventory and names those handlers

    @rejection
    Scenario: An explicit limitation cannot replace proof of a required guarantee
      Given every host disposition is present but one required guarantee is recorded only as unavailable
      When the change completion evidence is evaluated
      Then the affected requirement remains unmet rather than counting as proved

    @rejection @surface.opencode
    Scenario: A proved OpenCode V2 lane cannot cover an unproved V1 lane
      Given shared behavior has V2 conformance evidence but lacks the required OpenCode V1 evidence
      When the required coverage check evaluates OpenCode support
      Then the V1 lane remains incomplete even though the V2 lane passes

    @rejection
    Scenario: New host capability cannot introduce a second shared policy owner
      Given a shared behavior needs a new host capability and its adapter implements the workflow policy independently
      When the required contract coverage and ownership checks run
      Then the change is rejected with the competing shared policy owner identified

    Scenario: New host capability extends mechanics while preserving shared policy
      Given a shared behavior needs a new host capability and its adapter adds only the required host mechanics
      And the workflow decision remains owned by the canonical shared policy
      When the required contract coverage and ownership checks run
      Then the new capability is accepted with its shared policy owner and host disposition recorded

  @consistent-host-contract.SWM1.R3
  Rule: consistent-host-contract.SWM1.R3 — Required checks prevent drift and policy bypasses

    @rejection
    Scenario: A stale generated host output fails the required check
      Given one host requires generated content and its output predates a canonical skill change
      When the required generated-output check runs
      Then it fails and identifies the stale output and its repair

    Scenario: Refreshing required outputs restores agreement
      Given generated host outputs are stale after a canonical change
      When the normal derivation and generated-output validation entry point runs
      Then the check succeeds against reproducible current output

    @rejection
    Scenario: A host route cannot evade a shared denial
      Given a host integration dispatches a protected action without consulting the shared decision boundary
      When the required policy-boundary checks exercise that route
      Then the checks reject the route because the denied action reaches the side-effect boundary

    Scenario: A route applying the shared decision passes boundary validation
      Given a host route uses the shared decision boundary and blocks its denied sentinel write while permitting its allowed sentinel write
      When the required policy-boundary checks exercise that route
      Then the checks accept the route with the denied sentinel absent and the allowed sentinel containing the expected content

    @rejection
    Scenario: Independent host policy cannot become another authority
      Given a host adapter introduces its own decision implementation for an existing shared rule
      When the required policy ownership checks run
      Then the change fails with the competing rule owner identified

    @rejection
    Scenario: A package declaration cannot substitute for runtime proof
      Given a package and capability declaration are structurally valid but installed-host conformance did not run
      When release evidence is evaluated for its claimed enforcement
      Then the claim is rejected as missing runtime proof

    @rejection
    Scenario: Evidence from a different host version cannot satisfy the required target
      Given the required target is Cursor 3.24.18 but native plugin conformance passed only on Cursor 3.8.23
      When required completion evidence is evaluated
      Then the plugin claim is rejected with missing Cursor 3.24.18 evidence identified

    @rejection
    Scenario: Manual host observation cannot count as an automated check
      Given Cursor 3.24.18 IDE native plugin behavior has a successful manual observation with its tested boundary recorded
      When that observation is submitted as automated conformance evidence
      Then the automated claim is rejected and the observation remains labeled manual with its exact version and boundary

    @rejection
    Scenario: Failed required target execution cannot be replaced silently
      Given required Cursor 3.24.18 native plugin conformance failed and Cursor 3.8.23 is available
      When Safeword evaluates required plugin completion evidence
      Then the Cursor 3.24.18 plugin claim remains unmet with its failed run identified and no substitute version selected

    Scenario: Applicable automated target evidence satisfies the plugin claim
      Given required Cursor 3.24.18 IDE native plugin conformance passed automatically through the installed package
      And its current package identity, trust configuration, registration, and claimed guard boundaries match that evidence
      When Safeword evaluates required plugin completion evidence
      Then the plugin claim is accepted with its exact automated target and proved guard boundaries recorded

  @consistent-host-contract.TBU1.R1
  Rule: consistent-host-contract.TBU1.R1 — Host adaptation preserves the promised outcome

    Scenario: The strongest verified satisfying mechanism is selected
      Given two available mechanisms satisfy a behavior and shared policy ranks the second-discovered mechanism above the first
      When Safeword adapts the behavior to the selected host
      Then it selects the higher-ranked verified mechanism without asking the user to choose

    Scenario: A permitted weaker alternative reports its actual guarantee
      Given the preferred mechanism is unavailable and shared policy permits an available weaker alternative
      When Safeword adapts the behavior
      Then the alternative is used with only its permitted guarantee reported

    @rejection
    Scenario: An adapter cannot invent a weaker fallback
      Given the required mechanism is unavailable and shared policy permits no weaker alternative
      And the host adapter offers advisory guidance instead
      When Safeword evaluates the guarantee for that adapter
      Then the required guarantee remains unmet and is not reported as enforced

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario Outline: A denied action has no side effect
      Given "<host>" version "<version>" in "<runtime>" has its pre-action boundary supplied by the contracted Safeword plugin delivery
      And the shared policy denies a sentinel file write
      When that installed host attempts the write
      Then the host reports the policy denial and the sentinel file is not created

      Examples:
        | host | version | runtime |
        | Claude Code | 2.1.170 | CLI |
        | Codex | 0.160.0 | CLI |
        | Cursor | 3.24.18 | IDE |
        | OpenCode V1 | 1.18.23 | CLI |
        | OpenCode V1 | 1.18.23 | TUI |
        | OpenCode V2 | 2.0.32 | CLI |
        | OpenCode V2 | 2.0.32 | TUI |

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario Outline: An allowed action reaches the side-effect boundary
      Given "<host>" version "<version>" in "<runtime>" has its pre-action boundary supplied by the contracted Safeword plugin delivery
      And the shared policy permits a sentinel file write
      When that installed host attempts the write
      Then the sentinel file contains the permitted content

      Examples:
        | host | version | runtime |
        | Claude Code | 2.1.170 | CLI |
        | Codex | 0.160.0 | CLI |
        | Cursor | 3.24.18 | IDE |
        | OpenCode V1 | 1.18.23 | CLI |
        | OpenCode V1 | 1.18.23 | TUI |
        | OpenCode V2 | 2.0.32 | CLI |
        | OpenCode V2 | 2.0.32 | TUI |

    @rejection
    Scenario: Ticket rejection cannot masquerade as conversation continuation
      Given a host can reject a ticket-close edit but exposes only observational conversation completion
      When missing verification evidence triggers the completion policy
      Then ticket closure is rejected while automatic conversation continuation remains unproved

    @rejection
    Scenario: Conversation continuation cannot masquerade as ticket-transition enforcement
      Given a host has active proved conversation continuation but no proof that it rejects ticket-close edits
      When Safeword evaluates its completion protection
      Then ticket-transition enforcement is reported unproved while conversation continuation remains reported active

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: A supported completion guard actually continues the conversation
      Given "<host>" version "<version>" has its claimed completion guard active with continuation capacity remaining
      And the current turn is missing required verification evidence
      When the installed host attempts to finish the conversation
      Then the host continues the conversation with the unmet verification requirement instead of ending the turn

      Examples:
        | host | version |
        | Claude Code | 2.1.170 |
        | Codex | 0.160.0 |
        | Cursor | 3.24.18 |

  @consistent-host-contract.TBU1.R2
  Rule: consistent-host-contract.TBU1.R2 — Active protection is distinguished from host potential

    @surface.safeword-cli
    Scenario: Applicable activation and conformance evidence reports protection active
      Given the selected host has active trusted hooks and applicable package and runtime proof
      When the builder requests Safeword status
      Then the contracted protection is reported active with its actual guarantee

    @rejection
    Scenario Outline: Unavailable activation cannot inherit a healthy claim
      Given the selected host's required integration has protection state "<state>"
      When the builder requests Safeword status
      Then the affected protection is not reported active

      Examples:
        | state |
        | missing |
        | disabled |
        | untrusted |
        | failed |
        | unknown |
        | unsupported |

    @rejection
    Scenario Outline: Invalidated evidence cannot retain the previous protection claim
      Given protection was proved before its "<identity>" changed without renewed proof
      When the builder requests Safeword status
      Then the affected protection is reported not active with stale evidence requiring renewal

      Examples:
        | identity |
        | host version |
        | package content |
        | trust configuration |

    @rejection
    Scenario: A rejected required registration invalidates its guarantee
      Given an installed host rejects a required registration because its payload no longer matches the host schema
      When Safeword evaluates that integration's protection
      Then the affected guarantee is unavailable with the rejected registration identified

    Scenario: An optional registration failure does not conceal unrelated usable protection
      Given one optional skill registration fails while required guard registration and proof succeed
      When the builder requests Safeword status
      Then the optional skill is reported unavailable with its registration failure and the separately proved guard is reported active

    @rejection
    Scenario: Exhausted continuation cannot be advertised as unlimited enforcement
      Given a verified host continuation mechanism has reached its enforced continuation limit
      When Safeword evaluates the outstanding verification requirement
      Then verification remains unmet and another automatic continuation is not claimed

    @rejection @surface.opencode
    Scenario: OpenCode Desktop cannot inherit CLI or TUI enforcement proof
      Given OpenCode CLI and TUI have applicable proof but Desktop dispatch has not been proved
      When Safeword evaluates protection for OpenCode Desktop
      Then Desktop remains advisory without inheriting CLI or TUI enforcement claims

  @consistent-host-contract.NTB1.R1
  Rule: consistent-host-contract.NTB1.R1 — Routine host differences need no user coordination

    Scenario: Routine adaptation needs no packaging or host checklist decisions
      Given each supported agent has a verified implementation of the requested shared workflow
      When the builder requests that workflow change without naming agents or mechanisms
      Then Safeword covers every supported host without requesting packaging, hook, or fallback choices

    Scenario: Routine reevaluation does not repeat limitation warnings
      Given a permitted host alternative is already active and needs no user action
      When the workflow is evaluated again without a relevant change
      Then it proceeds through that alternative without another warning or decision request

    Scenario: Technical proof remains available on demand
      Given normal workflow execution required no host-specific coordination
      When the technical builder requests protection details
      Then the response identifies the chosen mechanism and the applicable evidence for each guarantee

    @rejection
    Scenario: A repair requiring user trust does not silently bypass authorization
      Given a required host hook needs the user's trust decision before it can run
      When Safeword attempts automatic integration recovery
      Then it directs the user to the supported trust action and does not bypass that decision

  @consistent-host-contract.NTB1.R2
  Rule: consistent-host-contract.NTB1.R2 — An unmet guarantee has an honest recovery path

    @rejection
    Scenario: An impossible required guarantee produces actionable recovery
      Given no host mechanism or permitted alternative can enforce a required workflow guarantee
      When the builder requests that workflow
      Then Safeword names the unmet outcome, what remains usable, and a concrete recommended next action without claiming completion

    Scenario: Recoverable integration failure is repaired without asking for design choices
      Given protection is unavailable because a selected host has safely repairable stale Safeword-owned delivery
      When the normal repair operation succeeds and protection is verified
      Then the workflow resumes with the restored guarantee without asking the user how to package or translate it

    @rejection
    Scenario: A host limitation cannot lower a requirement silently
      Given a workflow requires an enforced guard and the host offers only advisory guidance
      When the builder continues using the supported advisory functionality
      Then the enforced requirement remains explicitly unmet

  @consistent-host-contract.TBU2.R1
  Rule: consistent-host-contract.TBU2.R1 — Framework delivery derives from shared content

    Scenario: A host loads bundled content without an unnecessary generated copy
      Given a selected host can discover the canonical bundled skill and its resources directly
      When Safeword installs the native plugin
      Then the host loads that bundled revision without a second maintained or generated skill copy

    Scenario: Necessary format translation preserves canonical content
      Given a selected host requires a native wrapper to discover a shared workflow
      When Safeword derives and installs that wrapper
      Then invoking the native entrypoint loads the canonical workflow and resolves its packaged resources

    @surface.claude-code @surface.openai-codex @surface.cursor @surface.opencode
    Scenario Outline: Native delivery exposes the contracted catalogue
      Given an isolated profile for "<host>" version "<version>" in "<runtime>" has the Safeword native plugin installed
      And the canonical catalogue includes a workflow with a referenced guide and a runtime helper returning a known marker
      When that workflow invokes its helper through the native plugin
      Then the host loads the canonical workflow and guide and the bundled helper returns the expected marker

      Examples:
        | host | version | runtime |
        | Claude Code | 2.1.170 | CLI |
        | Codex | 0.160.0 | CLI |
        | Cursor | 3.24.18 | IDE |
        | OpenCode V2 | 2.0.32 | CLI |
        | OpenCode V2 | 2.0.32 | TUI |

    @surface.agent-plugins-1-0
    Scenario Outline: Portable package loading proves only its portable components
      Given a portable Agent Plugins package and its host-specific enforcement extension are installed in "<host>"
      When the host loads the package's skill and referenced resource
      Then their content resolves from the portable bundle without treating that loading result as enforcement proof

      Examples:
        | host |
        | Codex |
        | Cursor |

    @rejection
    Scenario: Duplicate native and compatibility registration is rejected
      Given a native plugin already supplies a workflow and a compatibility bridge would register a second active copy
      When Safeword reconciles framework delivery
      Then it rejects competing activation and identifies the single intended delivery owner

    @surface.opencode
    Scenario: OpenCode V1 retains its separately proved behavior
      Given an existing supported OpenCode 1.18.23 installation
      When shared delivery changes add the OpenCode V2 package
      Then the V1 catalogue and pre-action denial still pass their own installed-host compatibility checks

  @consistent-host-contract.TBU2.R2
  Rule: consistent-host-contract.TBU2.R2 — Delivery changes preserve project ownership and selection

    @surface.safeword-cli
    Scenario: Upgrading a mixed-host project preserves authored work
      Given a mixed-host project contains authored tickets, learnings, modified settings, and unrelated host assets
      When Safeword upgrades proven-owned framework delivery
      Then those user-owned contents remain unchanged while the proven-owned legacy delivery is inactive and exactly one replacement framework authority remains

    @rejection
    Scenario Outline: Unproven legacy ownership cannot authorize deletion
      Given ownership of a legacy framework path is "<ownership>"
      When migration plans its cleanup
      Then the existing content is preserved with a concrete conflict recovery action

      Examples:
        | ownership |
        | user-modified |
        | unverifiable |

    @rejection
    Scenario: A current asset cannot be retired by a legacy cleanup collision
      Given a cleanup inventory entry also identifies a currently shipped framework asset
      When the required migration checks evaluate that inventory
      Then the checks reject the collision before current delivery is removed

    Scenario: Repeating completed installation creates no additional authority
      Given selected native delivery is installed and verified
      When the same install operation is repeated
      Then it reports no required delivery mutation and retains one active framework authority

    Scenario: Interrupted migration recovers without activating two authorities
      Given migration stopped after a usable replacement was installed but before legacy cleanup completed
      When the supported recovery operation runs
      Then it converges on one verified authority while preserving user-owned content

    Scenario: Uninstalling one host preserves another host's shared resources
      Given two selected hosts use shared framework resources and project-owned knowledge
      When Safeword uninstalls one host integration
      Then the remaining host still loads its contracted resources and the project knowledge is preserved

    @rejection
    Scenario Outline: Unselected hosts are not probed or enrolled
      Given one host is selected and another host has existing user-owned assets and an executable probe sentinel
      When Safeword runs "<operation>" for the selected integration
      Then the selected integration has verified result "<result>" while the other host's assets remain byte-identical and its executable probe sentinel is not invoked

      Examples:
        | operation | result |
        | install | active installed delivery |
        | upgrade | active current delivery |
        | repair | restored active delivery |
        | uninstall | integration removed |
