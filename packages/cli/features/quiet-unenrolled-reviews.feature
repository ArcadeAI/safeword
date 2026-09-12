Feature: Point-of-need Safeword enrollment
  Safeword asks before a workflow first depends on project-owned state in an
  unenrolled repository, then follows the builder's choice without weakening
  enrolled workflows.

  @quiet-unenrolled-reviews.NTB1.R1
  Rule: quiet-unenrolled-reviews.NTB1.R1 — State dependency triggers one enrollment choice

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor @surface.safeword-cli
    Scenario Outline: Every supported surface asks before project state is accessed
      Given an unenrolled repository whose Safeword-owned paths are observed independently of Safeword
      And <entry point> on <surface> is loaded under <proof boundary> and is not an explicit install, status, doctor, plan, or uninstall command
      When that entry point is exercised until it first needs Safeword project state
      Then exactly one plain-language setup choice appears before the independent observer records any Safeword-owned path read or write other than reading the enrollment marker

      Examples:
        | surface      | entry point                                                                | proof boundary                                           |
        | Claude Code  | a generated .claude/skills workflow invoked through Claude Code            | an installed-artifact invocation                         |
        | OpenAI Codex | a packaged plugin skill invoked through OpenAI Codex                        | an installed-artifact invocation                         |
        | OpenCode     | the profile-level plugins/safeword.js through the supported CLI/TUI        | an installed-artifact invocation                         |
        | Cursor       | an installed .cursor/rules workflow invoked through Cursor agent mode      | an installed-artifact invocation                         |
        | Safeword CLI | a public non-lifecycle safeword project command                             | a real command process                                   |

    Scenario Outline: Every state-access mechanism asks before project state is accessed
      Given an unenrolled repository whose Safeword-owned paths are observed independently of Safeword
      And a Safeword workflow that is not an explicit install, status, doctor, plan, or uninstall command uses <route>
      When the workflow first needs Safeword project state
      Then exactly one plain-language setup choice appears before the independent observer records any Safeword-owned path read or write other than reading the enrollment marker

      Examples:
        | route                    |
        | a CLI command            |
        | a packaged helper        |
        | a generated workflow     |
        | an action authored by an agent that writes a Safeword-owned project path |

    Scenario: Every catalogued state-access route declares the shared enrollment boundary
      Given the Safeword distribution's project-state access routes and their catalogue
      When enrollment-boundary parity is validated
      Then enrollment-boundary parity validation passes and reports no unguarded or uncatalogued route

    @rejection
    Scenario: An unguarded catalogued route fails enrollment parity
      Given the Safeword distribution contains a catalogued project-state route without the shared enrollment boundary
      When enrollment-boundary parity is validated
      Then validation fails and names the unguarded route

    @rejection
    Scenario: An uncatalogued project-state route fails enrollment parity
      Given the Safeword distribution contains a project-state access route that is absent from the catalogue
      When enrollment-boundary parity is validated
      Then validation fails and names the uncatalogued route

    Scenario: The enrollment choice explains the benefit without internal jargon
      Given an unenrolled repository whose Safeword workflow needs project state
      When the enrollment choice is presented
      Then it explains that setup enables the Safeword workflow and asks for consent without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology

    @rejection @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: Loading an agent surface stays quiet until project state is needed
      Given an unenrolled repository whose Safeword-owned paths are observed independently of Safeword
      And <entry point> on <surface> has loaded
      When the session reaches its first builder turn
      Then no enrollment choice appears and the independent observer records no Safeword-owned path read or write including the enrollment check

      Examples:
        | surface      | entry point                                                                |
        | Claude Code  | a generated .claude/skills workflow invoked through Claude Code            |
        | OpenAI Codex | a packaged plugin skill invoked through OpenAI Codex                        |
        | OpenCode     | the profile-level plugins/safeword.js through the supported CLI/TUI        |
        | Cursor       | an installed .cursor/rules workflow invoked through Cursor agent mode      |

    @rejection
    Scenario: A stateless Safeword operation does not prompt
      Given an unenrolled repository and a Safeword operation with no project-state dependency
      When the operation completes
      Then it returns its ordinary result without an enrollment choice or Safeword project-state access

    @rejection @surface.safeword-cli
    Scenario: Explicit installation does not prompt recursively
      Given an unenrolled repository
      When the builder runs Safeword installation
      Then Safeword presents the canonical install plan for approval without asking whether to start setup

    @rejection @surface.safeword-cli
    Scenario: Enrollment inspection remains read-only
      Given an unenrolled repository
      When the builder runs Safeword status
      Then it reports the unenrolled result without an enrollment prompt or project-state mutation

    @rejection @surface.safeword-cli
    Scenario: Removal from an unenrolled repository does not ask to enroll
      Given an unenrolled repository
      When the builder runs Safeword removal
      Then it reports the existing nothing-to-remove result without an enrollment prompt or project-state mutation

    @rejection @surface.safeword-cli
    Scenario Outline: Diagnostic and planning commands do not prompt or mutate
      Given an unenrolled repository
      When the builder runs Safeword <command>
      Then Safeword returns its ordinary <result> without an enrollment prompt or project-state mutation

      Examples:
        | command | result       |
        | doctor  | diagnostics  |
        | plan    | install plan |

    Scenario: Non-marker Safeword paths do not count as enrollment
      Given a repository without the enrollment marker but with pre-existing Safeword-named files
      When a workflow first needs project state
      Then it asks to enroll before consuming or changing those pre-existing files

  @quiet-unenrolled-reviews.NTB1.R2
  Rule: quiet-unenrolled-reviews.NTB1.R2 — Enrollment requires explicit consent

    Scenario: Accepting setup enters the bounded canonical install plan
      Given an unenrolled repository showing the enrollment choice
      When the builder accepts setup
      Then the canonical plan contains project enrollment and the assets required by the initiating workflow and current host, contains nothing else, and does not invent project-authored knowledge

    Scenario: Approving the bounded plan applies only its disclosed effects
      Given setup is accepted, the builder has reviewed the canonical install plan, and all planned effects can complete
      When the builder approves that plan
      Then the canonical installer applies every effect in the plan presented before approval and no effect outside it

    @rejection
    Scenario: A failed approved installation remains confined to disclosed effects
      Given setup is accepted, the builder approved the canonical install plan, and a planned effect will fail partway
      When installation stops at that failure
      Then every repository path created, modified, or deleted is an effect disclosed in the approved plan and no path outside that plan is created, modified, or deleted

    @rejection
    Scenario: Declining setup authorizes no repository change
      Given an unenrolled repository showing the enrollment choice
      When the builder declines setup
      Then no install plan is applied and no repository path is created, modified, or deleted

    @rejection
    Scenario: An unanswered enrollment choice authorizes no repository change
      Given an unenrolled repository and a state-dependent operation on a host with no interactive input available
      When the operation first needs Safeword project state
      Then it reports that setup requires consent without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology, stops the state-dependent operation, and does not create, modify, or delete any repository path

    @rejection @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: Agent-originated acceptance does not substitute for builder consent
      Given an unenrolled repository whose paths and host input events are observed independently of Safeword
      And an enrollment choice is shown on <surface> through <proof boundary>
      When agent-generated output answers acceptance without a corresponding builder input event on that host
      Then Safeword stops the state-dependent operation and does not create, modify, or delete any repository path

      Examples:
        | surface      | proof boundary                   |
        | Claude Code  | an installed-artifact invocation |
        | OpenAI Codex | an installed-artifact invocation |
        | OpenCode     | an installed-artifact invocation |
        | Cursor       | an installed-artifact invocation |

    @rejection
    Scenario: Enrollment excludes unrelated integrations and dependencies
      Given an unenrolled repository showing setup for one project-installed host workflow
      When the builder accepts and approves its bounded plan
      Then the current host workflow's required assets are installed and no unrelated agent integration or development dependency is installed

    @surface.opencode
    Scenario: Profile-delivered OpenCode enrollment installs only project substrate
      Given an unenrolled repository where the OpenCode profile plugin is already available
      When the builder accepts and approves the bounded canonical plan
      Then the shared Safeword project substrate is installed without adding OpenCode commands, agents, skills, or runtime to the repository

    @rejection
    Scenario: Enrollment preserves customer-owned paths that resemble Safeword state
      Given an unenrolled repository with a customer-owned path that resembles Safeword project state
      When the builder accepts and approves the bounded canonical plan
      Then the installer creates the required Safeword state without consuming, rewriting, or treating the customer-owned path as enrollment

    Scenario: Enrollment honors a configured custom namespace root
      Given an unenrolled repository with a configured custom namespace root and an approved bounded canonical plan
      When the canonical installer applies the plan
      Then it creates the required Safeword state in the configured namespace without creating default-namespace state

  @quiet-unenrolled-reviews.NTB1.R3
  Rule: quiet-unenrolled-reviews.NTB1.R3 — The initiating workflow resolves after the choice

    @demo @surface.claude-code
    Scenario: Accepted enrollment runs the canonical installer and resumes a real workflow
      Given an unenrolled repository where a pinned scripted driver has brought a generated .claude/skills workflow through a real Claude Code host to its first project-state need and the builder has accepted enrollment and reviewed the canonical plan
      When the builder approves that plan
      Then the canonical installer applies the plan and the exact initiating workflow resumes once without another enrollment choice

    @rejection
    Scenario: Declining required state stops automatic BDD before artifacts
      Given an unenrolled repository where Safeword selected BDD for feature work
      When the builder declines enrollment
      Then the Safeword BDD workflow stops before creating a ticket, spec, feature source, dimensions, or log and explains how to start setup later without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology

    Scenario: Declining optional proof preserves a no-ticket review
      Given an unenrolled repository where no-ticket quality-review can operate without invocation proof
      When the builder declines enrollment at the proof boundary
      Then the review returns its findings without proof logging or another enrollment prompt, and the explanation that the review still completed avoids invocation-log, marker, proof, and PROJECT_NOT_ENROLLED terminology

    Scenario: One decline covers later state needs in the same operation
      Given an unenrolled operation with multiple optional project-state dependencies
      When the builder declines its first enrollment choice
      Then the operation follows its declared stateless path without another setup choice

    Scenario: A later independent operation may offer enrollment again
      Given an unenrolled repository whose earlier operation ended with a declined enrollment choice
      When a new operation first needs Safeword project state
      Then it presents one new enrollment choice

    @rejection
    Scenario: A decline at an optional need also covers a later required need
      Given an unenrolled operation whose first project-state dependency is optional and whose later dependency is required
      When the builder declines the first enrollment choice
      Then the operation stops at the required dependency and explains the stop and next action without another setup choice

  @quiet-unenrolled-reviews.NTB1.R4
  Rule: quiet-unenrolled-reviews.NTB1.R4 — Resume follows the proven installation outcome

    Scenario: Sufficient concurrent enrollment prevents duplicate installation
      Given an enrollment choice is pending and the repository has since been enrolled by another actor with the initiating workflow's required setup
      When the builder accepts the pending choice
      Then the initiating operation resumes once without applying a duplicate installation plan

    @rejection
    Scenario: Insufficient concurrent enrollment reports recovery without resuming
      Given an enrollment choice is pending and the repository has since been enrolled by another actor without the initiating workflow's required setup
      When the builder accepts the pending choice
      Then Safeword explains how to complete required setup without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology and does not apply a duplicate installation plan or resume the initiating operation

    Scenario: A partial install that satisfies required setup permits resume
      Given an approved install reports partial completion but proves the initiating workflow's required setup
      When the approved installation completes
      Then the initiating operation resumes once under the installer's unchanged partial result

    @rejection
    Scenario: An unmet setup requirement prevents resume
      Given an approved install does not satisfy the initiating workflow's required setup
      When the approved installation completes
      Then it explains how to recover the existing install without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology and does not resume or retry the initiating operation

    @rejection
    Scenario: A second resume trigger does not replay a completed operation
      Given the initiating operation already resumed successfully after required setup was proven
      When another resume trigger arrives for that same operation
      Then Safeword does not start or resume the initiating operation again

    @rejection
    Scenario: Cancelling installation prevents resume
      Given the builder accepted setup but has not approved the install plan
      When the builder cancels installation
      Then no plan is applied, no repository path is created, modified, or deleted, and the initiating operation does not resume

    @rejection
    Scenario: A failed resume handoff does not replay the initiating operation
      Given installation proved the required setup but the initiating operation has not resumed
      When the resume handoff fails
      Then Safeword reports that automatic resume failed and tells the builder how to retry safely without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology and without starting or retrying the initiating operation

  @quiet-unenrolled-reviews.NTB1.R5
  Rule: quiet-unenrolled-reviews.NTB1.R5 — Existing Safeword workflows do not change

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor @surface.safeword-cli
    Scenario Outline: Enrolled workflows across supported surfaces do not ask again
      Given an enrolled repository and <entry point> on <surface> exercised through <proof boundary>
      When that entry point needs its Safeword project state
      Then it uses its existing resolved state without asking to enroll

      Examples:
        | surface      | entry point                                                                | proof boundary                                           |
        | Claude Code  | a generated .claude/skills workflow invoked through Claude Code            | an installed-artifact invocation                         |
        | OpenAI Codex | a packaged plugin skill invoked through OpenAI Codex                        | an installed-artifact invocation                         |
        | OpenCode     | the profile-level plugins/safeword.js through the supported CLI/TUI        | an installed-artifact invocation                         |
        | Cursor       | an installed .cursor/rules workflow invoked through Cursor agent mode      | an installed-artifact invocation                         |
        | Safeword CLI | a public non-lifecycle safeword project command                             | a real command process                                   |

    Scenario Outline: Supported namespaces resolve existing state without asking again
      Given a repository enrolled with the <namespace> namespace convention
      When a Safeword workflow needs its project state
      Then the workflow uses state from that namespace without asking to enroll

      Examples:
        | namespace         |
        | default           |
        | configured custom |
        | supported legacy  |

    Scenario: Enrollment does not weaken an existing invocation-proof gate
      Given an enrolled repository where invocation proof is required before an operation may finish
      When the operation reaches its existing proof gate without valid proof
      Then the gate still blocks that operation without asking to enroll

    @rejection
    Scenario: Missing authored knowledge is not repaired as enrollment
      Given an enrolled repository with missing project-authored knowledge
      When a Safeword workflow requests that knowledge
      Then it reports that the requested project knowledge is missing and names the next action without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology and without creating it or rerunning enrollment

    @rejection
    Scenario: Missing managed setup in an enrolled repository does not restart enrollment
      Given an enrolled repository missing a Safeword-managed asset required by the initiating workflow
      When the workflow first needs that asset
      Then Safeword reports the unmet setup and next action without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology and without asking to enroll or resuming the workflow
