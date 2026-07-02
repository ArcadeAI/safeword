# Impl Plan: Codex retro parity — invisible local extraction and Lane-2 filing

**Status:** implemented

## Approach

**Riskiest assumption:** a Codex Stop hook can synchronously spawn child
`codex exec` with a readable `transcript_path`, closed stdin, inline digest, and
`--output-schema` without hanging or returning unusable output. The cheapest proof
was the required live gating spike, completed before implementation and posted to
issue #602: Stop payload had a readable transcript, child exit status 0,
schema-valid JSON in the `-o` file, and a silent Stop hook completed with parent
status 0.

Proof plan and build order:

| Scenario | Owner / layer | Primary proof | Why enough |
| --- | --- | --- | --- |
| Stop hook runs child extraction with inline digest | `hooks/lib/retro-extract.ts` Codex argv/parser + `hooks/codex/stop.ts` | integration (hook subprocess with injected child command) | drives the real hook entry point while mocking only the child process boundary |
| Stop hook fails open without a continuation | `hooks/codex/stop.ts` | integration | malformed input, child non-zero/timeout, missing output, invalid schema all assert stdout stays empty, exit 0, and no state/spool/file mutation happens |
| Retro child Stop does not recurse | `hooks/codex/stop.ts` + `SAFEWORD_RETRO_CHILD` | integration | proves the hook exits before spawning when the child sentinel is present |
| Per-agent model defaults | `resolveRetroModel(project, agent)` | unit | pure config/default selection; guards Claude `sonnet` while adding Codex `gpt-5.5` |
| Configured model override | `resolveRetroModel(project, agent)` | unit | proves the install override still wins over both agent defaults |
| Child findings spool and direct-file | existing `safeword retro --auto-extract` / egress / spool / triage path | integration or existing command coverage plus adapter wiring | includes a leak canary so bypassing egress fails |
| Unfiled drafts remain for Lane 2 | `runRetro` / `retro-draft-spool.ts` existing BNGK9W tests plus Codex adapter wiring | integration | proves Stop does not lose drafts when direct filing is unavailable |
| Empty child findings stay silent | Codex adapter + existing retro pipeline | integration | proves schema-valid empty findings produce no spool/file/nudge work |
| Codex config wires prompt nudge | schema/config tests | unit/integration | checks generated `codex/config.toml` and retrofit patch include UserPromptSubmit nudge |

Build sequence: model default first (pure RED), Codex child argv/parser second,
Stop adapter replacement third, config/schema nudge wiring fourth, then focused
integration tests over the replaced Codex Stop adapter.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Stop output | Write nothing on success/fail-open | Keep `{}` silent JSON; keep `{decision:"block"}` | Live spike proved empty stdout is safe; `{decision:"block"}` is the hijack #602 removes |
| Child command | `codex exec --output-schema <schema> -o <out> --json --sandbox read-only -m <model> <inline digest + task>` with stdin closed | Read digest through tools/MCP; detached child | Inline digest avoids output-schema/tool conflict; closed stdin avoids hangs; detached survival is undocumented |
| Model default | Add per-agent default: Claude `sonnet`, Codex `gpt-5.5`, both config-overridable | One global default | Stock Codex cannot call Claude; one default either breaks Codex or weakens Claude |
| Filing path | Invoke the existing `safeword retro --auto-extract` egress/spool/try-file path | Reimplement egress/spool in the Codex hook | Shared core is the security boundary and already owns direct vs fallback filing |
| Lane 2 | Wire `prompt-retro-nudge.ts` into Codex UserPromptSubmit | Surface from Stop | Stop continuation hijacks; UserPromptSubmit additionalContext is the non-hijacking channel |

## Arch alignment

Honors `ARCHITECTURE.md` schema-as-single-source-of-truth, reconciliation over
copy, IDE parity, and byte-parity template mirror principles. Honors the retro
architecture from RV9JT4 / 7D8PJP / BNGK9W: trigger core stays shared, egress is
the security boundary, and spooled drafts contain only code-assembled
`{signature,title,body,labels}`.

## Known deviations

skip: no deviations planned — this replaces only the Codex adapter and Codex
config wiring while reusing the shipped shared retro core.

## Assessment triggers

- Codex changes `codex exec --output-schema` behavior with MCP/tools active.
- The default OpenAI model name changes or a lower-latency Codex extraction model
  becomes the project standard.
- Codex cloud documents hook support; split the cloud spike from #602's local path.
