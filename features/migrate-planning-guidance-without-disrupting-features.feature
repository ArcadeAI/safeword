Feature: Migrate planning guidance without disrupting features
  Safeword replaces legacy design routes without retroactively blocking accepted implementation work.

  @plan-implementability.TBU1.YCFFNC.R1
  Rule: plan-implementability.TBU1.YCFFNC.R1 — In-flight tickets migrate without retroactive blocking

    Scenario Outline: Pre-implementation legacy artifacts become a draft Implementation Plan
      Given a feature before implementation has <legacy_artifact> with accepted decisions and a source link
      When the new planning workflow resumes it
      Then a draft Implementation Plan preserves those decisions and source link

      Examples:
        | legacy_artifact |
        | an existing combined plan |
        | a legacy design artifact |

    Scenario Outline: Accepted implementation work resumes against its accepted artifact
      Given TBU has a feature already in implementation with <accepted_artifact> and its existing test evidence
      When the new planning workflow resumes it
      Then the ticket resumes at implementation against that accepted artifact with its test evidence preserved and no draft Implementation Plan or Execution Plan is demanded retroactively

      Examples:
        | accepted_artifact |
        | an accepted Implementation Plan |
        | an accepted legacy design artifact |

    Scenario: Returning to planning adopts the new contract before planning continues
      Given feature implementation is paused with a legacy design artifact containing accepted decisions and a source link because a behavior-shaping decision changed
      When the workflow receives an explicit return-to-planning transition
      Then a draft Implementation Plan preserves the accepted decisions and source link before the ticket enters the new planning flow

    Scenario: A feature without a legacy artifact starts the new flow without invented history
      Given a pre-implementation feature has no legacy plan, design artifact, accepted decisions, or source link
      When the new planning workflow begins
      Then a new empty Implementation Plan is requested without an invented legacy source or accepted decision

    @rejection @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed hosts enforce the migrated Execution Plan requirement
      Given NTB has a pre-implementation legacy feature with a migrated draft Implementation Plan but no Execution Plan
      When <installed_entry> attempts to begin implementation with real configuration and collaborators on <host>
      Then implementation remains blocked and the primary message plainly names creating the missing Execution Plan as the one next action

      Examples:
        | host | installed_entry |
        | Safeword CLI | actual installed CLI dispatch |
        | Claude Code | actual lifecycle dispatch from installed project hooks |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks |
        | OpenCode CLI | actual lifecycle dispatch from the installed profile plugin |
        | Cursor | actual lifecycle dispatch from installed project hooks |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner |

    @surface.safeword-cli
    Scenario: Installed CLI migrates accepted legacy decisions into the draft Implementation Plan
      Given a pre-implementation feature has a legacy design artifact with accepted decisions and a source link
      When actual installed CLI dispatch resumes it with real configuration and collaborators
      Then the created draft Implementation Plan contains those decisions and source link

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed hosts preserve already accepted implementation work
      Given a feature is already in implementation with an accepted legacy plan
      When <installed_entry> resumes it with real configuration and collaborators on <host>
      Then the ticket resumes at implementation against that accepted plan and no new planning artifact is demanded retroactively

      Examples:
        | host | installed_entry |
        | Safeword CLI | actual installed CLI dispatch |
        | Claude Code | actual lifecycle dispatch from installed project hooks |
        | Claude Code Cloud | actual lifecycle dispatch from project hooks in a fresh VM |
        | OpenAI Codex | actual lifecycle dispatch from installed project hooks |
        | OpenCode CLI | actual lifecycle dispatch from the installed profile plugin |
        | Cursor | actual lifecycle dispatch from installed project hooks |
        | Cursor Cloud Agents | actual lifecycle dispatch from project hooks in a fresh runner |

  @plan-implementability.TBU1.YCFFNC.R2
  Rule: plan-implementability.TBU1.YCFFNC.R2 — Planning guidance names only the two feature plans

    @surface.safeword-cli
    Scenario Outline: Fresh and upgraded installs expose only the two-plan route
      Given a project fixture <starting_state>
      When it receives a <install_mode> Safeword install through the real install and reconcile path
      Then its installed planning guide and feature artifact catalogue name Implementation Plan and Execution Plan and contain neither a feature design artifact nor a design template route

      Examples:
        | starting_state | install_mode |
        | contains no Safeword planning artifacts | fresh |
        | already contains a legacy feature-design artifact reference and design-template route | upgraded |

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario: Every registered host receives the reconciled two-plan guidance
      Given a real install and reconcile has materialized every registered host's planning guidance in a project fixture
      When the installed host artifacts are inspected rather than their source templates
      Then the inspected set contains Safeword CLI, Claude Code, Claude Code Cloud, OpenAI Codex, OpenCode CLI, Cursor, and Cursor Cloud Agents, and each route names only Implementation Plan and Execution Plan for feature planning

    @rejection @surface.safeword-cli
    Scenario: A partial reconcile names the host artifact that was not updated
      Given an install and reconcile cannot materialize one registered host's planning guidance in a project fixture
      When reconciliation completes
      Then the operation fails and names the missing host artifact instead of reporting the two-plan migration complete

  @plan-implementability.TBU1.YCFFNC.R3
  Rule: plan-implementability.TBU1.YCFFNC.R3 — Architecture guidance redirects feature-local design

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed architecture guidance routes by significance without a second feature plan
      Given a real install and reconcile has materialized every registered host's architecture guidance in a project fixture
      When the installed architecture guidance files are read for <decision_shape>
      Then each states <route> and contains no separate feature-design plan route

      Examples:
        | decision_shape | route |
        | a significant cross-cutting choice | create a durable record linked from the Implementation Plan |
        | a local component choice | keep the choice in the Implementation Plan without a durable record |

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario: Installed architecture examples retire the legacy design-file route
      Given every registered host's existing architecture examples point feature-local design to a legacy design file
      When a real install and reconcile updates those examples in a project fixture
      Then the installed feature-local design examples point to the Implementation Plan and none points to a legacy design file

  @plan-implementability.TBU1.YCFFNC.R4
  Rule: plan-implementability.TBU1.YCFFNC.R4 — Data guidance uses semantic applicability and significance

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed data guidance follows semantic relevance rather than apparent size
      Given a real install and reconcile has materialized every registered host's data guidance in a project fixture
      When the installed data guidance files are read for <data_change>
      Then each states <applicability_result> and contains no entity-count or simple-schema exemption that contradicts that result

      Examples:
        | data_change | applicability_result |
        | a single-entity simple-schema change to data lifecycle and ownership | the data guide is required |
        | a many-entity mechanical representation change with no lifecycle, ownership, meaning, migration, compatibility, or data-contract change | the data guide is not required |

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Durable recording follows architectural significance rather than entity count
      Given a real install and reconcile has materialized every registered host's data and architecture guidance in a project fixture
      When those installed guidance files are read for a change that is <decision_shape>
      Then each states <recording_result> and contains no numeric entity-count rule that contradicts that result

      Examples:
        | decision_shape | recording_result |
        | single-entity but cross-cutting and long-lived | require a durable architecture record linked from the Implementation Plan |
        | many-entity but local and reversible | keep the decision in the Implementation Plan without a separate durable record |

  @plan-implementability.TBU1.YCFFNC.R5
  Rule: plan-implementability.TBU1.YCFFNC.R5 — Deep design is folded into the Implementation Plan

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Installed guidance keeps routine and deep design in one Implementation Plan lane
      Given a real install and reconcile has materialized every registered host's feature-planning guidance in a project fixture
      When the installed feature-planning guidance files are read for <design_depth>
      Then each states <plan_result> and contains no separate deep-design artifact route

      Examples:
        | design_depth | plan_result |
        | routine design | the plan records the selected approach and has no deep-design section |
        | detailed component and data-model design | the detailed decisions appear in the Implementation Plan |

    @rejection @surface.safeword-cli
    Scenario: Reconcile redirects a legacy separate-design request into the Implementation Plan
      Given an upgraded project fixture contains a legacy instruction requesting a separate deep-design artifact
      When real Safeword CLI install and reconcile updates the feature-planning guidance
      Then the installed instruction directs the detailed decisions into the Implementation Plan and contains no separate-artifact request

  @plan-implementability.TBU1.YCFFNC.R6
  Rule: plan-implementability.TBU1.YCFFNC.R6 — A plan created or revised after implementation exists reconciles its claims against current behavior and records discrepancies without relabeling them as accepted, proven, or approved

    @surface.safeword-cli
    Scenario Outline: Existing implementation state controls a retrofitted plan claim
      Given a feature returning to planning has <implementation_state>
      When its Implementation Plan is reconciled against current behavior through the installed Safeword CLI
      Then <plan_result>

      Examples:
        | implementation_state | plan_result |
        | current behavior matching an accepted legacy decision | the plan records the decision and labels the matching behavior as implemented without claiming proof or human approval |
        | proposed behavior absent from the current implementation | the plan labels the behavior proposed rather than implemented |
        | current behavior contradicting an accepted decision | the plan records the discrepancy as unresolved and does not relabel current behavior as accepted |
        | proof retained only from an older revision | the plan preserves the evidence link and labels its revision limitation rather than calling the current implementation proven |

    @rejection
    Scenario: A plausible but unverified implementation claim blocks migrated-plan approval
      Given a retrofitted Implementation Plan calls a process lease unique per incarnation without reconciling the current identity construction
      When the plan is reviewed
      Then approval is blocked until the implemented identity and any discrepancy are recorded truthfully

  @plan-implementability.TBU1.YCFFNC.R7
  Rule: plan-implementability.TBU1.YCFFNC.R7 — Installed guidance delivers both planning-phase entry gates and project-local artifacts, the feature Delivery Checklist, and reviewable pull-request slicing, and proves that behavior at each affected host boundary or records a specific justified limitation at that real boundary

    @surface.safeword-cli @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: Each authoritative host exposes the complete installed planning route
      Given Safeword is installed for <host_entry>
      When a feature reaches planning through that host's real entry point
      Then the workflow produces the project-local Implementation Plan and Execution Plan, applies their current review contracts, carries the feature Delivery Checklist, and records a one-PR or dependency-ordered slicing decision

      Examples:
        | host_entry |
        | Safeword CLI planning transition |
        | Claude Code lifecycle-hook dispatch |
        | Claude Code Cloud project hooks in a fresh VM |
        | OpenAI Codex project workflow dispatch |
        | OpenCode CLI/TUI plugin-event dispatch |
        | Cursor project-hook dispatch |
        | Cursor Cloud Agents project hooks in a fresh runner |

    @surface.opencode
    Scenario: An unsupported host boundary records a specific limitation
      Given OpenCode Desktop cannot enforce the two planning reviews through reliable native hook dispatch
      When installed planning guidance reaches that surface
      Then the guidance labels the workflow advisory, names the missing native boundary, and directs the user to the authoritative OpenCode CLI or TUI route

  @plan-implementability.TBU1.YCFFNC.R8 @demo
  Rule: plan-implementability.TBU1.YCFFNC.R8 — On each supported authoritative host, a plain feature prompt automatically traverses intake, behavior definition, both planning phases, TDD implementation, verification, checklist completion, and pull-request preparation while preserving a contract-quality Product Plan, Implementation Plan, and Execution Plan and leaving human review and merge authority intact

    @surface.claude-code @surface.claude-code-cloud @surface.openai-codex @surface.opencode @surface.cursor @surface.cursor-cloud-agents
    Scenario Outline: MCP notification support travels from request to review-ready pull request
      Given a user tells <host_entry> "let's support MCP notifications" in a configured project with no existing ticket
      When Safeword carries the request through its automatic feature workflow
      Then the resulting review-ready pull request has verified implementation, a completed Delivery Checklist, and current contract-approved Product, Implementation, and Execution Plans without claiming human review or merge approval

      Examples:
        | host_entry |
        | Claude Code lifecycle-hook dispatch |
        | Claude Code Cloud project hooks in a fresh VM |
        | OpenAI Codex project workflow dispatch |
        | OpenCode CLI/TUI plugin-event dispatch |
        | Cursor project-hook dispatch |
        | Cursor Cloud Agents project hooks in a fresh runner |

    @rejection
    Scenario: Manual artifact creation cannot masquerade as the complete journey
      Given a user requests MCP notification support and only a ticket plus unchecked plan templates exist
      When end-to-end completion is evaluated
      Then the journey remains incomplete with the next unperformed workflow step named
