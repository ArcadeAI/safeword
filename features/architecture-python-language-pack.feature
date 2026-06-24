@architecture-python-language-pack
Feature: Python language pack — pyproject discovery, package extraction, dependency fingerprint

  The generated architecture doc must introspect Python projects the same way it does
  TypeScript, Go, and Rust ones: a src-layout or flat-layout package and a uv workspace
  each get a real structural doc built from the project's top-level modules (packages and
  .py files, excluding tooling/dunder files), dependency changes register as drift, and a
  polyglot repo introspects Python and JS together without disturbing the JS output.
  Incomplete is fine (a package with no recognized modules stays honestly "not
  introspected"); silently wrong or JS-regressing is not.

  Rule: Python projects get real structural extraction and drift detection

    @architecture-python-language-pack.TB1.AC1
    Scenario: A src-layout Python project lists its top-level src modules
      Given a src-layout Python project with a package "api" and a module "db"
      When safeword generates the architecture doc
      Then the generated doc is a single-repo module doc, not a package root index
      And the doc lists the module "api"
      And the doc lists the module "db"

    @architecture-python-language-pack.TB1.AC2
    Scenario: A flat-layout Python project lists root packages and modules, not tooling files
      Given a flat-layout Python project with a package "core", a module "utils", and a conftest.py
      When safeword generates the architecture doc
      Then the doc lists the module "core"
      And the doc lists the module "utils"
      And the doc does not list the module "conftest"

    @architecture-python-language-pack.TB1.AC3
    Scenario: A uv workspace produces a root index and per-package leaf docs
      Given a uv workspace listing a Python package "svc" with a module
      When safeword generates the architecture doc
      Then a root index lists the package "svc"
      And the package "svc" has its own colocated leaf doc

    @architecture-python-language-pack.TB1.AC1
    Scenario: A package with no recognized modules is marked, not introspected
      Given a uv workspace with a Python package "bare" that has no modules
      When safeword generates the architecture doc
      Then the package "bare" is marked "not introspected" in the root index
      And the package "bare" line does not show the "awaiting prose" placeholder
      And the package "bare" has no colocated leaf doc

    @architecture-python-language-pack.TB2.AC1
    Scenario: Adding a Python dependency makes the architecture doc go stale
      Given a src-layout Python project with a module whose architecture doc has been generated
      When a dependency is added to its pyproject.toml
      And safeword checks the architecture doc
      Then safeword reports the architecture doc is stale

  Rule: Polyglot repos introspect every language without regressing JS

    @architecture-python-language-pack.TB2.AC2
    Scenario: A mixed JS and Python monorepo introspects both packages
      Given a monorepo whose workspaces include a JS package "web" with a src tree and a Python package "svc" with a module
      When safeword generates the architecture doc
      Then the package "web" has its own colocated leaf doc
      And the package "svc" has its own colocated leaf doc

    @architecture-python-language-pack.TB2.AC3
    Scenario: A pure JS single-repo is unchanged by the Python extractor
      Given a single-repo project with a src tree and no workspace config
      When safeword generates the architecture doc
      Then the generated doc is a single-repo module doc, not a package root index
      And the doc lists the module "core"
