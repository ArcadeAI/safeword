# Dimensions: architecture narrative blind spots (BY7RNR)

> **Supersession (2026-07-28):** GitHub #1609 retired TB2's package-mention
> advisory. The TB2 partitions remain historical delivery evidence only.

Derived from the retained TB1.AC1–4 + domain knowledge (hook standalone constraint and K4BWTQ file-or-directory targets).

| Dimension                       | Partitions                                                                                                    | AC          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| Narrative location (nudge)      | configured file (non-root); configured ADR directory; unconfigured + root `ARCHITECTURE.md`; unconfigured + none | TB1.AC1/AC2 |
| Config robustness               | no `.safeword/config.json`; unparseable JSON; empty-string value (scenario); non-string value + relative vs absolute path (unit layer, differential parity fixtures) | TB1.AC1/AC2 |
| Fingerprint movement (existing) | moved vs base; unchanged; generated doc absent; baseline unresolvable (fail closed)                            | TB1.AC2     |
| Advisory naming                 | configured path named in nudge text; unconfigured → `ARCHITECTURE.md` named                                    | TB1.AC3     |
| Prompt prose                    | architecture prompt + audit skill structural-drift check name `paths.architecture` with root fallback          | TB1.AC4     |

**Test layers:** TB1.AC1–AC3 → **unit + git-backed integration** on the hook helper (extend `tests/hooks/architecture-document-nudge.test.ts` fixtures with config permutations), plus a **differential parity test** pinning the hook-side narrative resolver against the CLI counterpart (extend `architecture-document-nudge-parity.test.ts`, P58R22 pattern). TB1.AC4 → **content assertion** on the template prompt/skill files.
