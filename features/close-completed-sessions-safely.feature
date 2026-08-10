# Collaborator actions and host invocation require hash-bound independent review;
# deterministic guard, wiring, and parity behavior remains covered by Vitest.
@manual
Feature: Close completed sessions safely

  @close-completed-sessions-safely.NTB1.R1
  Rule: close-completed-sessions-safely.NTB1.R1 — Completion is reported only from independently observed delivery and cleanup state

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Current delivery evidence makes an authorized merge eligible
      Given local verification covers the pull request head
      And every required hosted check and review requirement is satisfied
      And the pull request is ready for review
      When closeout evaluates the delivery
      Then it reports the delivery ready for an authorized merge without claiming completion

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Incomplete delivery evidence blocks merge and cleanup
      Given the delivery has "<blocker>"
      When closeout evaluates the delivery
      Then it performs no merge or cleanup and reports "<resolution>"

      Examples:
        | blocker                         | resolution                              |
        | missing local verification       | run current local verification           |
        | stale local verification         | verify the pull request head             |
        | failing local verification       | fix the local verification failure       |
        | a pending required hosted check  | wait for the required check              |
        | a failing required hosted check  | fix the hosted check failure             |
        | an unresolved review requirement | resolve the review requirement           |
        | draft pull request state         | mark the pull request ready when approved |
        | auto-merge enabled but not merged | wait for a confirmed merged state         |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A fully closed delivery reports every final state
      Given verification is current, the pull request is merged, retro is complete, and cleanup is complete
      When closeout reports the result
      Then it reports verification, merge state and commit, retro, remote branch, local branch, worktree, and no unresolved items

  @close-completed-sessions-safely.NTB1.R2
  Rule: close-completed-sessions-safely.NTB1.R2 — Retrospective capture is a mandatory prerequisite to destructive cleanup

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Retro extraction runs in the bound host runtime
      Given the closeout command is bound to a "<host>" session and its exact transcript
      When closeout runs the mandatory retrospective
      Then it selects the "<extractor>" headless extractor

      Examples:
        | host          | extractor    |
        | Claude Code   | Claude Code  |
        | OpenAI Codex  | OpenAI Codex |
        | Cursor        | Cursor Agent |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: A completed retro permits cleanup
      Given the pull request is confirmed merged
      And retro completed with "<result>"
      And the filing spool is empty
      When closeout advances to cleanup
      Then it proceeds to validate the exact worktree and branch cleanup targets

      Examples:
        | result                    |
        | zero substantial findings |
        | every finding filed        |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Incomplete retro blocks cleanup
      Given the pull request is confirmed merged
      And retro has "<state>"
      When closeout advances to cleanup
      Then it performs no cleanup and reports "<resolution>"

      Examples:
        | state                         | resolution                         |
        | not run                       | run the retrospective              |
        | failed extraction             | resolve the extraction failure     |
        | failed filing                 | resolve the filing failure         |
        | pending drafts in the spool   | drain the filing spool             |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Filing completed retro drafts resumes without re-extraction
      Given retrospective extraction completed and left filing drafts for the bound session
      When the user files every pending draft and closeout resumes
      Then it treats the retrospective as complete without re-running extraction and validates cleanup

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A request to skip retro does not create a bypass
      Given retro is incomplete
      When the user asks closeout to skip retro
      Then closeout preserves the branch and worktree and reports retro as required

  @close-completed-sessions-safely.NTB1.R3
  Rule: close-completed-sessions-safely.NTB1.R3 — An interrupted closeout resumes from observed state and reports every unresolved item

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Closeout continues only the unfinished suffix
      Given a previous closeout stopped after "<completed>"
      And current observation confirms that completed state
      And current merge authority is "<authority>"
      When closeout resumes
      Then its next action is "<next>"

      Examples:
        | completed                                   | authority             | next                                                   |
        | verification                                | absent                | report ready without attempting a merge                |
        | verification                                | explicit normal merge | attempt the authorized policy-compliant merge           |
        | entry into the merge queue                  | already exercised     | wait for a confirmed merged state                      |
        | confirmed merge and completed retro         | already exercised     | clean the exact targets                                |
        | worktree removal and remote branch removal  | already exercised     | remove the exact local branch                          |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Exact evidence is reused through preview, replay, and approved apply
      Given the exact clean merged head has current verification and a completed retrospective snapshot bound to "<runtime>"
      When closeout is previewed, replayed, and approved with unchanged evidence
      Then it runs each verification lane and the retrospective once before applying cleanup

      Examples:
        | runtime       |
        | Claude Code   |
        | OpenAI Codex  |
        | Cursor        |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Changed evidence invalidates the matching cached prerequisite
      Given the exact clean merged head has completed closeout evidence
      And "<change>" changes after its snapshot
      When closeout resumes
      Then it does not reuse the cached "<prerequisite>" and does not clean up until it passes again

      Examples:
        | change                      | prerequisite   |
        | the working tree             | verification   |
        | the bound session transcript is rewritten | retrospective  |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A local merge-command error after remote success is partial success
      Given the merge command reported a local cleanup error
      And fresh pull request state confirms the expected head was merged
      When closeout re-evaluates the delivery
      Then it reports the merge as successful, does not retry the merge, and next evaluates retrospective completion

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: An unconfirmed merge result stops safely
      Given a prior merge action "<result>" and its remote effect cannot be observed
      When closeout resumes
      Then it repeats no destructive action and reports the unknown state with a recovery check

      Examples:
        | result            |
        | returned success  |
        | returned an error |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A blocked closeout reports every simultaneous unresolved item
      Given local verification is stale, a required hosted check is pending, and the exact linked worktree is dirty
      When closeout reports the blocked result
      Then it performs no merge or cleanup and names all three unresolved items with their recovery actions

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Re-running a completed closeout is unchanged
      Given the expected pull request is merged, retro is complete, and every exact cleanup target is absent
      When closeout runs again
      Then it performs no destructive action and reports the session already closed

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: New dependency intelligence does not strand cleanup of an immutable merged head
      Given delivery-time verification including dependency audit passed before merge
      And the exact pull request head is confirmed merged
      And a dependency advisory published after merge now affects that immutable head
      When closeout revalidates the merged head for cleanup
      Then it reruns verification, build, typecheck, and BDD without rerunning dependency audit

  @close-completed-sessions-safely.TBU1.R1
  Rule: close-completed-sessions-safely.TBU1.R1 — Merge actions never exceed the authority explicitly granted by the user

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Explicit authority bounds the merge action
      Given the delivery is ready to merge
      And the user granted "<authority>"
      When closeout reaches the merge boundary
      Then it "<outcome>"

      Examples:
        | authority                    | outcome                                                   |
        | no merge authority           | reports readiness without attempting a merge              |
        | normal merge authority       | attempts a policy-compliant merge without bypassing rules |
        | administrative merge authority | attempts the explicitly authorized administrative merge   |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Normal authority never escalates to an administrative merge
      Given the user authorized a normal merge
      And repository requirements block that merge
      When closeout reaches the merge boundary
      Then it reports the blocking requirements without attempting an administrative merge

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Historical or implied admin intent is insufficient
      Given the current closeout request does not explicitly authorize an administrative merge
      When closeout considers bypassing repository requirements
      Then it does not bypass them and asks for current explicit authority

  @close-completed-sessions-safely.TBU1.R2
  Rule: close-completed-sessions-safely.TBU1.R2 — Cleanup targets only the confirmed merged pull request's exact topic branch and linked worktree

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Missing, ambiguous, or unmerged pull request identity blocks cleanup
      Given cleanup resolves the topic branch to "<pull-request-state>"
      When closeout evaluates cleanup
      Then it performs no deletion and reports that exact merged pull request identity is required

      Examples:
        | pull-request-state                            |
        | no matching pull request                      |
        | multiple matching pull requests               |
        | one matching pull request that is not merged  |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Exact merged identity permits ordered cleanup
      Given the pull request is confirmed merged with a recorded head name and head commit
      And the clean linked worktree and local and remote branches match that identity
      And retro is complete with an empty filing spool
      When closeout performs cleanup
      Then it removes the linked worktree before the matching remote and local branches

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A squash or rebase merge can clean an exact non-ancestor branch
      Given the pull request is confirmed squash-merged or rebase-merged
      And the local branch commit exactly matches the pull request head commit
      And no worktree uses the branch
      When closeout removes the local topic branch
      Then the exact branch is removed despite not being an ancestor of the base branch

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Already absent exact targets remain complete
      Given the pull request is confirmed merged and the target identity was established
      And one or more exact cleanup targets are already absent
      When closeout performs cleanup
      Then it treats those targets as complete and removes only the remaining exact targets

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A merged topic branch with no linked worktree cleans only its exact branches
      Given the pull request is confirmed merged with an exact head identity
      And no linked worktree exists for that branch
      And retro is complete with an empty filing spool
      When closeout performs cleanup
      Then it removes only the matching remote and local branches

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Changed branch identity is preserved
      Given the pull request is confirmed merged
      And "<target>" no longer matches the recorded pull request head
      When closeout performs cleanup
      Then it preserves that target and reports the identity mismatch

      Examples:
        | target        |
        | local branch  |
        | remote branch |

  @close-completed-sessions-safely.TBU1.R3
  Rule: close-completed-sessions-safely.TBU1.R3 — Protected, dirty, locked, main, or ambiguous targets are preserved and reported instead of force-removed

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Unsafe worktree targets are never removed
      Given the candidate cleanup target is "<state>"
      When closeout evaluates worktree removal
      Then it uses no force option, preserves the target, and reports "<resolution>"

      Examples:
        | state                         | resolution                                  |
        | the main worktree             | main worktrees are never closeout targets   |
        | a dirty linked worktree       | review or commit the uncommitted changes    |
        | a locked linked worktree      | review the lock reason before unlocking     |
        | an ambiguous linked worktree  | resolve the exact target identity           |
        | a stale worktree registration | repair or prune the registration explicitly |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A branch used by a different worktree is preserved
      Given the exact topic branch is checked out by a worktree outside the confirmed target
      When closeout evaluates branch deletion
      Then it preserves the branch and reports the other worktree path

  @close-completed-sessions-safely.TBU1.R4
  Rule: close-completed-sessions-safely.TBU1.R4 — The same closeout contract is available through every supported local agent runtime

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Each local host entry point drives the canonical closeout workflow
      Given a project installed for "<runtime>" with a completed delivery and observable real collaborator state
      When the user invokes the installed closeout entry point
      Then the canonical workflow observes verification, merge state, retro state, and exact cleanup targets

      Examples:
        | runtime       |
        | Claude Code   |
        | OpenAI Codex  |
        | Cursor        |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Synchronized closeout artifacts pass host parity
      Given the canonical skill and generated Claude Code, OpenAI Codex, and Cursor artifacts carry the closeout contract
      When Safeword checks workflow parity
      Then every closeout parity pair and action entry point passes

    @surface.openai-codex
    Scenario: Codex Desktop binds closeout from its authenticated thread environment
      Given Codex Desktop exposes the current thread identity to the closeout process
      And no fresh pre-tool binding cache is available
      When the user previews closeout from that task
      Then closeout binds the current Codex thread and evaluates the exact merged delivery

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Closeout drift fails parity at the changed surface
      Given the "<surface>" artifact omits a required closeout behavior
      When Safeword checks workflow parity
      Then parity fails and names "<surface>"

      Examples:
        | surface            |
        | canonical template |
        | dogfood Claude     |
        | generated Codex    |
        | generated Cursor   |
