# Impl Plan: Configure Documentation Sources for Audit

**Status:** implemented

## Approach

| Scenario                                                           | Test layer                          | Implementation path                                                                                                                                          |
| ------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Configured local documentation source is read as audit inventory   | BDD acceptance + unit               | Add an executable Cucumber step around the config helper; keep parser unit tests for relative/absolute/local/external shapes.                                |
| Relative local documentation source resolves from the project root | BDD acceptance + unit               | Assert relative source resolution against a temp project root and keep unit coverage on `resolvedPath`.                                                      |
| Malformed documentation source entries do not block valid siblings | BDD acceptance + unit               | Keep source parsing defensive and filter invalid entries without rejecting the whole array.                                                                  |
| Audit prompts when no documentation source decision exists         | BDD acceptance + template assertion | Add a source-decision helper that distinguishes absent config from explicit empty config; update audit skill/command text to prompt only on absent decision. |
| Explicit empty documentation sources suppress future prompts       | BDD acceptance + unit               | Treat `docs.sources: []` as `explicit-none`; update audit guidance and public docs to make it the durable no-prompt choice.                                  |
| Explicit empty documentation sources use fallback discovery        | BDD acceptance + template assertion | Keep fallback discovery in audit guidance when the decision is explicit-none, and report fallback coverage.                                                  |

Build order: first expose the source-decision helper, then update the audit guidance, then wire executable Cucumber steps, then refresh docs.

## Decisions

| Decision                 | Choice                                                                  | Alternatives considered                                                               | Rejected because                                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Durable no-prompt state  | Use top-level `docs.sources: []`                                        | Add `docs.skipPrompt`, add `audit.docs.skipPrompt`, store hidden state outside config | Empty array is already the natural "no configured sources" value, lives in the same project-owned docs namespace, and avoids audit-owned config. |
| Source decision API      | Add a small decision helper beside `readConfiguredDocumentationSources` | Infer from raw JSON in audit docs only                                                | Tests and step definitions need a stable behavior seam, and future code can reuse the distinction.                                               |
| External source handling | Parse URL/git entries but do not validate them in `safeword check`      | Try network fetches or clones during check                                            | Check must stay local and deterministic; audit can fetch or report skipped coverage.                                                             |

## Arch alignment

Honors `ARCHITECTURE.md`: schema/config remains the source of truth for installed safeword surfaces, while project-owned config in `.safeword/config.json` records customer-specific choices.

## Known deviations

skip: no deviations planned

## Assessment triggers

- Add a real audit runner that executes outside the agent prompt; move prompt/no-prompt behavior into code rather than skill text.
- Add authenticated docs connectors or remote fetch caching; revisit URL/git validation boundaries.
