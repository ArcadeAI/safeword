# Test Definitions: Configure review routes by scope

Feature source: `packages/cli/features/configure-review-routes-by-scope.feature`

The RED feature/scenario ledger was established before implementation. GREEN was delivered as one consolidated slice after the independently approved plan; scenario-specific executable proof names are recorded in `configure-review-routes-by-scope.bdd-proof.json`. REFACTOR is intentionally skipped per scenario because the shared parser, persistence, and policy boundaries were assessed once across the feature.

| Scenario | RED | GREEN | REFACTOR |
| --- | --- | --- | --- |
| A user preference supplies the effective route list | done | done | skip: shared boundary review |
| A project preference for another author does not mask the user list | done | done | skip: shared boundary review |
| An empty project routes object preserves the user list | done | done | skip: shared boundary review |
| A project list wins without merging | done | done | skip: shared boundary review |
| A project-only list is authoritative | done | done | skip: shared boundary review |
| Set replaces one author only at the selected scope | done | done | skip: shared boundary review |
| Reset removes one author only at the selected scope | done | done | skip: shared boundary review |
| Resetting an absent project entry is a no-op | done | done | skip: shared boundary review |
| Effective list reports source order and runtime defaults | done | done | skip: shared boundary review |
| Effective list reports a project override | done | done | skip: shared boundary review |
| Malformed scoped configuration fails visibly | done | done | skip: shared boundary review |
| Malformed scoped configuration is never overwritten | done | done | skip: shared boundary review |
| Malformed scoped configuration is not reset | done | done | skip: shared boundary review |
| A malformed non-target scope does not block mutation | done | done | skip: shared boundary review |
| A malformed non-target scope does not block reset | done | done | skip: shared boundary review |
| An empty configured route list fails visibly | done | done | skip: shared boundary review |
| Absent scoped preferences preserve built-in behavior | done | done | skip: shared boundary review |
| Reset restores built-in defaults | done | done | skip: shared boundary review |
| Reset restores the next scope | done | done | skip: shared boundary review |
| First user-scope set creates one profile outside the project | done | done | skip: shared boundary review |
| First project-scope set creates the project config | done | done | skip: shared boundary review |

## Feature-level cross-scenario refactor

- skip: the final refactor pass found no source cleanup worth the churn; scenario-specific test declarations remain separate to preserve proof attribution.
