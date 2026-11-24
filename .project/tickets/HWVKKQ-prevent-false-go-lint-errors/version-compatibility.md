# Placeholder compatibility correction

An additional real-linter experiment found that golangci-lint v2.0.0 does not
expand config-path in depguard selectors. The native rule produced zero issues;
the original adapter incorrectly expanded the selector and enabled the rule.
This was a concrete configuration regression despite the first review approval.

The executor now resolves the installed linter version before preparing its
configuration. Base-path interpolation is preserved across v2. Config-path
interpolation is applied only for v2.1 and later. A failed or unrecognizable
version lookup produces a warning rather than guessing policy. The regression
fixture compares actual native output with the real source hook on each matrix
version, and independently requires the forbidden import on modern versions.

Primary sources fetched 2026-10-21:

- https://github.com/golangci/golangci-lint/blob/v2.0.0/pkg/golinters/depguard/depguard.go
- https://github.com/golangci/golangci-lint/blob/v2.0.0/pkg/golinters/gocritic/gocritic.go
- https://github.com/golangci/golangci-lint/blob/v2.0.0/pkg/golinters/goheader/goheader.go
- https://github.com/golangci/golangci-lint/blob/v2.1.0/pkg/config/placeholders.go

The historical approved design remains unchanged as a record of the proposal.
This correction narrows its interpolation rule to match the installed tool.
