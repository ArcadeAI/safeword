Feature: Configure documentation sources for audit

  Audit needs a project-owned documentation inventory so it can check the
  right docs instead of guessing from conventional local folders.

  Rule: Configured sources are authoritative

    @configure-audit-doc-sources.MA1.R1
    Scenario: Configured local documentation source is read as audit inventory
      Given a project configures local documentation source "README.md"
      When audit reads the documentation source decision
      Then the documentation source decision is configured
      And the configured documentation sources include local source "README.md"

    @configure-audit-doc-sources.MA1.R2
    Scenario: Relative local documentation source resolves from the project root
      Given a project configures local documentation source "docs"
      When audit reads the documentation source decision
      Then the configured local source "docs" resolves inside the project root

    @configure-audit-doc-sources.MA1.R3
    Scenario: Malformed documentation source entries do not block valid siblings
      Given a project configures malformed documentation sources and local source "README.md"
      When audit reads the documentation source decision
      Then the documentation source decision is configured
      And the configured documentation sources include local source "README.md"

  Rule: Missing source decision asks once

    @configure-audit-doc-sources.MA2.R1
    Scenario: Audit prompts when no documentation source decision exists
      Given a project has no configured documentation source decision
      When audit reads the documentation source decision
      Then audit should prompt for documentation sources

    @configure-audit-doc-sources.MA2.R2
    Scenario: Explicit empty documentation sources suppress future prompts
      Given a project explicitly configures no documentation sources
      When audit reads the documentation source decision
      Then audit should not prompt for documentation sources again

    @configure-audit-doc-sources.MA2.R3
    Scenario: Explicit empty documentation sources use fallback discovery
      Given a project explicitly configures no documentation sources
      When audit reads the documentation source decision
      And audit should use fallback documentation discovery
