Feature: Choose where Safeword runs in Claude

  @choose-claude-plugin-scope.TBU1.R1 @surface.claude-code @surface.safeword-cli
  Rule: choose-claude-plugin-scope.TBU1.R1 — User scope is the default while project scope remains an explicit supported choice

    Scenario Outline: Fresh installation uses only the requested activation boundary
      Given the current project and Claude profile have no Safeword plugin declaration
      When safeword claude install runs with <scope-option>
      Then the exact official Safeword plugin is enabled at <expected-scope> for the current project
      And the <unselected-scope> plugin and marketplace declarations remain absent
      And the result reports <expected-scope> as the selected scope

      Examples:
        | scope-option    | expected-scope | unselected-scope |
        | no scope option | user           | project          |
        | --scope project | project        | user             |
        | --scope user    | user           | project          |

    Scenario: Identical project and user records for one loaded installation use project scope
      Given the current project has applicable project and user installations with the same exact version
      When safeword claude status runs
      Then status reports project as the applicable Safeword scope
      And project and profile state remain byte-identical

    @rejection
    Scenario Outline: Unsupported scope is rejected before mutation
      Given arbitrary project and Claude profile state
      When safeword claude install runs with <scope-option>
      Then installation rejects the unsupported scope
      And project and profile state remain byte-identical

      Examples:
        | scope-option    |
        | --scope local   |
        | --scope invalid |
        | --scope with no value |

  @choose-claude-plugin-scope.TBU1.R2 @surface.claude-code @surface.safeword-cli
  Rule: choose-claude-plugin-scope.TBU1.R2 — Installation and upgrade mutate only the selected scope and preserve unrelated state

    Scenario Outline: An older official installation upgrades only in the selected scope
      Given Safeword has an older official installation at <selected-scope>
      And the other Claude scope has independent plugin state
      When safeword claude install runs with --scope <selected-scope>
      Then the exact official Safeword plugin is enabled at <selected-scope> for the current project
      And the other scope's declaration is byte-identical

      Examples:
        | selected-scope |
        | project        |
        | user           |

    Scenario Outline: First installation in one scope preserves an existing installation in the other
      Given Safeword has no installation at <selected-scope>
      And Safeword has an exact installation at <other-scope>
      When safeword claude install runs with --scope <selected-scope>
      Then the exact official Safeword plugin is enabled at <selected-scope> for the current project
      And the <other-scope> installation is byte-identical
      And the result reports scope-overlap

      Examples:
        | selected-scope | other-scope |
        | project        | user        |
        | user           | project     |

    Scenario Outline: A disabled exact installation is enabled only in the selected scope
      Given Safeword has a disabled exact installation at <selected-scope>
      And the other Claude scope has independent plugin state
      When safeword claude install runs with --scope <selected-scope>
      Then the exact official Safeword plugin is enabled at <selected-scope> for the current project
      And the other scope's declaration is byte-identical

      Examples:
        | selected-scope |
        | project        |
        | user           |

    @rejection
    Scenario Outline: Unsafe selected-scope metadata is refused without an implicit downgrade
      Given Safeword has <selected-state> at <selected-scope>
      And the other Claude scope has independent plugin state
      When safeword claude install runs with --scope <selected-scope>
      Then installation reports <classification> without changing the selected installation
      And the other scope's declaration and unrelated state are byte-identical

      Examples:
        | selected-state                         | selected-scope | classification       |
        | malformed plugin metadata              | user           | unverified metadata  |
        | a newer official plugin version        | project        | downgrade refused    |

    Scenario: Project installation preserves unrelated repository settings
      Given the current project has user-authored and third-party Claude settings
      When safeword claude install runs with --scope project
      Then only the official marketplace, failure fallback, and Safeword plugin declarations are added at project scope
      And every unrelated project setting value is preserved
      And every project file outside Claude settings is byte-identical

    Scenario: User installation leaves the repository unchanged
      Given the current project and Claude profile have no Safeword plugin declaration
      When safeword claude install runs with --scope user
      Then the exact official Safeword plugin is enabled at user scope for the current project
      And every project file is byte-identical

    @rejection
    Scenario Outline: Selected-scope operation failure is reported without touching the other scope
      Given Safeword has independent declarations at project and user scope
      And the selected <selected-scope> installation is prepared so <completed-effects> complete before <failing-operation> fails
      When safeword claude install runs with --scope <selected-scope>
      Then installation reports that <failing-operation> failed
      And it reports exactly <completed-effects> as completed
      And the other scope's declaration and unrelated state are byte-identical

      Examples:
        | selected-scope | completed-effects       | failing-operation |
        | project        | no mutation              | marketplace add   |
        | user           | marketplace registration | plugin update     |

    @rejection
    Scenario: Postcondition verification failure reports completed selected-scope work
      Given the project-scope marketplace and plugin mutations will complete
      And observing the final project-scope installation will fail
      When safeword claude install runs with --scope project
      Then installation reports postcondition verification failure
      And it reports the marketplace and plugin mutations as completed
      And the user-scope declaration and unrelated state are byte-identical

  @choose-claude-plugin-scope.TBU1.R3 @surface.claude-code @surface.safeword-cli
  Rule: choose-claude-plugin-scope.TBU1.R3 — Repeating installation in either scope is idempotent

    Scenario Outline: Repeating an exact scoped installation is a no-op
      Given the exact official Safeword plugin is enabled at <selected-scope> for the current project
      When safeword claude install runs with --scope <selected-scope>
      Then selected-scope plugin and marketplace state are byte-identical
      And unrelated project and profile state are byte-identical
      And the result reports no completed mutation

      Examples:
        | selected-scope |
        | project        |
        | user           |

    Scenario: A filesystem alias does not create a duplicate project installation
      Given an exact project installation is recorded at the canonical project root
      And the project is accessed through a filesystem alias
      When safeword claude install runs with --scope project
      Then selected-scope plugin and marketplace state are byte-identical
      And the result reports no completed mutation

    @rejection
    Scenario Outline: Damaged selected-scope cache is not mistaken for an idempotent installation
      Given the selected <selected-scope> installation reports the exact version from a damaged cache
      When safeword claude install runs with --scope <selected-scope>
      Then installation fails as unverified without reporting a no-op
      And unrelated project and profile state are byte-identical

      Examples:
        | selected-scope |
        | project        |
        | user           |

  @choose-claude-plugin-scope.NTB1.R1 @surface.claude-code @surface.safeword-cli
  Rule: choose-claude-plugin-scope.NTB1.R1 — Status identifies the applicable scope and reports overlap without silently removing protection

    Scenario Outline: Status identifies one applicable installation for the current project
      Given the profile contains <installation-state>
      When safeword claude status runs
      Then status reports <applicable-scope> as the applicable Safeword scope
      And human status names <applicable-scope> as the configured scope
      And project and profile state remain byte-identical

      Examples:
        | installation-state                                      | applicable-scope |
        | an exact project installation for the current project and no user installation | project |
        | an exact user installation and no current-project entry                        | user    |
        | an exact user installation and another project's entry                         | user    |

    Scenario: Status reports no applicable installation for the current project
      Given neither the current project nor the Claude profile contains an applicable Safeword installation
      When safeword claude status runs
      Then status reports that Safeword is not installed for the current project
      And project and profile state remain byte-identical

    Scenario: Status uses the repository root from a nested working directory
      Given the current project has one exact proven Safeword installation at project
      And the command runs from a nested project directory
      When safeword claude status runs
      Then status reports project as the applicable Safeword scope
      And project and profile state remain byte-identical

    @rejection
    Scenario Outline: Status reports overlapping applicable installations without changing either
      Given the current project has applicable project and user installations with <overlap-state>
      When safeword claude status runs
      Then status reports scope-overlap and the identity and health of both installations
      And it names explicit project-scope and user-scope resolution actions
      And human status explains both overlapping installations and both resolution choices
      And project and profile state remain byte-identical

      Examples:
        | overlap-state              |
        | different official versions |
        | one disabled installation  |

  @choose-claude-plugin-scope.NTB1.R2 @surface.claude-code @surface.safeword-cli
  Rule: choose-claude-plugin-scope.NTB1.R2 — Legacy cleanup proceeds only from one unambiguous applicable and proven installation

    Scenario Outline: One proven applicable scope can authorize legacy cleanup
      Given the current project has one exact proven Safeword installation at <applicable-scope>
      And the project has wholly recognized removable legacy protection
      When safeword claude cleanup is confirmed
      Then only the recognized legacy protection is removed
      And the <applicable-scope> installation and unrelated state remain byte-identical

      Examples:
        | applicable-scope |
        | project          |
        | user             |

    @rejection
    Scenario Outline: Proof that does not establish current-project execution cannot authorize cleanup
      Given the current project has one exact applicable Safeword installation at <applicable-scope>
      And that installation has <proof-state>
      And the current project has wholly recognized removable legacy protection
      When safeword claude cleanup is confirmed
      Then cleanup reports unproven without removing legacy protection
      And project and profile state remain byte-identical

      Examples:
        | applicable-scope | proof-state                        |
        | user             | proof recorded in another project |
        | project          | no plugin execution proof          |
        | user             | stale plugin execution proof       |
        | project          | self-consistently altered installed hook manifest |

    @rejection
    Scenario: Overlapping scopes cannot authorize legacy cleanup
      Given the current project has incompatible project and user installations
      And exact plugin execution proof exists
      When safeword claude cleanup is confirmed
      Then cleanup reports scope-overlap without removing legacy protection
      And it names explicit project-scope and user-scope resolution actions
      And project and profile state remain byte-identical
