# The bounded MCP server has direct Vitest coverage and an installed-plugin
# end-to-end probe; Cucumber has no process-level MCP step definitions.
@manual @surface.openai-codex
Feature: Run independent Codex reviews without permission setup

  @prompt-free-codex-reviews.TBU1.R1
  Rule: prompt-free-codex-reviews.TBU1.R1 - Narrow review interface

    Scenario: Safeword exposes only bounded review operations
      Given the Safeword Codex plugin is installed
      When Codex lists the Safeword review MCP tools
      Then the tool list contains exactly start_review and review_status
      And it does not expose executable RED or a general command runner

    @live
    Scenario Outline: Every review kind returns a terminal verdict through MCP
      Given the built Safeword plugin is installed with a valid <kind> review packet
      When Codex starts a <kind> review through MCP and polls to terminal status
      Then the review reports independent completion with a reviewer verdict for <kind>
      And the signed review receipt records <kind> as the reviewed kind
      And authored project files remain unchanged
      And the coordinator stores a signed review receipt

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
      Then the coordinator reports a blocked review without provider dispatch

    Scenario Outline: Packet size follows the coordinator boundary
      Given a review packet is <size_class> the coordinator packet limit
      When Codex starts the review through MCP
      Then the coordinator <outcome>

      Examples:
        | size_class | outcome                                                |
        | at         | dispatches the packet to the reviewer                   |
        | above      | returns a bounded error before reviewer dispatch        |

  @prompt-free-codex-reviews.TBU1.R2
  Rule: prompt-free-codex-reviews.TBU1.R2 - Installation needs no permission profile change

    Scenario Outline: Generated review guidance names the MCP tools for every kind
      Given the generated Safeword <kind> review instruction
      When Codex reads that instruction
      Then the instruction names the MCP start and status tools
      And it contains no shell review dispatch for Codex
      And it discloses that the bounded packet goes to a reviewer provider

      Examples:
        | kind     |
        | quality  |
        | scenario |
        | plan     |

    Scenario: Plugin installation makes the review tools available
      Given a fresh Codex home with the built-in workspace profile
      When Safeword is installed from its plugin package
      Then Codex discovers the Safeword review tools from the installed runtime
      And Codex permission settings and rules are unchanged

    Scenario: Upgrading the plugin preserves customer permissions
      Given an earlier Safeword plugin install and customer-authored Codex permission settings
      When Safeword upgrades the bundled review runtime
      Then Codex discovers the upgraded review tools
      And the customer's Codex permission settings and rules are unchanged

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
  Rule: prompt-free-codex-reviews.TBU1.R3 - Terminal proof under default permissions

    @live
    @demo
    Scenario: Independent review finishes without a prompt under workspace permissions
      Given the built Safeword plugin is installed in a disposable Codex home with a synthetic repository containing a known defect and shell network is denied
      When Codex runs a Safeword quality review to terminal status under the built-in workspace profile
      Then a different reviewer returns request_changes with a finding that names the seeded file
      And the Codex run records zero approval requests
      And the signed review receipt can be verified by the normal Safeword gate
      And the synthetic source remains unchanged

    @rejection
    Scenario Outline: Non-independent review states never count as completion
      Given a Safeword review has <actual_outcome>
      When Codex checks its status
      Then Safeword reports <reported_state>
      And independent completion is false

      Examples:
        | actual_outcome              | reported_state                 |
        | not finished                | running                        |
        | a worker failure            | failed                         |
        | a blocked coordinator result | blocked                        |
        | a degraded reviewer result  | degraded                       |

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

    @rejection
    Scenario: Edited review receipts cannot claim independent approval
      Given a coordinator receipt whose verdict was changed from request_changes to approve while the source stayed unchanged
      When the normal Safeword gate verifies the receipt
      Then it rejects the mismatched signature
      And it does not report independent completion
