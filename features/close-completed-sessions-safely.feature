# Collaborator actions and host invocation require hash-bound independent review;
# deterministic guard, wiring, and parity behavior remains covered by Vitest.
@proof.vitest
Feature: Close completed sessions safely

  @close-completed-sessions-safely.NTB1.R1
  Rule: close-completed-sessions-safely.NTB1.R1 — Completion is reported only from independently observed delivery and cleanup state

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Current delivery evidence makes an authorized merge eligible
      Given local verification covers the pull request head
      And every required hosted check and review requirement is satisfied
      And the pull request is ready for review
      And the current request explicitly authorizes a normal merge
      When closeout evaluates the delivery
      Then it attempts exactly one policy-compliant merge without claiming completion before remote confirmation

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Incomplete delivery evidence blocks cleanup
      Given the delivery evidence is incomplete or stale
      When closeout evaluates the delivery
      Then it performs no cleanup and reports the verification recovery

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Closeout guidance documents every final state
      Given verification is current, the pull request is merged, retro is complete, and cleanup is complete
      When closeout reports the result
      Then it reports verification, merge state and commit, retro, remote branch, local branch, worktree, and no unresolved items

  @close-completed-sessions-safely.NTB1.R2
  Rule: close-completed-sessions-safely.NTB1.R2 — Retrospective capture is mandatory evidence but never strands repository cleanup

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
    Scenario Outline: Retro subprocess failures remain visible while cleanup continues
      Given the selected extractor receives the exact bound session identity and transcript
      And the extractor "<failure>"
      When closeout runs the mandatory retrospective
      Then it reports retrospective recovery and keeps exact repository cleanup eligible

      Examples:
        | failure                  |
        | exits unsuccessfully     |
        | times out                 |
        | returns malformed output |

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
    Scenario Outline: Incomplete retro is reported while repository cleanup continues
      Given the pull request is confirmed merged
      And retro has "<state>"
      When closeout advances to cleanup
      Then it performs exact cleanup and reports "<resolution>"

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

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A request to skip retro does not hide its advisory state
      Given retro is incomplete
      When the user asks closeout to skip retro
      Then closeout continues exact cleanup and reports retro as incomplete

  @close-completed-sessions-safely.NTB1.R3
  Rule: close-completed-sessions-safely.NTB1.R3 — An interrupted closeout resumes from observed state and reports every unresolved item

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Closeout continues only the unfinished suffix
      Given a previous closeout stopped after a durable completed phase
      And current observation confirms that completed state
      And current merge authority is observed again
      When closeout resumes
      Then it re-observes delivery truth and continues only the unfinished suffix

    @surface.claude-code
    Scenario: Exact evidence is reused through preview, replay, and approved apply
      Given the exact clean merged head has current verification and a completed retrospective snapshot bound to "Claude Code"
      When closeout is previewed, replayed, and approved with unchanged evidence
      Then it runs each verification lane and the retrospective once before applying cleanup

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Changed evidence invalidates the matching cached prerequisite
      Given the exact clean merged head has completed closeout evidence
      And "<change>" changes after its snapshot
      When closeout resumes
      Then it does not reuse the cached "<prerequisite>" and does not clean up until it passes again

      Examples:
        | change                      | prerequisite   |
        | the working tree             | verification   |
        | the bound session transcript | retrospective  |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A local merge-command error after remote success is partial success
      Given the merge command reported a local cleanup error
      And fresh pull request state confirms the expected head was merged
      When closeout re-evaluates the delivery
      Then it reports the merge as successful, does not retry the merge, and next evaluates retrospective completion

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: An unconfirmed merge result stops safely
      Given a prior merge action has no observable remote effect
      When closeout resumes
      Then it repeats no destructive action and reports the unknown state with a recovery check

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Closeout guidance documents every simultaneous unresolved item
      Given local verification is stale, a required hosted check is pending, and the exact linked worktree is dirty
      When closeout reports the blocked result
      Then it performs no merge or cleanup and names all three unresolved items with their recovery actions

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Closeout guidance documents unresolved state across every phase
      Given merge confirmation is unknown, retro extraction failed, remote cleanup failed, and local branch identity changed
      When closeout reports the blocked result
      Then it performs no further mutation and reports all four unresolved items with resumable recovery actions

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

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Append-only host progress preserves cleanup authorization
      Given an authorized cleanup preview with a completed retrospective
      And the bound transcript grows append-only before apply
      And the mandatory refreshed retrospective reports no unresolved work
      When closeout refreshes the retrospective and applies the preview
      Then cleanup completes with the previewed exact targets

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Appended session friction remains advisory during cleanup
      Given an authorized cleanup preview with a completed retrospective
      And the bound transcript grows append-only before apply
      And the mandatory refreshed retrospective reports unresolved work
      When closeout refreshes the retrospective and applies the preview
      Then cleanup completes with the previewed exact targets
      And the incomplete retrospective is reported as an advisory

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Every transcript mutation invalidates the retrospective snapshot
      Given an authorized cleanup preview bound to the exact transcript bytes
      And the transcript is changed by "<mutation>"
      When closeout reaches apply
      Then it refreshes the retrospective before any cleanup and proceeds only from the refreshed result

      Examples:
        | mutation                         |
        | metadata-only appended records   |
        | mixed host and user records       |
        | reordered existing records        |
        | truncated existing records        |
        | an ambiguous unclassified record  |

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
    Scenario: The pull request head changing after readiness blocks merge
      Given current verification and merge authority bind the exact observed pull request head
      And the pull request head changes after readiness evaluation
      When closeout attempts the authorized merge
      Then compare-before-merge rejects the attempt without merging either head

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
      And the current cleanup approval binds the preview digest and every exact target identity
      When closeout performs cleanup
      Then it removes the linked worktree, remote branch, and local branch in that exact order

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Cleanup approval cannot be replayed after identity changes
      Given cleanup approval binds the previewed repository, pull request, branch, worktree, and target identities
      And "<identity-change>" occurs before apply
      When closeout performs cleanup
      Then it performs no deletion and requires a fresh preview and cleanup approval

      Examples:
        | identity-change                 |
        | the repository changes          |
        | the pull request changes        |
        | the branch head changes         |
        | the worktree identity changes   |
        | a cleanup target is replaced    |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: A failed cleanup operation stops its unfinished suffix
      Given exact cleanup targets are ordered as worktree, remote branch, then local branch
      And removing the "<failed-target>" fails
      When closeout performs cleanup
      Then it reports completed earlier operations, leaves the failed target and exact unfinished suffix present, and retries only that suffix on resume

      Examples:
        | failed-target |
        | worktree      |
        | remote branch |
        | local branch  |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: A squash or rebase merge can clean an exact non-ancestor branch
      Given the pull request is confirmed squash-merged or rebase-merged
      And the local branch commit exactly matches the pull request head commit
      And no worktree uses the branch
      And retro is complete with an empty filing spool
      When closeout removes the local topic branch
      Then the exact branch is removed despite not being an ancestor of the base branch

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Already absent exact targets remain complete
      Given the pull request is confirmed merged and the target identity was established
      And one or more exact cleanup targets are already absent
      And retro is complete with an empty filing spool
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

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Remote cleanup requires exact pull request repository identity
      Given the merged pull request records its exact head repository, remote URL, branch name, and head commit
      And remote resolution yields "<remote-state>"
      When closeout performs cleanup
      Then it preserves every remote ref and reports that exact remote identity is required

      Examples:
        | remote-state                         |
        | a changed remote URL                 |
        | multiple matching remotes            |
        | a fork-owned head repository         |

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

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Protected and default branches are never cleanup targets
      Given the candidate branch is "<protected-state>"
      When closeout evaluates branch deletion
      Then it performs no deletion, force, or policy bypass and reports the protected target

      Examples:
        | protected-state                         |
        | the default branch                      |
        | protected by repository branch policy   |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Mutation-time branch changes are rejected by an OID lease
      Given an authorized cleanup preview records the exact target identity
      And "<branch-change>" occurs after validation but before its deletion
      When closeout executes that target operation
      Then the expected-OID lease rejects the deletion, the ref remains at its new OID, and closeout reports recovery

      Examples:
        | branch-change              |
        | the local branch advances  |
        | the remote branch advances |

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Mutation-time worktree identity changes prevent the removal command
      Given an authorized cleanup preview records the exact linked worktree state
      And the worktree's registered or filesystem identity changes at the operation boundary
      When closeout executes worktree removal
      Then the removal boundary re-observes that state, issues no removal command, preserves the worktree, and reports recovery

    @rejection @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Untrusted target text cannot become command syntax
      Given an exact cleanup target contains "<hostile-text>"
      When closeout constructs and validates the destructive operation
      Then it passes the target as a structured argument, performs no shell evaluation or path traversal, and preserves any ambiguous target

      Examples:
        | hostile-text                    |
        | an option-like leading dash     |
        | whitespace or control characters |
        | shell metacharacters            |

  @close-completed-sessions-safely.TBU1.R4
  Rule: close-completed-sessions-safely.TBU1.R4 — The same closeout contract is available through every supported local agent runtime

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Each local host entry point drives the canonical closeout workflow
      Given a project installed for "<runtime>" with a completed delivery and observable real collaborator state
      When the user invokes the installed closeout entry point
      Then the canonical workflow observes verification, merge state, retro state, and exact cleanup targets
      And it forwards the bound session environment and requested pull request unchanged

      Examples:
        | runtime       |
        | Claude Code   |
        | OpenAI Codex  |
        | Cursor        |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario Outline: Host guidance documents equivalent outcomes for closeout states
      Given every installed runtime's guidance covers the same "<delivery-state>" and bound-session evidence
      When the canonical closeout contract is inspected
      Then every runtime documents the same decision, allowed mutations, and unresolved state

      Examples:
        | delivery-state                  |
        | completed cleanup               |
        | missing session binding         |
        | incomplete retrospective        |
        | changed branch identity         |

    @surface.claude-code @surface.openai-codex @surface.cursor
    Scenario: Installed cleanup treats a missing fresh binding as advisory
      Given an installed project has no fresh host session binding
      When the user invokes the installed closeout entry point
      Then cleanup remains available and reports that a fresh binding is advisory

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
