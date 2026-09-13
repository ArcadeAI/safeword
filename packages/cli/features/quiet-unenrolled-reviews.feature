Feature: Point-of-need Safeword enrollment
  Safeword resolves an enclosing, local, or isolated-global project context
  when a workflow first needs state, mutates a repository only with consent,
  and keeps global data as a durable fallback beneath any local installation.

  @quiet-unenrolled-reviews.NTB1.R1
  Rule: quiet-unenrolled-reviews.NTB1.R1 — State dependency resolves the nearest usable project context

    @demo @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor @surface.safeword-cli
    Scenario Outline: Every supported surface asks before project state is accessed
      Given a repository with no local, enclosing, or global Safeword project context on a host with interactive input whose repository and user-global Safeword-owned paths are observed independently of Safeword
      And <entry point> on <surface> is loaded under <proof boundary> and is not an explicit install, status, doctor, plan, or uninstall command
      When that entry point is exercised until it first needs Safeword project state
      Then exactly one plain-language setup choice appears after only read-only checks of the current marker, ancestor markers, and checkout-global partition and before the independent observer records any Safeword-owned write or any other state read

      Examples:
        | surface      | entry point                                                                | proof boundary                                           |
        | Claude Code  | a generated .claude/skills workflow invoked through Claude Code            | an installed-artifact invocation                         |
        | OpenAI Codex | a packaged plugin skill invoked through OpenAI Codex                        | an installed-artifact invocation                         |
        | OpenCode     | the profile-level plugins/safeword.js through the supported CLI/TUI        | an installed-artifact invocation                         |
        | Cursor       | an installed .cursor/rules workflow invoked through Cursor agent mode      | an installed-artifact invocation                         |
        | Safeword CLI | a public non-lifecycle safeword project command                             | a real command process                                   |

    Scenario Outline: Every state-access mechanism asks before project state is accessed
      Given a repository with no local, enclosing, or global Safeword project context on a host with interactive input whose repository and user-global Safeword-owned paths are observed independently of Safeword
      And a Safeword workflow that is not an explicit install, status, doctor, plan, or uninstall command uses <route> through <proof boundary>
      When the workflow first needs Safeword project state
      Then exactly one plain-language setup choice appears after only read-only checks of the current marker, ancestor markers, and checkout-global partition and before the independent observer records any Safeword-owned write or any other state read

      Examples:
        | route                    | proof boundary                                    |
        | a CLI command            | a real command process                            |
        | a packaged helper        | an installed-artifact invocation                  |
        | a generated workflow     | an installed-artifact invocation                  |
        | an action authored by an agent that writes a Safeword-owned project path | a real host-tool filesystem write |

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
      Given a repository with no local, enclosing, or global Safeword project context whose workflow needs state
      When the enrollment choice is presented
      Then it explains that setup enables the Safeword workflow and asks for consent without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology

    @rejection @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: Loading an agent surface stays quiet until project state is needed
      Given an unenrolled repository whose Safeword-owned project-state paths are observed independently of Safeword
      And <entry point> on <surface> has loaded
      When the session reaches its first builder turn without invoking a state-dependent workflow
      Then no enrollment choice appears and the independent observer records no Safeword-owned project-state path read or write including the enrollment check

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
      Given a repository without local, enclosing, or global Safeword project context but with pre-existing Safeword-named files
      When a workflow first needs project state
      Then it asks to enroll before consuming or changing those pre-existing files

    Scenario: Enrolled context inside the same repository is reused automatically
      Given a named project value exists under the enrolled Safeword root of the workflow's current repository
      When the workflow first needs Safeword project state
      Then it reads that named value without offering local setup or creating global state

    Scenario: An enrolled containing project is offered before current-repository setup
      Given an unenrolled repository with no global partition for this checkout nested below a different enrolled Safeword project
      When a workflow first needs Safeword project state
      Then one choice offers the containing project, current-repository setup, and automatic private global storage

    Scenario: Existing checkout-specific global state wins over a containing project
      Given an unenrolled repository nested below a different enrolled Safeword project with an existing global partition for this checkout
      When a workflow first needs Safeword project state
      Then it uses the checkout's global partition without presenting a project-context choice

    Scenario: An enrolled current repository wins over an enrolled ancestor
      Given a repository enrolled with a named project value is nested below a different enrolled Safeword project
      When a workflow first needs Safeword project state
      Then it reads the current repository's named value without presenting a project-context choice or reading the containing project's state

  @quiet-unenrolled-reviews.NTB1.R2
  Rule: quiet-unenrolled-reviews.NTB1.R2 — Repository enrollment requires explicit consent

    Scenario: Accepting setup enters the bounded canonical install plan
      Given an unenrolled repository showing the enrollment choice
      When the builder accepts setup
      Then the canonical plan contains project enrollment and the assets required by the initiating workflow and current host and contains nothing else

    Scenario: Approving the bounded plan applies only its disclosed effects
      Given setup is accepted, the builder has reviewed the canonical install plan, all planned effects can complete, and repository paths are observed independently of Safeword
      When the builder approves that plan
      Then the independent observer records every effect in the plan presented before approval and no created, modified, or deleted repository path outside it

    @rejection
    Scenario: A failed approved installation remains confined to disclosed effects
      Given setup is accepted, the builder approved the canonical install plan, a planned effect will fail partway, and repository paths are observed independently of Safeword
      When installation stops at that failure
      Then every repository path created, modified, or deleted is an effect disclosed in the approved plan and no path outside that plan is created, modified, or deleted

    @demo @rejection
    Scenario: Declining setup authorizes no repository change
      Given an unenrolled repository showing the enrollment choice whose repository paths are observed independently of Safeword
      When the builder declines setup
      Then no install plan is applied and no repository path is created, modified, or deleted

    @rejection
    Scenario: An unanswered enrollment choice authorizes no repository change
      Given an unenrolled repository whose paths are observed independently of Safeword and a state-dependent operation on a host with no interactive input available
      When the operation first needs Safeword project state
      Then no repository path is created, modified, or deleted

    @rejection
    Scenario: An interrupted enrollment choice authorizes no repository change
      Given an unenrolled repository showing the enrollment choice whose repository paths are observed independently of Safeword
      When the host interrupts or dismisses the choice before builder acceptance
      Then no repository path is created, modified, or deleted

    @rejection
    Scenario: An abandoned interactive choice authorizes no repository change
      Given an unenrolled repository showing the enrollment choice on an interactive host whose paths are observed independently of Safeword
      When the host returns the choice without a builder answer
      Then no repository path is created, modified, or deleted

    @rejection
    Scenario: Cancelling setup authorization applies no repository plan
      Given the builder accepted setup but has not approved the install plan and repository paths are observed independently of Safeword
      When the builder cancels installation
      Then no plan is applied and no repository path is created, modified, or deleted

    @rejection @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor
    Scenario Outline: Agent-originated acceptance does not substitute for builder consent
      Given an unenrolled repository whose paths and host input events are observed independently of Safeword
      And an enrollment choice is shown on <surface> through an installed-artifact invocation
      When agent-generated output answers acceptance without a corresponding builder input event on that host
      Then Safeword selects private global storage and does not create, modify, or delete any repository path

      Examples:
        | surface      |
        | Claude Code  |
        | OpenAI Codex |
        | OpenCode     |
        | Cursor       |

    @rejection
    Scenario: Enrollment excludes unrelated integrations and dependencies
      Given an unenrolled repository showing setup for one project-installed host workflow whose paths are observed independently of Safeword
      When the builder accepts and approves its bounded plan
      Then the independent observer records the current host workflow's required assets and no unrelated agent integration or development dependency

    @surface.opencode
    Scenario: Profile-delivered OpenCode enrollment installs only project substrate
      Given an unenrolled repository where the OpenCode profile plugin is already available and repository paths are observed independently of Safeword
      When the builder accepts and approves the bounded canonical plan
      Then the independent observer records the shared Safeword project substrate without any added OpenCode commands, agents, skills, or runtime in the repository

    @rejection
    Scenario: Enrollment preserves customer-owned paths that resemble Safeword state
      Given an unenrolled repository with a customer-owned path that resembles Safeword project state and repository paths are observed independently of Safeword
      When the builder accepts and approves the bounded canonical plan
      Then the independent observer records the required Safeword state and no read, rewrite, or enrollment use of the customer-owned path

  @quiet-unenrolled-reviews.NTB1.R3
  Rule: quiet-unenrolled-reviews.NTB1.R3 — Global storage is the automatic fallback

    @demo @surface.openai-codex
    Scenario: Declining local setup continues automatic BDD in global storage
      Given an unenrolled repository where a packaged Safeword workflow invoked through an OpenAI Codex installed-artifact boundary selected BDD for feature work
      When the builder declines enrollment
      Then the Safeword BDD workflow resumes once and writes its ticket, spec, feature source, dimensions, and log only to that checkout's private global partition

    Scenario: Declining local setup records no-ticket review proof globally
      Given an unenrolled repository where no-ticket quality-review needs invocation proof
      When the builder declines enrollment at the proof boundary
      Then the review records invocation proof in that checkout's private global partition and returns its findings without another enrollment prompt

    Scenario: One decline covers later state needs in the same operation
      Given an unenrolled operation whose first project-state dependency will record a named value needed by a later dependency
      When the builder declines its first enrollment choice
      Then the later dependency reads that named value from global storage without another setup choice

    Scenario: A later independent operation reuses global state without asking again
      Given an unenrolled repository whose earlier operation recorded a named value in its global project partition
      When a new operation first needs Safeword project state
      Then it reads that named value without offering local setup again

    Scenario: Silence continues the initiating workflow globally
      Given an unenrolled repository with no global partition and a state-dependent operation on a host with no interactive input available
      When the operation reaches its first Safeword project-state need
      Then Safeword creates the private global partition and resumes the operation once without another prompt

    Scenario: Prompt interruption continues the initiating workflow globally
      Given an unenrolled repository with no global partition whose enrollment choice is interrupted before builder acceptance
      When Safeword resolves storage for the pending operation
      Then it creates the private global partition and resumes the operation once without another prompt

    Scenario: An abandoned interactive choice continues globally
      Given an unenrolled repository with no global partition showing the enrollment choice on an interactive host
      When the host returns the choice without a builder answer
      Then Safeword creates the private global partition and resumes the operation once without another prompt

    Scenario: Optional project state uses the same automatic global fallback
      Given an unenrolled repository with no global partition and a workflow whose project-state dependency is optional
      When the builder declines local setup at that dependency
      Then Safeword creates the private global partition and the workflow continues once using it

    Scenario: Selecting global storage under a containing project preserves both repositories
      Given an unenrolled repository nested below a different enrolled Safeword project whose paths are observed independently of Safeword
      When the builder selects automatic private global storage from the project-context choice
      Then Safeword creates a checkout-specific global partition, resumes the workflow once, and leaves both repositories unchanged

    @rejection
    Scenario: Unrelated checkouts cannot observe each other's global project data
      Given two unenrolled checkouts with different project identities and global Safeword data in the first
      When a workflow in the second checkout reads its project context
      Then the second checkout resolves a distinct global partition containing none of the first checkout's records and its writes leave the first partition unchanged

    Scenario: Linked worktrees share global project knowledge
      Given one linked worktree recorded a named project-knowledge value in global storage
      When a workflow in another linked worktree with the same project identity reads project knowledge
      Then it reads that same named value

    @rejection
    Scenario: Linked worktrees isolate mutable execution state
      Given one linked worktree's operation recorded a named mutable-state value in global storage
      When an operation in another linked worktree with the same project identity reads its mutable state
      Then it does not read the first operation's value and the first operation still reads its own value

    Scenario: A non-Git directory reuses its canonical-path global partition
      Given an unenrolled non-Git directory that recorded a named value in its canonical-path global partition
      When a later workflow needs project state from the same canonical directory
      Then it reads that named value without offering local setup again

    Scenario: Global storage is private to the current user
      Given an unenrolled repository whose workflow selected global Safeword storage
      When the global project partition is created
      Then its project knowledge and mutable state are stored outside the repository with owner-only access

    @rejection
    Scenario: Unavailable global storage never falls back to repository writes
      Given an unenrolled repository whose local setup was not accepted and whose private global store cannot be created or written
      When the initiating workflow needs Safeword project state
      Then Safeword reports that private project storage is unavailable with a recovery action and leaves every repository path unchanged

  @quiet-unenrolled-reviews.NTB1.R4
  Rule: quiet-unenrolled-reviews.NTB1.R4 — The initiating workflow resumes once from the selected context

    @demo @surface.claude-code
    Scenario: Accepted enrollment runs the canonical installer and resumes a real workflow
      Given an unenrolled repository where a pinned Claude Code version replays a recorded host response through a scripted driver and waits within a fixed bound for the generated .claude/skills workflow's first filesystem state-need event, and the independent observer records the builder's acceptance input and reviewed canonical plan
      When the builder approves that plan
      Then the canonical installer applies the plan and the exact initiating workflow resumes once without another enrollment choice

    Scenario: Choosing an enrolled containing project resumes from it
      Given an unenrolled repository nested below a different enrolled Safeword project and showing the project-context choice
      When the builder selects the containing project
      Then the initiating operation resumes once from that project without creating local or global state

    Scenario: Sufficient concurrent enrollment prevents duplicate installation
      Given an enrollment choice is pending and the repository has since been enrolled by another actor with the initiating workflow's required setup and a named project value
      When the builder accepts the pending choice
      Then the initiating operation resumes once, reads the named value from the repository namespace, and does not apply a duplicate installation plan

    @rejection
    Scenario: Insufficient concurrent enrollment falls back without duplicate installation
      Given an enrollment choice is pending and the repository has since been enrolled by another actor without the initiating workflow's required setup
      When the builder accepts the pending choice
      Then Safeword uses the global project partition and resumes the initiating operation once without applying a duplicate installation plan

    Scenario: A partial install that satisfies required setup permits resume
      Given an approved install has completed with a partial result that proves the initiating workflow's required setup
      When Safeword evaluates that completed installation for the initiating operation
      Then Safeword reports the installer's partial result verbatim and the initiating operation resumes once

    @rejection
    Scenario: An unmet local setup requirement resumes globally
      Given an approved install does not satisfy the initiating workflow's required setup
      When the approved installation completes
      Then it preserves the installer's result, uses the global project partition, and resumes the initiating operation once without retrying installation

    @rejection
    Scenario: A second resume trigger does not replay a completed operation
      Given the initiating operation already resumed successfully after required setup was proven
      When another resume trigger arrives for that same operation
      Then Safeword does not start or resume the initiating operation again

    @rejection
    Scenario: Cancelling installation resumes globally
      Given the builder accepted setup but has not approved the install plan and repository paths are observed independently of Safeword
      When the builder cancels installation
      Then the initiating operation resumes once from the global project partition

    @rejection
    Scenario: A failed resume handoff does not replay the initiating operation
      Given installation proved the required setup but the initiating operation has not resumed
      When the resume handoff fails
      Then Safeword reports that automatic resume failed and tells the builder how to retry safely without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology and without starting or retrying the initiating operation

  @quiet-unenrolled-reviews.NTB1.R5
  Rule: quiet-unenrolled-reviews.NTB1.R5 — Existing Safeword workflows do not change

    @surface.claude-code @surface.openai-codex @surface.opencode @surface.cursor @surface.safeword-cli
    Scenario Outline: Enrolled workflows across supported surfaces do not ask again
      Given an enrolled repository with a named project value and <entry point> on <surface> exercised through <proof boundary>
      When that entry point needs its Safeword project state
      Then it reads the named project value without asking to enroll

      Examples:
        | surface      | entry point                                                                | proof boundary                                           |
        | Claude Code  | a generated .claude/skills workflow invoked through Claude Code            | an installed-artifact invocation                         |
        | OpenAI Codex | a packaged plugin skill invoked through OpenAI Codex                        | an installed-artifact invocation                         |
        | OpenCode     | the profile-level plugins/safeword.js through the supported CLI/TUI        | an installed-artifact invocation                         |
        | Cursor       | an installed .cursor/rules workflow invoked through Cursor agent mode      | an installed-artifact invocation                         |
        | Safeword CLI | a public non-lifecycle safeword project command                             | a real command process                                   |

    Scenario Outline: Supported namespaces resolve existing state without asking again
      Given a repository enrolled with the <namespace> namespace convention and a named project value in that namespace
      When a Safeword workflow needs its project state
      Then the workflow reads the named project value from that namespace without asking to enroll

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
      Given an enrolled repository with no enrollment choice or install initiated by the current operation and missing a Safeword-managed asset required by the initiating workflow
      When the workflow first needs that asset
      Then Safeword reports the unmet setup and next action without invocation-log, marker, proof, or PROJECT_NOT_ENROLLED terminology and without asking to enroll or resuming the workflow

  @quiet-unenrolled-reviews.NTB1.R6
  Rule: quiet-unenrolled-reviews.NTB1.R6 — Local installation shadows a durable global fallback

    @surface.safeword-cli
    Scenario: A later install plan includes existing global project data
      Given an unenrolled repository with project knowledge and mutable state in its global partition
      When the builder runs Safeword installation
      Then the canonical plan lists the compatible global data that will hydrate the selected repository namespace before approval

    @demo
    Scenario: Successful installation verifies the local overlay without retiring global data
      Given the builder approved an install plan containing compatible global project data
      When installation and hydration complete successfully
      Then every planned artifact and state record is readable from the repository namespace before the local overlay activates and the global partition remains intact

    @rejection
    Scenario: Hydration conflicts are surfaced without silent overwrite
      Given the repository namespace and global partition contain different data for the same Safeword-owned path
      When the canonical install plan is prepared
      Then the plan reports the conflict and does not select either value for overwrite without builder approval

    Scenario: Compatible local and global data hydrates without conflict or rewrite
      Given the repository namespace and global partition contain compatible data for the same Safeword-owned path
      When the canonical install plan is prepared
      Then the plan reports no conflict and selects no rewrite for the compatible repository path

    @rejection
    Scenario: Cancelling hydration preserves global authority
      Given the install plan includes a named global value for hydration from a global partition
      When the builder cancels before approving the plan
      Then the named value remains readable globally and is absent from the repository namespace

    @rejection
    Scenario: Failed hydration preserves global data and authority
      Given an approved install cannot verify every planned global artifact and state record in the repository namespace
      When hydration stops at the verification failure
      Then the global partition remains intact and authoritative and Safeword reports the unresolved transfer without claiming local enrollment complete

    Scenario: Installing without global data keeps the ordinary plan
      Given an unenrolled repository with no global Safeword partition
      When the builder runs Safeword installation
      Then the canonical plan contains its ordinary bounded local effects and no hydration step

    @demo
    Scenario Outline: A missing local overlay falls back to preserved global data
      Given an installed checkout whose local Safeword namespace is absent because it was <absence> and whose pre-install global partition exists
      When a Safeword workflow first needs project state
      Then it uses the preserved global partition without prompting, failing, or recreating the local overlay

      Examples:
        | absence                             |
        | not committed on the current branch |
        | locally deleted                     |
        | created only in another checkout    |

    @rejection
    Scenario: Local changes do not update the preserved global snapshot
      Given an installed checkout whose local overlay is active over a preserved global partition
      When a Safeword workflow writes project knowledge or mutable state locally
      Then the written value is readable from the repository namespace and the global partition's contents remain unchanged

    @rejection
    Scenario: Unreadable global data blocks local overlay activation
      Given an approved install plan whose global hydration source is unreadable or corrupt
      When installation attempts to hydrate the repository namespace
      Then Safeword leaves the global partition unchanged, does not activate the local overlay, and reports the unreadable source with a recovery action

    Scenario: Enrollment honors a configured custom namespace root
      Given an unenrolled repository with a configured custom namespace root, a named value in its global partition, and an approved bounded canonical plan
      When the canonical installer applies the plan
      Then the named value is readable from the configured namespace without creating default-namespace state
