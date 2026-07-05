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
      And the cycle check passes against the project's acyclic code

    Scenario: setup detects the package in a src layout
      Given a Python project whose only importable package lives under src/
      And no import-linter configuration in any form
      When safeword setup runs
      Then the .importlinter root_packages names the package under src/
      And the cycle check passes against the project's acyclic code

    @rejection
    Scenario: the scaffolded check fails when a circular import is introduced
      Given a Python project set up with the scaffolded .importlinter
      And two sibling modules that import each other
      When the cycle check runs
      Then it exits non-zero naming the broken contract

  @python-importlinter-scaffold.TB1.R2
  Rule: python-importlinter-scaffold.TB1.R2 — an existing import-linter configuration is never modified, duplicated, or overridden

    @rejection
    Scenario Outline: setup leaves a project with existing import-linter config untouched
      Given a Python project with exactly one importable package at the repo root
      And an existing import-linter configuration as <config form>
      When safeword setup runs
      Then no .importlinter file is scaffolded beyond what already existed
      And the existing configuration content is unchanged

      Examples:
        | config form                        |
        | a .importlinter file               |
        | setup.cfg with [importlinter]      |
        | pyproject.toml [tool.importlinter] |

  @python-importlinter-scaffold.TB1.R3
  Rule: python-importlinter-scaffold.TB1.R3 — when the top-level package cannot be determined unambiguously, safeword scaffolds nothing

    @rejection
    Scenario: a scripts-only Python project gets no scaffold
      Given a Python project with a manifest but no importable package
      When safeword setup runs
      Then no .importlinter file is created

    @rejection
    Scenario: a project with multiple top-level packages gets no scaffold
      Given a Python project with two importable packages at the repo root
      When safeword setup runs
      Then no .importlinter file is created

  @python-importlinter-scaffold.TB1.R4
  Rule: python-importlinter-scaffold.TB1.R4 — the scaffolded config is safeword-owned through its whole lifecycle

    Scenario: upgrade is idempotent over an already-scaffolded config
      Given a Python project that safeword previously set up with a scaffolded .importlinter
      When safeword upgrade runs
      Then the .importlinter content is unchanged
      And no duplicate configuration is introduced

    Scenario: reset removes the safeword-scaffolded config
      Given a Python project that safeword previously set up with a scaffolded .importlinter
      When safeword reset runs
      Then the .importlinter file is removed

    @rejection
    Scenario: reset preserves a user-authored import-linter config
      Given a Python project whose .importlinter existed before safeword setup
      When safeword reset runs
      Then the user's .importlinter file still exists with its original content

  @python-importlinter-scaffold.TB1.R5
  Rule: python-importlinter-scaffold.TB1.R5 — safeword never installs the tool; it surfaces the package-manager-appropriate install command

    @rejection
    Scenario Outline: setup surfaces install guidance without installing
      Given a Python project managed by <package manager> where import-linter is not installed
      When safeword setup runs
      Then the setup output includes <install command>
      And import-linter has not been installed by safeword

      Examples:
        | package manager | install command                  |
        | uv              | uv add --dev import-linter       |
        | pip             | pip install import-linter        |

    Scenario: no install guidance when the tool is already present
      Given a Python project where import-linter is already installed
      When safeword setup runs
      Then the setup output contains no import-linter install guidance
