# Final real-linter checks

After the version compatibility correction, both golangci-lint v2.0.0 and
v2.13.2 passed nine policy checks and three source-hook checks: 24/24 observations.
The v2.0 lane used Go 1.24.13. Each fixture used its own temporary directory;
GOPROXY was off and GOTOOLCHAIN was local. No customer project was modified.

Policy checks covered malformed config, an unwritable config base, working-dir
formatter exclusions with a negative control, retained fixable misspellings,
genuine sibling typecheck errors, config-path depguard selectors compared with
native output, YAML merge exclusions with a negative control, legacy YAML
boolean loading compared with native output, and home/no-config fallback.

Source-hook checks covered sibling declarations in a package test, nested
internal imports, and go.work dependencies alongside an unrelated broken
package. They invoked the actual post-tool-lint.ts entry point and pinned
source CLI resolver. Sibling bytes stayed unchanged and temporary config files
were removed.

The executable probes are retained as text in manual-policy-proof.txt and
manual-hook-proof.txt. Run from the repository root using scripts/dev python3
after copying the desired probe to a .py file. Set SAFEWORD_GO_LINT_BIN to the
absolute linter binary and, when selecting another Go version, set
SAFEWORD_GO_TEST_GO to its absolute binary. These probes do not start Vitest.
Their outputs are policy-current.log, policy-v20.log, hook-current.log and
hook-v20.log.

A separate ruleguard probe successfully located the normalized relative rule
file, but rule execution could not import github.com/quasilyte/go-ruleguard/dsl
from the available offline fixture. That attempted probe failed and is not
counted among the 24 passing checks. Successful ruleguard execution remains an
evidence limitation, not a passing result.

Earlier development evidence: 88 focused automated tests passed before the
version compatibility correction; 28 automated compatibility tests passed on
v2.0.0. These are historical runs, not a claim that the final entire Vitest suite
executed. Final automated attempts were blocked by another worktree's live
test holding the shared package-test lock.
