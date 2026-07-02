# Dimensions: Invisible retro — headless claude -p extraction (7D8PJP)

Derived from spec.md (TB1/TB2/NTB1/SM1 ACs, done_when) + domain knowledge
(hook output surface, headless CLI argv + auth in cloud, transcript size limits,
the inherited egress guard, recursion via re-entrant hooks, transport fallback).

| Dimension                       | Partitions                                                                                                          | AC        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| Stop-hook conversation output   | substantial session → no `additionalContext`, no other conversation-visible stdout                                  | TB1.AC1   |
| Trigger mechanism               | decides to run → invokes extraction as a separate `claude -p` subprocess (not a conversation injection)             | TB1.AC2   |
| Headless argv                   | contains `-p` + `--output-format json` + read-only `--allowed-tools`; never contains `--bare`                       | TB2.AC1   |
| Execution mode                  | hook awaits extraction to completion; never detaches it as a background process                                     | TB2.AC2   |
| Transcript digest               | transcript > cap → digest ≤ cap, retains text + tool-use names; raw transcript never passed whole                   | TB2.AC3   |
| Egress guard (inherited)        | secret in free text → redacted; customer path → redacted; unresolved `safeword_surface` → dropped, not filed        | NTB1.AC1  |
| Recursion guard                 | `SAFEWORD_RETRO_CHILD=1` in env → hook returns without extracting; child is spawned WITH that sentinel set          | NTB1.AC2  |
| Filing transport                | no `GITHUB_TOKEN` but agent transport available → files via agent; token present → REST transport still works       | SM1.AC1   |
| Once-per-session gate           | sentinel already set → no second extraction; substantial + unset → extract once                                     | SM1.AC2   |

**Test layers:**

- **Unit (pure functions):** the digest builder (cap + signal retention), the
  headless-argv builder (flags present/absent), the recursion-guard predicate, the
  `decideRetro` action selector — assert inputs→outputs directly in co-located
  `*.test.ts`, matching `retro-trigger.ts`'s existing injected-deps test style.
- **Hook-level (wiring):** the rewritten `stop-retro.ts` — assert it emits no
  `additionalContext`, awaits the (injected) extractor, and honors the sentinel.
- **Command-level (wiring):** `safeword retro --auto-extract` in a temp dir with
  the `claude -p` subprocess boundary and the GitHub transport mocked — assert the
  egress guard still runs end-to-end and the agent transport path files without a
  token. Real config→module wiring per testing/SKILL.md.

**Boundaries mocked:** only the process boundaries — the `claude -p` subprocess
(stub its stdout findings JSON) and the GitHub transport (agent + REST). Digest,
argv, egress pipeline, and decision logic run real.
