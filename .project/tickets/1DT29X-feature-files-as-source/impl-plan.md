# Impl Plan: Feature Files as Source

**Status:** implemented

## Approach

Use the smallest bridge that changes source-of-truth behavior without replacing hook enforcement.

| Scenario                                                   | Layer                                      | Implementation path                                                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check reads feature tags before markdown scenario titles` | Unit + command + Cucumber                  | Add a Gherkin parser helper, teach coverage to consume feature tag refs, and make `safeword check` prefer matching feature files over markdown scenarios. |
| `codify emits Vitest from feature source`                  | Unit + command + Cucumber                  | Parse `.feature` scenarios into the existing `ParsedScenario` shape and render the current Vitest skeleton from those scenarios.                          |
| `markdown-only tickets still codify`                       | Command                                    | Keep the existing `test-definitions.md` parser and use it when no matching feature source exists.                                                         |
| `bdd and review instructions point at feature source`      | Static template tests / focused assertions | Update source templates plus dogfood installed copies for BDD, review-spec, planning guide, and test-definition ledger template.                          |

Build order: parser/helper tests first, coverage tests, command tests, Cucumber scenario steps, then template/docs updates.

## Decisions

| Decision       | Choice                                 | Alternatives considered                         | Rejected because                                                                                                                |
| -------------- | -------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R/G/R location | Keep `test-definitions.md` as ledger   | Tags in `.feature`; new sidecar file            | Hooks already enforce markdown checkboxes; moving them now would turn a source-of-truth fix into a hook rewrite.                |
| Parser         | Use `@cucumber/gherkin` AST            | Regex over `.feature` text                      | Gherkin has tags, Rule nesting, descriptions, outlines, comments, and inheritance semantics that regex would quietly mishandle. |
| Migration      | Feature-primary with markdown fallback | Big-bang markdown removal; docs-only discipline | Big-bang breaks old tickets and gates; docs-only leaves drift possible.                                                         |

## Arch alignment

- Honors Schema as Single Source of Truth by updating source templates first and dogfood installed copies to match.
- Honors Reconciliation Over Copy by not changing ownership of customer `features/` or `steps/` files.
- Honors the 102a/102b lane split: Cucumber feature files are acceptance artifacts, while Vitest skeletons remain derived implementation aids.

## Known deviations

skip: no planned deviation from current architecture; this is the deferred 102a/102b follow-on.

## Assessment triggers

- Revisit the ledger location if hooks gain first-class parsing for Gherkin tags or Cucumber JSON messages.
- Revisit recursive feature discovery if monorepos begin producing duplicate feature filenames for one ticket slug.
- Revisit `codify --format gherkin` once all active tickets use `.feature` sources and markdown emission can be deprecated.

## Reconciliation

- Decisions updated: 0.
- Deviations recorded: 0.
- Implementation matched the feature-primary bridge: `.feature` wins for coverage/codify, markdown remains fallback, and `test-definitions.md` remains the R/G/R ledger.
