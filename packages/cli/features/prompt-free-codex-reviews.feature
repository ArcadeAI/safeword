# Cucumber excludes this @manual feature; a passing acceptance count does not
# include these scenarios. There are no process-level MCP host step definitions.
# `bun run test` binds
# R1 tool/input limits in codex-plugin/review-mcp.test.ts and review/packet.test.ts;
# R2 approval/guidance in codex-plugin/review-approval.test.ts and
# review/surface-parity.test.ts; R3 signed/stale proof in review/job.test.ts and
# codex-plugin/review-mcp.test.ts; R4 URL, process, and UI protocol behavior in
# codex-plugin/review-mcp-login.test.ts, reviewer-login-process.test.ts,
# reviewer-login.test.ts, and review-login-ui.test.ts. @live scenarios also
# require installed Codex and Claude host checks with real reviewer CLIs; record
# each host command, signed review ID, URL host/code presence, and gate result
# in the ticket's verify.md. An unobserved @live step remains incomplete.
@manual @surface.openai-codex
Feature: Run independent Codex reviews after one narrow approval

  @prompt-free-codex-reviews.TBU1.R1
  Rule: prompt-free-codex-reviews.TBU1.R1 - Narrow review interface

    @live
    Scenario: Safeword exposes only bounded review operations
      Given the Safeword Codex plugin is installed
      When Codex lists the Safeword review MCP tools
      Then the tool list contains exactly start_review, review_status, start_reviewer_login, and show_reviewer_login
      And it does not expose executable RED or a general command runner

    @manual
    @live
    Scenario Outline: Every review kind returns a terminal verdict through MCP
      Given the built Safeword plugin is installed with a valid <kind> review packet
      When Codex starts a <kind> review through MCP and polls to terminal status
      Then the review reports independent completion with a reviewer verdict for <kind>
      And the signed review receipt records <kind> as the reviewed kind
      And authored project files remain unchanged

      Examples:
        | kind                |
        | quality-review      |
        | scenario-gate       |
        | plan-implementation |

    Scenario: Executable RED stays outside the review interface
      Given the Safeword review MCP tools are available
      When Codex requests executable RED as the review kind
      Then the request is rejected before reviewer dispatch

    @rejection
    Scenario Outline: Invalid requests never reach a reviewer
      Given a review request contains <invalid_request>
      When Codex starts the Safeword review
      Then the review ends with a bounded error before reviewer dispatch

      Examples:
        | invalid_request                   |
        | a relative project root           |
        | an absolute root without a Safeword project marker |
        | a symlinked root into another tree |
        | an absolute target path           |
        | an escaping target path           |
        | a symlinked target outside root   |
        | an absolute context path          |
        | an escaping context path          |
        | a symlinked context outside root  |

    @rejection
    Scenario Outline: Missing review files do not reach a reviewer
      Given a review request names a missing <file_role> file
      When Codex starts the Safeword review
      Then the review ends with a bounded missing-file error before reviewer dispatch

      Examples:
        | file_role |
        | target    |
        | context   |

    @rejection
    Scenario: An empty target list does not reach a reviewer
      Given a review request has no target files
      When Codex starts the Safeword review
      Then the review ends with a bounded empty-target error before reviewer dispatch

    @rejection
    Scenario: Coordinator policy opt-out blocks provider dispatch
      Given cross-agent review is disabled in the project configuration
      When Codex starts the Safeword review through MCP
      Then the coordinator reports a non-independent existing-route result without provider dispatch

    Scenario Outline: Packet size follows the coordinator boundary
      Given a review packet is <size_class> the coordinator packet limit
      When Codex starts the review through MCP
      Then the coordinator <outcome>

      Examples:
        | size_class | outcome                                                |
        | at         | dispatches the packet to the reviewer                   |
        | above      | returns a bounded error before reviewer dispatch        |

  @prompt-free-codex-reviews.TBU1.R2
  Rule: prompt-free-codex-reviews.TBU1.R2 - One narrow approval, explicitly chosen

    Scenario Outline: Generated review guidance names the MCP tools for every kind
      Given the generated Safeword <kind> review instruction
      When Safeword generates that instruction for Codex
      Then the instruction names the MCP start and status tools
      And it contains no shell review dispatch for Codex
      And it discloses that the bounded packet goes to a reviewer provider

      Examples:
        | kind     |
        | quality  |
        | scenario |
        | plan     |

    @live
    Scenario: Plugin installation makes the review tools available
      Given a fresh Codex home with the built-in workspace profile
      When Safeword is installed from its plugin package
      Then Codex discovers the Safeword review tools from the installed runtime
      And Codex permission settings are unchanged

    @live
    @rejection
    Scenario: An unapproved review never dispatches silently
      Given the Safeword plugin is installed and the user never chose --approve-reviews
      When Codex calls start_review under an approval policy that forbids prompts
      Then the host blocks the call before a reviewer receives a packet
      And start_review is advertised as state-changing rather than read-only
      And no signed review receipt is created

    @live
    @rejection
    Scenario: An unapproved reviewer login cannot launch a CLI
      Given a signed review needs reviewer authentication and the user never chose --approve-reviews
      When Codex calls start_reviewer_login under an approval policy that forbids prompts
      Then the host blocks the call before the assigned reviewer CLI starts
      And start_reviewer_login is advertised as state-changing rather than read-only

    @surface.claude-code
    @live
    Scenario: Claude installation exposes the same bounded review tools
      Given a fresh Claude Code profile
      When Safeword installs its Claude plugin
      Then Claude discovers the same four bounded review and sign-in MCP tools
      And no Codex approval setting is changed

    @surface.claude-code
    Scenario: Claude review guidance discloses provider dispatch
      Given the generated Claude review instruction
      When a Claude user reads the review entry point
      Then it states that bounded target and context contents may go to the selected reviewer provider

    Scenario: One explicit review approval changes only the review and reviewer-login tools
      Given the Safeword plugin is installed in a Codex profile with the workspace sandbox enabled
      When the user explicitly chooses --approve-reviews
      Then Safeword explains before writing that packets go to the reviewer provider and both review workers and the assigned login CLI run outside the author shell sandbox
      And it explains that login may open its sign-in URL
      And only the Safeword start_review and start_reviewer_login tools gain persistent approval
      And pre-existing unrelated Codex configuration remains byte-for-byte unchanged
      And the workspace sandbox remains enabled

    @live
    Scenario: Status and sign-in display add no approval prompts
      Given the user made the one explicit --approve-reviews setup choice in an installed Codex host
      When Codex calls review_status and show_reviewer_login for a signed review
      Then neither read-only tool requests another approval
      And neither tool writes any file, launches a process, terminates the review worker, or opens a browser without a user click

    @rejection
    Scenario Outline: A conflicting customer policy prevents approval setup
      Given the Codex profile already denies a Safeword review tool at the <policy_level> level
      When the user chooses --approve-reviews
      Then Safeword reports that setup was not effective
      And it preserves the customer's existing policy without granting review access
      And neither start_review nor start_reviewer_login approval entry is written

      Examples:
        | policy_level |
        | tool         |
        | server       |
        | plugin       |

    @live
    Scenario Outline: Upgrading the plugin preserves customer permissions
      Given an earlier Safeword plugin install with <existing_permission>
      When Safeword upgrades the bundled review runtime
      Then Codex discovers the upgraded review tools
      And <existing_permission> remains unchanged

      Examples:
        | existing_permission                         |
        | customer-authored Codex permission settings |
        | a revoked review-tool approval              |

    @rejection
    Scenario Outline: Unavailable review tools do not trigger an approval escalation
      Given <tool_condition> prevents the Safeword review tool from starting
      When a review is requested in Codex
      Then Safeword reports the review route unavailable
      And it does not request an out-of-sandbox rule

      Examples:
        | tool_condition           |
        | the plugin is not loaded |
        | the MCP server crashes   |

    @rejection
    Scenario: An unreachable reviewer provider fails without permission escalation
      Given the plugin review tool is available and the reviewer provider times out
      When Codex checks the review status
      Then Safeword reports a bounded failed result
      And it does not request an out-of-sandbox approval

  @prompt-free-codex-reviews.TBU1.R3
  Rule: prompt-free-codex-reviews.TBU1.R3 - Signed independent proof after narrow approval

    @manual
    @live
    @demo
    Scenario: Independent review finishes without repeat prompts after narrow approval
      Given the built Safeword plugin is installed in a disposable Codex home with a synthetic repository containing a known defect
      And the user explicitly approved only start_review and start_reviewer_login once under approval policy never and the built-in workspace profile
      When Codex runs two Safeword quality reviews to terminal status
      Then each review has independent completion from a reviewer different from the requesting Codex agent with a finding that names the seeded file
      And neither review requests another approval after the setup choice
      And each signed review receipt can be verified by the normal Safeword gate
      And the synthetic source remains unchanged

    @manual
    @live
    Scenario: One-time approval also works under on-request policy
      Given the built Safeword plugin is installed in a disposable Codex home with only start_review and start_reviewer_login approved
      And Codex runs with on-request approval policy and the built-in workspace profile
      When Codex starts a Safeword review
      Then start_review completes without an approval event

    @rejection
    Scenario Outline: Non-independent review states never count as completion
      Given a Safeword review has <actual_outcome>
      When Codex checks its status
      Then Safeword reports <reported_state>
      And independent completion is false

      Examples:
        | actual_outcome              | reported_state                 |
        | not finished                | pending                        |
        | a worker failure            | failed                         |
        | a blocked coordinator result | blocked                        |
        | a degraded reviewer approval | approved                      |
        | a degraded reviewer rejection | changes_requested            |
        | a review of changed sources | stale                          |

    @rejection
    Scenario: Self-review routing cannot claim independence
      Given reviewer routing resolves only to the requesting agent
      When Codex starts a Safeword review
      Then the coordinator blocks that route
      And independent completion is false

    @rejection
    Scenario Outline: Unavailable review IDs never count as completion
      Given the review ID is <id_condition>
      When Codex checks its status
      Then Safeword returns a bounded unknown-review error
      And it does not claim independent completion

      Examples:
        | id_condition                    |
        | unknown                         |
        | unknown after an MCP restart    |

    Scenario: A completed review remains verifiable after an MCP restart
      Given a completed independent review has a signed receipt and the MCP server has restarted
      When Codex checks the review status
      Then Safeword reports the stored terminal verdict and independent completion

    @rejection
    Scenario: Changed sources invalidate the receipt
      Given a signed review receipt for a source file that changed after review
      When the normal Safeword gate verifies the receipt
      Then it rejects the receipt as stale
      And it does not report independent completion

    @rejection
    Scenario: Edited review receipts cannot claim independent approval
      Given a coordinator receipt whose verdict was changed from request_changes to approve while the source stayed unchanged
      When the normal Safeword gate verifies the receipt
      Then it rejects the mismatched signature
      And it does not report independent completion

  @prompt-free-codex-reviews.TBU1.R4
  @surface.claude-code
  Rule: prompt-free-codex-reviews.TBU1.R4 - Sign in to the assigned reviewer

    Scenario: Review status identifies the assigned reviewer's authentication gap
      Given a signed review is blocked because its assigned reviewer is signed out
      When the agent calls review_status for that review ID
      Then the result contains REVIEW_AUTHENTICATION_REQUIRED and names the assigned reviewer
      And independent completion is false

    @manual
    @live
    Scenario: Reviewer sign-in uses the exact URL printed by the assigned CLI
      Given an installed Codex host has a signed review assigning the signed-out Claude reviewer
      When the agent calls start_reviewer_login for that review
      Then the tool launches only the assigned Claude login CLI outside the author shell sandbox
      And it returns the CLI's complete official HTTPS URL as text and an MCP Apps view

    Scenario: Reviewer login runs away from project configuration
      Given a signed review assigns a signed-out reviewer in a project with a project-controlled environment and CLI files
      When start_reviewer_login launches the assigned built-in vendor command
      Then the CLI runs in a temporary directory with only the filtered vendor environment
      And the project cannot replace its executable or arguments

    Scenario: A second login cannot run beside the first for one review
      Given a signed review has one assigned reviewer login CLI still running
      When start_reviewer_login is called again for that review
      Then it rejects the duplicate without starting another CLI

    Scenario Outline: An abandoned reviewer login terminates
      Given a signed review has one assigned reviewer login CLI still running
      When <end_condition> occurs
      Then that login process ends

      Examples:
        | end_condition                    |
        | the ten-minute deadline passes  |
        | the MCP server shuts down       |

    Scenario: A blocked review can start a fresh login after its prior CLI ends
      Given the assigned reviewer login CLI for a signed blocked review has exited
      When start_reviewer_login is called again for that review
      Then it launches a fresh assigned reviewer CLI and returns its newly printed URL
      And the prior captured URL is unavailable to show_reviewer_login

    Scenario: Reviewer sign-in details are unavailable after the MCP server restarts
      Given an assigned reviewer CLI printed an official sign-in URL and device code for a signed blocked review
      When the review MCP server restarts
      Then show_reviewer_login cannot display the prior URL or device code

    @manual
    @live
    Scenario: Claude host displays the Codex device sign-in code
      Given the Safeword Claude plugin is installed and a signed review assigns the signed-out Codex reviewer
      When Claude calls start_reviewer_login for that review
      Then the tool launches only the Codex device-login CLI
      And it returns the exact official URL and exact device code printed by that CLI together

    @manual
    @live
    @demo
    Scenario: Signing in lets the same review finish independently
      Given a review was blocked because its assigned reviewer was signed out
      And start_reviewer_login displayed the CLI-generated URL and any device code
      And the user has completed vendor sign-in
      When the agent retries that review
      Then the assigned different reviewer returns a terminal verdict with a signed receipt
      And the normal Safeword gate accepts the independent review evidence
      And the agent dispatches no more than one retry after sign-in

    @rejection
    Scenario: A login that fails before printing a URL gives no review evidence
      Given a signed review result says the assigned Codex reviewer needs authentication
      When the assigned login CLI exits before printing a sign-in URL
      Then start_reviewer_login reports a bounded error without a browser-open request
      And the review does not count as independent completion

    @rejection
    Scenario: An authentication error alone cannot create a sign-in link
      Given a signed review says the assigned reviewer needs authentication
      And no reviewer CLI has printed a URL for that review
      When show_reviewer_login receives an invented official-domain URL
      Then it rejects the URL without rendering a view or opening a browser

    @rejection
    Scenario Outline: Login tools reject reviews that do not need authentication
      Given the requested review ID is <review_state>
      When the agent calls start_reviewer_login for that review
      Then the tool rejects the request before launching any reviewer CLI
      And no sign-in URL or device code is returned

      Examples:
        | review_state                         |
        | unknown                              |
        | backed by a tampered receipt         |
        | already terminal without an auth gap |

    @rejection
    Scenario Outline: Unsupported sign-in URLs are rejected
      Given a signed review result names the assigned reviewer
      When show_reviewer_login receives <invalid_url>
      Then it rejects the URL without requesting a browser open

      Examples:
        | invalid_url                              |
        | a non-HTTPS URL                          |
        | a URL outside that reviewer's domains   |

    @rejection
    Scenario: A different official sign-in URL is rejected
      Given the assigned reviewer CLI for a signed review has printed official sign-in URL A
      When show_reviewer_login receives different official-domain URL B for that review
      Then it rejects the URL without rendering a view or requesting a browser open

    @rejection
    Scenario: The login tool never opens an off-domain CLI URL
      Given a signed review needs the assigned reviewer to sign in
      And that reviewer CLI prints an HTTPS URL outside its official sign-in domains
      When start_reviewer_login captures the CLI output
      Then it returns a bounded error without a browser-open request or view render

    @manual
    @live
    Scenario: An official URL can be displayed for its signed review
      Given an installed host has a signed review assigning a signed-out reviewer
      And the actual reviewer CLI has printed an official HTTPS sign-in URL
      When show_reviewer_login receives that exact URL for the review
      Then it returns the same URL in text and the MCP Apps view
      And the view waits for a user click before opening that caller-supplied URL

    @manual
    @live
    Scenario: The login tool opens the default browser without a shell
      Given an installed host has a signed review needing authentication and the actual reviewer CLI printed its URL
      When start_reviewer_login requests the local default browser
      Then it invokes a fixed OS opener with the complete URL as one argument and no shell

    @rejection
    Scenario Outline: Shell syntax in an official sign-in URL stays data
      Given the assigned reviewer CLI printed an official-domain HTTPS URL containing <url_content>
      When start_reviewer_login requests the local default browser
      Then it passes the complete URL as one argument to a fixed opener without a shell
      And no URL content is executed as a command

      Examples:
        | url_content                     |
        | command-substitution characters |
        | whitespace in a query value     |

    @live
    Scenario: MCP Apps asks the host when the local browser opener cannot start
      Given a signed review needs authentication and its actual reviewer CLI generated a URL
      When the local OS opener cannot start
      Then the MCP Apps view requests that the host open the exact URL

    @manual
    @live
    Scenario: A blocked browser opener leaves a clickable sign-in link
      Given an installed host has a signed review needing authentication and its actual reviewer CLI generated a sign-in URL
      When neither the MCP Apps view nor the local browser opener can open that URL
      Then it presents the exact clickable URL and code in chat
