# Impl Plan: ADR consultation step + ADR-creation prompt

**Status:** implemented

## Approach

Test layers + build order (each builds on what's already green):

1. **Helper** (6 scenarios) — unit tests, `packages/cli/tests/utils/architecture-records.test.ts` against a new `packages/cli/src/utils/architecture-records.ts` (`listArchitectureRecords(resolvedPath)` → `{ kind: 'file' | 'directory' | 'absent', records: string[] }`). Temp-dir fixtures; resolution itself reuses `resolveConfiguredPath`.
2. **Check advisory** (3 scenarios) — command-level tests following the existing `safeword check` test pattern: ticket fixtures with impl-plan.md Arch alignment variants, asserting the question output. Reuses the impl-plan parser (hooks/lib/impl-plan.ts is template-side; check is CLI-side — the CLI imports the section state via its own read of the section using the same content-or-skip semantics, implemented against `markdown-sections.ts` utilities if a thin read suffices).
3. **Docs** (1 scenario) — expand SCENARIOS.md exit step 3's Arch alignment bullet into the consultation procedure + canonical "None recorded yet" copy + first-ADR prompt + both-branch worked example; sync dogfood copy; doc-presence test with three labelled markers.

## Decisions

| Decision            | Choice                                                     | Alternatives considered         | Rejected because                                                             |
| ------------------- | ---------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------- |
| ADR location config | Reuse `paths.architecture`, file-or-directory              | New `adrLocation` field         | Two keys for one concept drift; no industry-canonical dir default exists     |
| Claim validation    | Structural advisory (content + absent location → question) | Token extraction of `.md` refs  | Prose extraction violates the YR6C49 structural-only ruling; false positives |
| Helper placement    | `src/utils/` (CLI-side)                                    | `hooks/lib/` cross-runtime copy | No hook consumes it — only `safeword check` and agent docs; YAGNI            |
| Directory semantics | Flat, accept-any `.md`, README excluded                    | Numeric/ADR- prefix enforcement | Don't impose convention on projects with existing nonconforming ADR names    |

## Arch alignment

skip: no project-local ADR directory yet — safeword's own architecture record is ARCHITECTURE.md, and this change extends its documented configured-paths pattern (K7N2QM) rather than touching any recorded decision

## Known deviations

skip: no deviations — reconciled at implement exit: all four Decisions rows held as planned; one Approach refinement (check reads the Arch alignment section with a local content-or-skip scan rather than markdown-sections utilities — smaller than wiring the shared parser for one section)

## Assessment triggers

- MBGQ89's reference schema lands → revisit per-reference existence validation for Arch alignment claims.
- Projects need nested ADR directories (monorepos) → revisit the flat/no-recursion rule.
- A hook needs record listing (e.g. write-time consultation enforcement) → move the helper to hooks/lib with the cross-runtime-copy pattern.
