# Test Definitions: Keep default tests hermetic

## Rule: Default setup fixtures do not install dependencies

### Scenario: A default setup fixture skips package installation

- [x] RED skip: the focused unit test was introduced with the initial helper change and observed failing before the default environment existed.
- [x] GREEN 581b76152
- [x] REFACTOR skip: the environment merge is the single setup seam.

### Scenario: An explicit setup environment can opt into installation

- [x] RED skip: the focused unit test was introduced with the initial helper change and observed failing before precedence was implemented.
- [x] GREEN 581b76152
- [x] REFACTOR skip: one environment merge keeps the opt-in path local.

### Scenario: A skipped-install fixture can run generated package scripts

- [x] RED skip: the BDD golden path failed because Cucumber was absent from the fixture.
- [x] GREEN 4d6792e6a
- [x] REFACTOR skip: dependency linking stays localized to the setup test helper.

### Scenario: A skipped-install fixture does not share mutable dependencies

- [x] RED skip: the initial whole-`node_modules` link omitted Safeword itself; the attempted entry-by-entry link then exposed mutable source dependencies to fixture upgrades.
- [ ] GREEN: a real skipped-install setup fixture has no `node_modules`; suites that execute generated tooling explicitly opt into installation.
- [ ] REFACTOR: remove shared dependency linking from the setup helper.

---

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: all scenarios share the existing setup helper; no duplicate test fixture emerged.
