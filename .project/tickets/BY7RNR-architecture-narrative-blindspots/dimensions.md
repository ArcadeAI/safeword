# Dimensions: architecture narrative blind spots (BY7RNR)

Derived from spec.md (TB1.AC1–4, TB2.AC1–3, done_when) + domain knowledge (hook standalone constraint, K4BWTQ file-or-directory targets, word-boundary matching pitfalls).

| Dimension                       | Partitions                                                                                                    | AC          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| Narrative location (nudge)      | configured file (non-root); configured ADR directory; unconfigured + root `ARCHITECTURE.md`; unconfigured + none | TB1.AC1/AC2 |
| Config robustness               | no `.safeword/config.json`; unparseable JSON; empty-string value (scenario); non-string value + relative vs absolute path (unit layer, differential parity fixtures) | TB1.AC1/AC2 |
| Fingerprint movement (existing) | moved vs base; unchanged; generated doc absent; baseline unresolvable (fail closed)                            | TB1.AC2     |
| Advisory naming                 | configured path named in nudge text; unconfigured → `ARCHITECTURE.md` named                                    | TB1.AC3     |
| Prompt prose                    | architecture prompt + audit skill structural-drift check name `paths.architecture` with root fallback          | TB1.AC4     |
| Drift input shape               | root index `## Packages` with unmentioned entries; all mentioned; single-repo `## Modules` (never scanned); generated doc absent | TB2.AC1/AC2 |
| Mention matching                | full name; scoped name matched by tail (`@scope/pkg` → `pkg`) — scenarios; case-insensitive + word-boundary (`cli` ≠ `click`) — unit layer on the pure matcher | TB2.AC1/AC2 |
| Narrative form (drift)          | single file; ADR directory (all records concatenated); resolved location absent → silent                       | TB2.AC1/AC2 |
| List capping                    | ≤ cap → all named; > cap → first N + "and N more"                                                              | TB2.AC1     |
| Mode / exit codes               | default; `--check` (current vs stale generated doc); `--stage` — drift advisory never changes any exit code    | TB2.AC3     |

**Test layers:** TB1.AC1–AC3 → **unit + git-backed integration** on the hook helper (extend `tests/hooks/architecture-document-nudge.test.ts` fixtures with config permutations), plus a **differential parity test** pinning the hook-side narrative resolver against the CLI counterpart (extend `architecture-document-nudge-parity.test.ts`, P58R22 pattern). TB1.AC4 → **content assertion** on the template prompt/skill files. TB2.AC1–AC2 → **unit** on the pure drift function (names in ⊄ narrative content) + **acceptance** (cucumber `features/architecture-narrative-blindspots.feature` TB2 rules, real CLI in a temp monorepo, like `architecture-unreadable-workspace.feature`). TB2.AC3 → **acceptance** (spawn CLI, assert exit codes and output per mode).
