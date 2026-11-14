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

## First independent result and follow-up

Review bae13ae6-5c79-46c9-94ba-c938d523f766 returned APPROVE from Claude/Opus,
with cross-agent independence and no errors. The machine receipt is preserved
in refactor-quality-review.json.

Applied suggestions: four automated real-linter comparisons for YAML
yes/no/on/off, and an explicit external-process trace assertion that formatting
precedes exactly one package lint. Eight direct native/helper scalar comparisons
passed across the two pinned versions; both reject these scalars and the helper
reports the configuration failure. A real-hook trace probe also passed the
ordering and exactly-once contract while retaining formatter warnings and findings.
The updated automated suites still require execution; this is not a claim that
the direct probes executed those suites.

Retained nonblocking limits: a cfg/gomod/gitroot base may lie outside the
Safeword project; temporary files there remain exclusive and mode 0600. SIGKILL
can leave residue, and there is a narrow window after writing the config before
signal-handler registration. The version probe and path computation actually
precede materialization, correcting that detail in the review's description.
Changing resource placement or lifecycle ownership would change behavior and
is outside this refactor. No broad orphan deletion was added.

The TOML large-integer precision observation remains a nonblocking parser-range
limit; no arbitrary-scalar fidelity claim is made. Deployment job dependencies
and branch-protection policy are outside this delivery. Optional parser/linter
upgrades remain currency notes. Re-review the changed tests with the same source
targets before final verification.

## Follow-up independent result

Review eaf6ff61-5c21-4e6c-b5e6-0cf3db7c878e returned APPROVE from Claude/Opus,
with cross-agent independence and no errors. Receipt: refactor-quality-followup.json.
Both pinned linter versions now pass all 49 focused automated tests locally.
ESLint, TypeScript and the post-refactor diff audit pass; all five generated
surfaces were regenerated and verified. Remote CI is the remaining final gate.

Follow-up suggestions answered:

- The v2.0 gocritic placeholder concern is refuted by freshly fetched upstream
  source: its ContextSetter creates a replacer for internal.PlaceholderBasePath,
  and string settings use that replacer. The earlier source summary focused on
  depguard and was incomplete; the implementation already matches gocritic.
  Source: https://github.com/golangci/golangci-lint/blob/v2.0.0/pkg/golinters/gocritic/gocritic.go
- Plain warning-only stdout remains uncapped in the shared Claude/Cursor hook;
  structured additionalContext is capped, as is Codex's warning conversion.
  Uniformly changing the existing stdout contract is outside this pure refactor.
  This is a nonblocking output-size limitation, not proof of a false clean result.
- Multiple customer report formats aimed at stdout can mix machine-readable
  output with text diagnostics. Findings remain visible; no claim is made that
  such an unusual stream is presentation-clean. Extra normalization is deferred.
- Temporary files may appear outside the project under the chosen original
  cfg/gomod/gitroot base, including home fallback. Existing cleanup limits above
  remain; relocating files would break the preserved path-base contract.
- Formatter order and exactly-once lint are now explicitly proven at the real
  hook's executable boundary. No further duplicate test is needed.
- The two version probes are harmless existing process overhead. Combining them
  would change the helper protocol and add coupling; no such abstraction was added.

**Verdict:** APPROVE. Critical issues: none. Currency notes and nonblocking
limitations are retained above. **Next:** finish the full remote CI workflow,
record its current-source evidence, then commit the review and verification notes.

## Review scorecard

**Currency:** NOTE — pinned APIs verified; optional patch/minor upgrades named above.
**Sources:** PASS — primary source links above were fetched this session;
the v2.0 gocritic correction was independently fetched after the follow-up.
**Correct:** PASS — both independent passes found no concrete release-blocking defect;
49 focused cases pass with each supported linter. Full CI remains the final gate.
**Elegant:** PASS — configuration, execution and host ownership remain local and explicit.
**No-bloat:** PASS — four bounded refactors; larger abstractions declined with reasons.
**Wiring:** PASS — lifecycle.test.ts uses the real source hook and CLI with a fake
executable only; lint-go-context.test.ts exercises the real Go/linter boundary;
codex-hook.test.ts and invisible-extension.test.ts protect packaged host entry points.
No live editor session is claimed.
**Verdict:** APPROVE. **Critical issues:** None.
**Suggested improvements:** Applied and retained suggestions are enumerated above.
**Provenance:** Verified primary sources above; findings tied to local source and
observed process/test results. Neither reviewer approval nor direct probes substitute
for the still-running complete remote workflow.
**Next:** Preserve the complete CI result for beac76fc375634b41b1ca0e9a6cf0acb8d345435.

## Final objective verification

Full CI run 39695922147 completed SUCCESS at the reviewed source/test revision
beac76fc375634b41b1ca0e9a6cf0acb8d345435. Both Node lanes passed 11,645 CLI
tests and 83 release tests; 601 acceptance scenarios, 51 proof-tag tests,
49 tests per Go version and 12 shuffled installed-hook tests passed. Every
static, parity, generated, contract, conformance and configured dependency-policy
gate passed. This supersedes the pending-CI statements in the review history
above. Machine result: remote-result.json. Later changes are evidence only.

**Verdict:** APPROVE. **Critical issues:** None. **Next:** Commit and push
the final evidence; retain the documented optional limits without widening scope.
