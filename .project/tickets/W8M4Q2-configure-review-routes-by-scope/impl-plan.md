# Impl Plan: Configure review routes by scope

**Status:** implemented
**Planned on:** 2026-09-02

## Approach

The riskiest assumption is that one author can resolve project → user → built-in preferences without merging lists or changing the existing built-in chain. The cheapest proof is the integration scenario where a project entry for another author leaves the selected author's user list effective.

Build in four slices:

1. Prove the load-bearing route-selection slice with the minimum grammar, profile-path, and effective-resolution code: a project entry for another author must leave the current author's user list effective, while a same-author project list replaces it without merging.
2. Complete route grammar, strict persisted-config parsing, and scoped mutation. Unit tests cover explicit models, runtime defaults, invalid routes, empty author lists/maps, XDG/Windows/home paths, first writes, byte-stable no-ops, selected-author replacement/removal, and preservation of unrelated keys/authors. Set/reset parse only their selected target file: malformed target files fail unchanged, while malformed non-target files remain byte-for-byte untouched and do not block either operation.
3. Complete effective-route integration with the existing review policy. Reads validate both user and project files before selecting project, user, or built-in source; tests cover indivisible precedence, reset fallback, malformed configuration in either scope even when the other is valid, and unchanged legacy defaults.
4. Wire `review routes set|list|reset` through the public command catalogue and handlers. Integration fixtures invoke the assembled `createCliProgram()` boundary for each new entry point, repeated `--route reviewer[=model]` values, default user scope, explicit project scope, JSON source/order output, invalid operands, and no-op reset; `bun run check:cli-contract` reconciles that Commander tree with the catalogue. Tag the feature `@proof.vitest` and add its `.bdd-proof.json` manifest mapping every saved scenario to named executable tests. `packages/cli/tests/bdd-proof-tags.test.ts` enforces manifest completeness and the package's `test:bdd` script excludes this established proof lane. Then update the website configuration reference and verify its command examples against the same CLI contract check.

The affected Safeword CLI surface is proven by the public CLI integration tests; the supporting pure path and parsing cases stay unit tests because no higher scope adds discrimination. No installed language-specific skill applies beyond the repository's TypeScript conventions and shared testing skill.

## Decisions

### Implementation Inspiration

<!-- prettier-ignore -->
| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://specifications.freedesktop.org/basedir/0.8/ | 2026-09-02 | XDG Base Directory Specification 0.8 | Safeword 0.83.0 | Defines XDG_CONFIG_HOME as the base for user-specific configuration | Store Unix user preferences under XDG_CONFIG_HOME with the documented home fallback | Path convention only; no source code reused and Windows needs a native APPDATA branch |
| https://bun.sh/docs/runtime/file-io | 2026-09-02 | Bun 1.3 documentation | Bun 1.3.14 | Documents Bun and node:fs-compatible filesystem primitives used by the existing durable writer | Reuse the repository's durable-write boundary instead of adding a persistence dependency | Documentation is MIT-licensed project material; no retrieved code is copied and filesystem trust remains local-user scoped |

**Decision impact:** changed: personal routes move to one OS-appropriate user profile while project routes retain the existing `.safeword/config.json` contract.
**Decision informed:** Store user routes in the Safeword profile config and project routes in the existing project config

### Recorded Decisions

| Decision                                                                                           | Choice                                                                                                                                                                                                                                                         | Alternatives considered                                                                                        | Rejected because                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Store user routes in the Safeword profile config and project routes in the existing project config | `$XDG_CONFIG_HOME/safeword/config.json` or OS/home fallback for user scope; `.safeword/config.json` for project scope                                                                                                                                          | A project-local `.local` file; environment variables only; a new dependency-backed preference store            | A local project file is easy to commit accidentally, environment variables are poor for ordered structured data, and another store duplicates an established JSON contract |
| Resolve one configured route list per author                                                       | Project `crossAgentReviewRoutes[author]`, then user `crossAgentReviewRoutes[author]`, then built-in chain; never merge lists. Invocation-time review options remain at their existing caller boundary and are outside this ticket's persisted-route resolution | Concatenate scopes; choose one global scope for every author                                                   | Merging changes user-declared order and global selection lets one project's unrelated author entry mask personal preferences                                               |
| Expose explicit set, list, and reset commands                                                      | Extend the typed public CLI catalogue and existing handler boundary                                                                                                                                                                                            | Require hand-editing JSON; create a separate configuration CLI                                                 | Public commands give validation and inspectability while reusing the established entry point                                                                               |
| Isolate strict reads from scoped writes                                                            | Effective reads parse both user and project `crossAgentReviewRoutes[author]` data before precedence; set/reset parse only the selected target scope and never inspect or alter the non-target file                                                             | Parse both scopes for every operation; silently ignore malformed files; repair malformed files during mutation | Cross-scope mutation coupling violates scope isolation, silent read fallback changes user intent, and implicit repair can destroy unrelated configuration                  |
| Validate repository-authored route values before launch                                            | Accept only `claude`, `codex`, or `opencode` reviewers and the bounded model grammar; derive independence from reviewer/author identity so same-author routes remain degraded and cannot satisfy required cross-agent policy                                   | Forward arbitrary strings to runtime adapters; trust list position as independence                             | A committed config is untrusted launch input, and user-controlled labels cannot establish independent provenance                                                           |

## Design alignment

| Principle                                         | Consequence                                                                                                        | Proof                                                                            | Conflict |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | -------- |
| Optimize for the NTB without constraining the TBU | Built-in behavior stays automatic while set/list/reset and explicit models remain available                        | `packages/cli/tests/review/preferences.test.ts` and public CLI integration tests |          |
| 1. Structure enforces; instructions suggest       | Typed parsing and failing tests enforce precedence and malformed-config behavior rather than documentation alone   | focused parsing/precedence tests plus `bun run typecheck`                        |          |
| 3. Add, never replace                             | Mutations preserve unrelated keys and other authors; project authority layers above user preferences               | scoped mutation integration tests                                                |          |
| 5. Correct and safe; then clear; then simple      | One route type and one scoped persistence module reuse the existing policy and durable writer without a dependency | typecheck, focused tests, and final quality review                               |          |

This honors `ARCHITECTURE.md` decisions that `src/cli-protocol` owns typed public commands, `src/review` owns reviewer policy and fallback behavior, and **Ranked local routes (2026-09-02)** uses `crossAgentReviewRoutes[author]` as the one ordered reviewer/model list. During planning, that accepted record was updated in place to add project/user resolution. The change is reversible and local to those existing modules, so no new ADR is warranted.

## Known deviations

skip: no deviations planned

## Doc impact

- `packages/website/src/content/docs/reference/configuration.mdx`: document user-profile locations, precedence, commands, route syntax, and model defaults.
- `README.md`: no change; it does not currently enumerate review configuration controls, so adding only this command family would create an isolated reference section.

The website update is part of slice 4 and is checked against the executable command catalogue.

## Assessment triggers

- A fourth review runtime or non-local host needs credentials or preferences that cannot share the existing route schema.
- Safeword introduces additional user-scoped settings that justify a general configuration service rather than this focused module.
- Concurrent writers become a supported workflow and require compare-and-swap or locking beyond the existing durable atomic write.
- User testing shows that `reviewer=model` is ambiguous enough to justify a richer interactive configuration surface.
