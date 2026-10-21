# Refactor quality-review plan and source evidence

Review date: 2026-10-21, from the current developer-supplied prompt timestamp.
Scope: the Go package-context delivery on codex/fix-go-lint-context, compared
with merge base 9f6ac6fcee254b684abf7a5bb014538a6aa6470d. Review the changed Go
behavior and its direct host/CLI wiring, not unrelated legacy behavior in the
larger host files. Prior approvals are not proof for this pass.

## Questions for the independent pass

- Correctness and compatibility: does package loading retain siblings, nested
  modules and go.work dependencies without widening to unrelated packages?
  Do the four relative-path modes, selected config, version-specific placeholders
  and report/resource paths retain native meaning?
- Trust and failure handling: are canonical root checks, exclusive private
  temporary files, signal/ordinary cleanup, malformed helper responses and
  bounded feedback preserved? Can any accepted claim falsely report success?
- Refactor equivalence: did precomputing filename precedence, clarifying caller
  directory/capability names or extracting helper transport drop a guard,
  change a default, warning deduplication, error path or argument anchor?
- Elegance and scope: do the local responsibilities remain clearer without a
  generic normalizer, process framework or new shipping abstraction?
- Wiring and proof: require real CLI/hook collaborators, with fakes only at the
  executable boundary. Challenge non-discriminating assertions and distinguish
  new characterization probes from the earlier complete CI baseline.
- Currency and supersession: check the pinned APIs and source claims against
  current primary sources; separate optional upgrades from actual regressions.

## Primary sources fetched this session

- golangci-lint v2.13.2 quick start documents specific files/directories,
  nonrecursive directory patterns and file-targeted formatting:
  https://github.com/golangci/golangci-lint/blob/v2.13.2/docs/content/docs/welcome/quick-start.md
- v2.13.2 configuration search and path-base implementation:
  https://github.com/golangci/golangci-lint/blob/v2.13.2/pkg/config/base_loader.go
  https://github.com/golangci/golangci-lint/blob/v2.13.2/pkg/fsutils/basepath.go
- v2.0 depguard expands base-path; v2.1 adds the shared config-path replacer:
  https://github.com/golangci/golangci-lint/blob/v2.0.0/pkg/golinters/depguard/depguard.go
  https://github.com/golangci/golangci-lint/blob/v2.1.0/pkg/config/placeholders.go
- The v2.13.2 go.mod pins Viper v1.12.0. Its SupportedExts starts with
  JSON, TOML, YAML, YML, confirming the existing precedence contract:
  https://github.com/golangci/golangci-lint/blob/v2.13.2/go.mod
  https://github.com/spf13/viper/blob/v1.12.0/viper.go
- YAML parser document/AST APIs and alias limits, fetched through Context7:
  https://github.com/eemeli/yaml/blob/main/docs/04_documents.md
  https://github.com/eemeli/yaml/blob/main/docs/03_options.md
  The code explicitly retains maxAliasCount 100 and JSON-compatibility checks.
- Node 24 process documentation, retrieved through Context7 after a direct web
  fetch failed, describes spawn errors and close-after-stdio behavior:
  https://nodejs.org/docs/latest-v24.x/api/child_process.html
- Smol TOML documents its parse API, plain-number default, optional BigInt and
  non-plain date objects. Challenge JSON normalization against this contract;
  do not infer arbitrary scalar preservation merely from successful parsing:
  https://github.com/squirrelchat/smol-toml/blob/mistress/README.md

## Currency and security observations

Registry queries reported yaml 2.9.1 and smol-toml 1.9.1. The project declares
yaml ^2.9.1 and smol-toml 1.9.0. GitHub's latest golangci-lint release is v2.15.0,
published 2026-10-16; the compatibility matrix deliberately remains v2.0.0 and
the pinned modern v2.13.2. These version gaps are nonblocking currency notes,
not dependency changes authorized by a behavior-preserving refactor.

Primary registry/release endpoints:

- https://registry.npmjs.org/yaml/latest
- https://registry.npmjs.org/smol-toml/latest
- https://github.com/golangci/golangci-lint/releases/tag/v2.15.0

GitHub's public advisory API returned empty arrays for the exact queried
yaml@2.9.1 and smol-toml@1.9.0 versions. This is a bounded query result, not a
claim of an exhaustive security audit. Existing repository dependency-policy
exceptions and the standalone ruleguard/live-editor evidence limitations remain
in verify.md; do not silently upgrade those limits into passing proof.

## Refactor protection observed so far

The previous complete remote baseline is run 39686478082 at 536dd1fe7.
Before code movement, direct probes passed four config-format precedence cases,
four malformed helper responses, and valid-response warning deduplication.
Eighteen real-linter policy checks passed after the capability rename and helper
extraction, across v2.0.0/Go 1.24 and v2.13.2/Go 1.25. Local Vitest attempts were
lock-limited, so the expanded Vitest suites still require final execution.
Six real source-hook checks also passed after extraction, three per version.
The refactored handwritten sources are stable while generated lifecycle fixture
verification waits on the shared lock. Generated copies are not review targets;
their parity/freshness and final CI are separate objective gates.
