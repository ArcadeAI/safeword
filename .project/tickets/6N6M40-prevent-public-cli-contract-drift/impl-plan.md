# Impl Plan: Prevent public CLI contracts from drifting again

**Status:** planned

## Approach

The riskiest assumption is that the existing declarative catalog can assemble the entire production Commander tree—including today’s hand-registered internal commands—without changing runtime behavior. The cheapest proof is a characterization test that calls `createCliProgram()` through real registration collaborators, asserts the current command/help inventory, and proves assembly has no runtime effects. Exact reconciliation starts only after slice 2 defines invocation-kind realization.

Build six vertical slices, keeping each slice green before starting the next:

1. **Factory/runtime boundary (R2, Safeword CLI).** Add `cli-protocol/program.ts` with `createCliProgram()` and `runCli(argv)`. Move root configuration, internal command registration, crash capture, argv compatibility normalization, parse-error rendering, and exit mapping out of `cli.ts`; leave `cli.ts` as the shebang plus `await runCli(process.argv)`. Replace the `retro` environment sentinel with invocation context local to `runCli`. Primary proof: a current-behavior characterization through real catalog/register/Commander collaborators with only process output/exit/handler boundaries observed. Supporting proof: direct/chained rewrite tables preserving options and `--` values.
2. **Exhaustive catalog and reconciliation (R1/R2).** Replace `public: boolean` with explicit `classification`, `visibility`, and invocation kind: `command`, `commander-alias`, `argv-rewrite`, or `default`. Kind-specific realization requires command nodes only for commands, alias spellings on their target command, rewrite resolution to a registered target, and the bare default action on the root. Model internal syntax/options exactly and retain public-only policy through a discriminated union. Add a pure runtime walker/comparer using Commander’s public API, with one narrow Commander-15 compatibility adapter for option conflict/implication metadata because Commander exposes setters but no getters for those two relations. Pin that adapter with behavior tests. Commander exceptions are the exact options returned by each command’s own help-option API plus the explicitly configured root version option; a literal baseline asserts today’s standard flags. Primary proof: real-factory integration plus kind-specific negative tables.
3. **Alias ownership (R3).** Apply the central global-option set uniformly, then build each alias from only its own local catalog options—never by inheriting the canonical command’s local options. Retain explicit redundant-option metadata and all alias spellings. Primary proof: built-CLI subprocess tests for accepted globals/supported locals and exact JSON failures for excluded canonical locals, with a handler-entry sentinel proving rejection happens in Commander.
4. **Focused local gate (R4).** Add `packages/cli/scripts/check-cli-contract.ts` and root/package `check:cli-contract` scripts. It builds once, then aggregates runtime reconciliation, public help/capabilities checks, bounded catalog fixtures, generated Claude/reference freshness, and scoped terminology findings in stable order without retry. Catalog fixtures prove exhaustive coverage; a small reviewed `tests/fixtures/cli-contract-baseline.json` independently pins the high-risk #2251/#2278 public and rewrite contracts (argv, exit, stdout/stderr shape, schema) so coordinated catalog/registration edits cannot rewrite their own oracle. Batches use fixed concurrency and per-fixture timeout.
5. **Generated/docs surfaces (R4).** Generate a stable website CLI-reference partial from the catalog (normalized LF, repository-relative paths, no timestamps), include it from the canonical CLI reference, and add literal compatibility-region delimiters around historical terminology. The terminology scanner reads an explicit source list covering README, plugin README, website CLI/configuration docs, and user-facing CLI recovery text. Primary proof: generator check mode plus website build; supporting mutation tests cover each stale surface and malformed delimiter state.
6. **Structural and CI enforcement (R1/R5, GitHub Actions Execution Sandbox).** Add an import-boundary test and dependency rule: `cli.ts` may import only process and `runCli`, may not import Commander/register/catalog, and no production entry point may call `.command()` after the factory returns. First run `check:cli-contract` inside `Dogfood parity`, then add the unconditional five-minute job named exactly `CLI contract`. After it succeeds, use the trusted GitHub API boundary to add the exact check, remove ordinary PR bypasses, verify live policy, remove the duplicate Dogfood step, enable strict-current-main, and rerun both checks. Primary proof: source-boundary/workflow tests plus observed GitHub check/ruleset responses.

Proof scope follows the highest practical layer: built subprocess tests for user-visible CLI behavior, real-program integration tests for registration/reconciliation, and unit tests only for normalization/error partitions. Existing `packages/cli/tests/cli-protocol/*` style and helpers remain the convention. The saved feature is implemented by these named Vitest/E2E surfaces and excluded from the duplicate Cucumber lane with an explicit proof pointer.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Program boundary | One `createCliProgram()` factory plus one `runCli(argv)` runtime boundary | Keep assembly in `cli.ts`; build a test-only Commander reconstruction | Keeping assembly at import time preserves side effects; a reconstruction can agree with the catalog while production wiring drifts. Commander 15 explicitly supports separately creating a command, inspecting commands/options/arguments, overriding exits/output, and passing explicit user argv to `parseAsync`. [Commander 15 documentation](https://github.com/tj/commander.js/) |
| Contract authority | Catalog owns intent; the assembled tree owns realized registration; invocation kinds define kind-specific realization; a small literal baseline pins repaired behavior | Require every catalog entry to be a Commander node; derive capabilities from Commander; second executable registry | Rewrites/defaults are invocable without nodes, Commander lacks Safeword policy, and an executable duplicate registry recreates drift. The literal baseline is test evidence, not production ownership. [Issue #2283](https://github.com/ArcadeAI/safeword/issues/2283) |
| Runtime inspection | Use Commander 15 public `commands`, `options`, `registeredArguments`, aliases, and visibility/help APIs; use a narrow exact-version adapter for the otherwise write-only conflict/implication relations, pinned by mutation tests | Parse help text; broadly inspect private fields; omit option relations | Help text is presentation-dependent; broad private inspection is version-fragile; omitting relations leaves real option semantics unprotected. Commander 15 exposes all other required collections publicly, so the compatibility surface stays limited to two behavior-pinned fields. [Commander 15 documentation](https://github.com/tj/commander.js/) |
| Gate execution | One focused TypeScript orchestrator with stable aggregated findings and built-CLI subprocess batches | Add all checks to the full suite; shell pipeline; automatic retry | The full suite exceeds the focused budget, shell pipelines obscure structured failures, and retry hides nondeterminism. One entry point gives CI and local developers the same answer. |
| Documentation | Generate one included CLI-reference partial while retaining authored explanatory prose | Generate the entire CLI page; keep all tables manual | Full-page generation would erase authored guidance; manual command/compatibility tables can drift. A partial is the smallest generated authority. |
| Ruleset rollout | Observe the exact dedicated context before API mutation, keep Dogfood duplication until verified, then require strict current main | Require the context in the same commit that creates it; continuous audit bot | GitHub requires a real emitted context before safe selection, and strict required checks only take effect with a required check. A continuous bot needs separate credential/alerting design and is explicitly out of scope. [GitHub ruleset REST API](https://docs.github.com/en/rest/repos/rules?apiVersion=2026-03-10) |

Figure-it-out conclusion: recommend the factory + kind-aware catalog/runtime reconciliation design because it makes the production object—not a test reconstruction—the proof boundary without pretending rewrites are command nodes. A separate registry was close on mutation isolation but loses on duplicate ownership. Commander 15’s public APIs support the smaller design; GitHub’s ruleset API supports the staged rollout. **Premortem:** six months from now this fails if a new entry point registers after the factory; the explicit import/source boundary and built-entrypoint test catch that path now. **Next:** implement the factory characterization and make the wrapper boundary fail first.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| 1. Structure enforces; instructions suggest | Runtime/catalog drift, generated freshness, and terminology are executable merge gates rather than review guidance. | [Runtime reconciliation tests](packages/cli/tests/cli-protocol/cli-contract.test.ts) | |
| 2. Fire at boundaries, not every turn | The contract runs once locally or at the pull-request boundary, not in normal CLI execution. | [Focused contract gate](packages/cli/scripts/check-cli-contract.ts) | |
| 3. Add, never replace | Retained aliases remain; generated reference replaces only duplicated tables, not authored guidance. | [Retained-alias subprocess coverage](packages/cli/tests/cli-protocol/help-aliases.test.ts) | |
| 5. Clarity before correctness | `cli.ts` becomes a tiny wrapper; factory, normalization, reconciliation, and gate orchestration have separate named modules. | [Program-boundary tests](packages/cli/tests/cli-protocol/cli-program.test.ts) | |

Architecture decisions honored:

- **Typed CLI Execution and Discovery:** the declarative catalog continues to own policy, fixtures, and compatibility while the executable adapter owns rendering and exit behavior.
- **Generated State and Human Decisions:** only structural command/reference data is generated; explanatory documentation remains human-owned.
- **Host-owned cross-agent adversarial review coordinator:** degraded review remains labeled and unstamped because Claude authentication was unavailable.

No new ADR: this is a reversible strengthening of the existing typed-CLI decision, not a new technology, ownership boundary, or hard-to-reverse data model.

## Known deviations

- The scenario and plan reviews could not obtain cross-agent independence because the installed Claude CLI is not authenticated. Per the user’s explicit instruction, bounded same-agent subprocess reviews were applied and recorded without an independent stamp.
- The saved feature uses Vitest and built-subprocess proof rather than duplicating the scenarios in the repository’s starter Cucumber lane; the feature will carry an explicit proof pointer and `@wip` exclusion as required by the existing CI convention.

## Doc impact

- `README.md`: compatibility-region delimiters and canonical lifecycle wording only where operative text is scanned.
- `plugin/README.md`: same terminology contract for shipped plugin guidance.
- `packages/website/src/content/docs/reference/cli.mdx`: include the generated command/compatibility partial and retain authored explanations.
- `packages/website/src/content/docs/reference/configuration.mdx`: canonical lifecycle terminology scan/fixes if needed.
- `ARCHITECTURE.md`: extend the existing Typed CLI Execution and Discovery implementation record with the factory/reconciliation gate and exact CI context.

## Assessment triggers

- Commander removes or materially changes the public command/option/argument inspection API.
- The catalog-wide subprocess batch approaches two minutes or needs platform-specific fixtures.
- A second machine schema version requires version-aware fixture normalization.
- GitHub merge queues are enabled, requiring an equivalent `merge_group` trigger.
- The repository wants continuous live ruleset auditing, which requires a separate credential and alert-routing decision.
