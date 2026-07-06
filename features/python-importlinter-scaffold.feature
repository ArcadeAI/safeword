Feature: Python pack scaffolds a generic import-linter config
  A freshly set-up Python project gets safeword's circular-import (architecture)
  check running under /audit with zero manual configuration — parity with the
  safeword-generated depcruise config that JS/TS projects already get.

  @python-importlinter-scaffold.TB1.R1
  Rule: python-importlinter-scaffold.TB1.R1 — a freshly set-up Python project gets a working cycle check with zero manual configuration

    Scenario: setup scaffolds .importlinter for a flat single-package project
      Given a Python project with exactly one importable package at the repo root
      And no import-linter configuration in any form
      When safeword setup runs
      Then a .importlinter file exists naming that package as root_packages
      And it declares exactly one acyclic-siblings contract
      And lint-imports exits 0 in the project

    Scenario: setup detects the package in a src layout
      Given a Python project whose only importable package lives under src/
      And no import-linter configuration in any form
      When safeword setup runs
      Then the .importlinter root_packages names the package under src/
      And lint-imports exits 0 in the project

    @rejection
    Scenario: the scaffolded check fails when a circular import is introduced
      Given a Python project set up with the scaffolded .importlinter
      And two sibling modules that import each other
      When lint-imports runs
      Then it exits non-zero naming the broken contract

  @python-importlinter-scaffold.TB1.R2
  Rule: python-importlinter-scaffold.TB1.R2 — an existing import-linter configuration is never modified, duplicated, or overridden

    @rejection
    Scenario Outline: setup and upgrade leave a project with existing import-linter config untouched
      Given a Python project with exactly one importable package at the repo root
      And an existing import-linter configuration as <config form>
      When safeword <command> runs
      Then no .importlinter file is scaffolded beyond what already existed
      And the existing configuration content is unchanged

      Examples:
        | config form                        | command |
        | a .importlinter file               | setup   |
        | setup.cfg with [importlinter]      | setup   |
        | pyproject.toml [tool.importlinter] | setup   |
        | a .importlinter file               | upgrade |
        | pyproject.toml [tool.importlinter] | upgrade |

  @python-importlinter-scaffold.TB1.R3
  Rule: python-importlinter-scaffold.TB1.R3 — when the top-level package cannot be determined unambiguously, safeword scaffolds nothing

    @rejection
    Scenario: a scripts-only Python project gets no scaffold
      Given a Python project with a manifest but no importable package
      When safeword setup runs
      Then no .importlinter file is created

    @rejection
    Scenario Outline: a project with multiple top-level packages gets no scaffold
      Given a Python project with <package layout>
      When safeword <command> runs
      Then no .importlinter file is created

      Examples:
        | package layout                                             | command |
        | two importable packages at the repo root                   | setup   |
        | one importable package at the repo root and one under src/ | setup   |
        | two importable packages at the repo root                   | upgrade |

  @python-importlinter-scaffold.TB1.R4
  Rule: python-importlinter-scaffold.TB1.R4 — the scaffold is create-once, then the user's: created when absent, never overwritten, reset removes only the unmodified

    Scenario: upgrade scaffolds .importlinter for a previously-set-up project that lacks one
      Given a Python project safeword previously set up before this feature existed
      And it has exactly one importable package at the repo root
      And no import-linter configuration in any form
      When safeword upgrade runs
      Then a .importlinter file exists naming that package as root_packages
      And it declares exactly one acyclic-siblings contract

    Scenario: upgrade is idempotent over an unmodified scaffold
      Given a Python project that safeword previously set up with a scaffolded .importlinter
      And the file is unchanged since scaffolding
      When safeword upgrade runs
      Then the .importlinter content is unchanged
      And no duplicate configuration is introduced

    @rejection
    Scenario: upgrade preserves a user-extended scaffold
      Given a Python project whose scaffolded .importlinter was extended by the user with an additional contract
      When safeword upgrade runs
      Then the user's extended .importlinter content is unchanged

    Scenario: reset removes an unmodified safeword-scaffolded config
      Given a Python project that safeword previously set up with a scaffolded .importlinter
      And the file is unchanged since scaffolding
      When safeword reset runs
      Then the .importlinter file is removed

    @rejection
    Scenario: reset preserves a user-extended scaffold
      Given a Python project whose scaffolded .importlinter was extended by the user with an additional contract
      When safeword reset runs
      Then the user's extended .importlinter content is unchanged

    @rejection
    Scenario: reset preserves a user-authored import-linter config
      Given a Python project whose .importlinter existed before safeword setup
      When safeword reset runs
      Then the user's .importlinter file still exists with its original content

  @python-importlinter-scaffold.TB1.R5
  Rule: python-importlinter-scaffold.TB1.R5 — import-linter is installed with the pack's other Python tools; a failed installation surfaces the install command

    Scenario: setup installs import-linter alongside the pack's other Python tools
      Given a uv-managed single-package Python project where import-linter is not installed
      When safeword setup runs
      Then import-linter is declared as a development dependency

    @rejection
    Scenario: a failed installation surfaces the package-manager-appropriate install command
      Given a Python project where installing import-linter fails
      When safeword setup runs
      Then the setup output tells the user how to install import-linter
