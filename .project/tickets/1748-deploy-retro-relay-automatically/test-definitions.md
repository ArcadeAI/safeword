# Test Definitions: Deploy the retro relay automatically

## Rule: The workflow is narrowly triggered and safe to operate

### Scenario: Relevant relay changes deploy through the configured service

Given the deployment workflow is parsed as text
When its triggers, permissions, concurrency, and deploy command are inspected
Then it accepts relevant `main` pushes and manual dispatch
And it excludes unrelated paths
And it uses only read GitHub permissions and serialized deployment
And it requires the Railway project token plus project, environment, and
service configuration before `railway up --ci` executes

- [x] RED — the structural test failed because the workflow did not exist.
- [x] GREEN — the workflow now satisfies the trigger, safety, and Railway CLI
  contract.
- [x] REFACTOR — the target IDs remain repository variables and the README
  gives a minimal administrator setup path.
