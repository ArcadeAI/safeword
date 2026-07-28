# User Stories: Keep override regressions fast

## Story: Verify customer overrides without repeated installation work

As a Safeword maintainer,
I want override-survival tests to reuse the repository's installed toolchain,
so that the default suite stays responsive while preserving real hook coverage.

### Acceptance Criteria

#### 5KHSQB.SM1.AC1 - Every historical override example remains executable

Given the TypeScript and Python override matrices from tickets 137–139
When `override-survival.test.ts` runs
Then all ten examples still run the generated post-tool lint hook and assert
customer configuration survives `safeword upgrade`.

#### 5KHSQB.SM1.AC2 - Fixture upgrades do not install unrelated tooling

Given the repository toolchain is already installed
When an override fixture runs `safeword upgrade`
Then package and skill installation are skipped while reconciliation still runs.

#### 5KHSQB.SM1.AC3 - Missing tool execution cannot masquerade as a passing override

Given a generated lint hook cannot launch its configured tool
When an override example inspects the hook result
Then the example fails explicitly instead of satisfying a negative lint assertion.
