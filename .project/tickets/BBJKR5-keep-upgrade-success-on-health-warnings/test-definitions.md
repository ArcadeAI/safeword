# Test Definitions — keep-upgrade-success-on-health-warnings

## Rule: Upgrade apply success is not converted into failure by post-upgrade diagnostics

### Scenario: keep-upgrade-success-on-health-warnings.DEV1.R1.upgrade_reports_existing_health_issues_without_failing

Given a configured safeword project contains malformed `.project/personas.md` content that `check` reports as a health issue
When `safeword upgrade` runs successfully
Then the process exits with code 0
And the combined output includes the `personas.md` diagnostic
And the combined output does not include `Configuration is healthy`

## Rule: Standalone health checks remain strict diagnostics

### Scenario: keep-upgrade-success-on-health-warnings.DEV1.R2.check_keeps_nonzero_exit_for_existing_health_issue

Given a configured safeword project contains the same malformed `.project/personas.md` content
When `safeword check --offline` runs
Then the process exits non-zero
And the combined output includes the `personas.md` diagnostic
