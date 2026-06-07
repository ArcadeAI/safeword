# Dimensions: `safeword codify` (CS86B0)

Derived from spec.md (AC1/2/3, done_when) + domain knowledge (markdown skip-mask, vitest module validity).

| Dimension                    | Partitions                                                                                   | AC  |
| ---------------------------- | -------------------------------------------------------------------------------------------- | --- |
| Scenario→test mapping        | one scenario; many scenarios under one rule; many rules; free-text (no-AC) title             | AC1 |
| Step rendering               | Given/When/Then present → `//` comments                                                      | AC1 |
| Input robustness (skip-mask) | `### Scenario:` inside code fence / HTML comment → skipped; trailing non-`Rule` `##` ignored | AC1 |
| Body style                   | default → `it.todo`; `--red` → throwing `it`                                                 | AC2 |
| Output sink                  | stdout (default); `--out` new path → write; `--out` existing path → refuse                   | AC3 |
| Input validity               | valid with scenarios; missing test-definitions.md; present but zero scenarios                | AC3 |

**Test layers:** AC1 + AC2 → **unit** (pure `emitVitestSkeleton`, assert the emitted string — co-located `src/utils/test-skeleton.test.ts`). AC3 → **command-level** (temp dir; assert stdout / file written / exit code — like `tests/commands/ticket-new.test.ts`).
