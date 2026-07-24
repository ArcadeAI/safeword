# Test definitions: Verify preflight safe cleanup

User story source: `user-stories.md`

## Rule: The environment-limit preflight remains runnable under restrictive command policy

### Scenario: Every shipped verify skill uses a safe disposable Git-probe cleanup

Given the template and dogfood verify skills contain the temporary Git-repository preflight
When their cleanup contract is checked
Then each surface contains `find "$GIT_PROBE_DIR" -depth -delete`
And none contains `rm -rf "$GIT_PROBE_DIR"`
And the generated Codex plugin remains in catalogue parity with the canonical template

- [x] RED (uncommitted: four shipped surfaces failed the cleanup contract)
- [x] GREEN (62/62 verify-skill tests and 8/8 Codex catalogue release tests)
- [x] REFACTOR skip: one narrow cleanup contract with no shared fixture or duplication to extract
