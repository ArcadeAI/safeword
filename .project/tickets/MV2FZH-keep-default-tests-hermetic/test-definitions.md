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

### Scenario: A skipped-install fixture resolves generated-config imports

- [x] RED: `setup-or-throw.test.ts` could not import `safeword` from a skipped-install fixture because the whole `node_modules` symlink omitted the package self-link.
- [x] GREEN: the fixture exposes its dependency entries, local `safeword` package, and executables independently.
- [x] REFACTOR skip: the setup helper remains the sole linking seam.

---

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: all scenarios share the existing setup helper; no duplicate test fixture emerged.
