# Dimensions: Retro filer subagent gate (GH628F)

| Dimension | Partitions / boundaries | Scenarios |
| --- | --- | --- |
| Spool state | unfiled drafts; empty/absent spool; drained after `markDraftsFiled`; torn/malformed lines (fail-open) | dispatch on unfiled drafts; silent on drained/absent spool |
| Attempt budget | 0 attempts (fresh batch); 1 attempt; at cap (2); marker missing/corrupt (treated as fresh) | fires at most twice per batch; persisted across evaluations |
| Batch identity | unchanged signature set; batch gains a draft; order permutation (same key) | batch gaining a draft resets the counter |
| Harness channel | Claude Stop `decision:block`; Codex Stop `decision:block` post-extraction; Cursor `followup_message` | one scenario per harness adapter |
| Channel contention | quality-review/architecture nudge also wants the stop; filing alone | Codex architecture-nudge precedence; Cursor quality-review untouched |
| Loop / recursion guards | `stop_hook_active` true; retro child env; normal stop | Claude hook silent when `stop_hook_active` |
| Config toggles | `selfReport.file` on (default); off | gates silent when filing disabled |
| Session identity | present; missing/unresolvable (silent) | Claude hook silent without session id |
| Install surface | fresh install ships 3 agent definitions; dirs shared vs owned | agent definitions installed for all three harnesses |
| Dispatch content | 1 draft (singular); N drafts; instruction names agent + spool path, no inline procedure | dispatch instruction naming filer agent and spool path |

Out of scope (per ticket): token-shape validation (#634), signature-dedupe
false-miss, Claude final-turn async gap, background dispatch.
