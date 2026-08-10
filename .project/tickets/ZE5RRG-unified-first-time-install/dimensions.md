# Dimensions: One coherent Safe Word command model

| Dimension | Partitions and boundaries |
| --- | --- |
| Lifecycle | install; status; doctor; plan; uninstall; legacy cleanup/recovery |
| Agent selection | omitted (Claude + Codex); one agent; multiple agents; `none`; Cursor explicit; unknown value; duplicate value; `none` combined with an integration |
| Configuration surface | core project; Claude profile; Codex profile; Cursor project files |
| Existing state | unconfigured; converged; drifted; partially installed; legacy alias invocation; custom/third-party content present |
| Host availability | available; missing executable/host; plugin install failure; later retry |
| Execution policy | online; offline; no-input; interactive; exact destructive confirmation; stale confirmation |
| Result state | healthy; changed; action-required; partial success; failed |
| Output contract | concise human; verbose doctor; global versioned JSON; legacy raw JSON compatibility |
| Compatibility route | command alias; option alias; bare invocation; no scheduled removal; hidden or compatibility-only help placement |
| Architecture input/output | worktree input; index input; leave output unstaged; stage output; legacy combined spelling; invalid combination |
| Documentation/discovery | top-level help; family help; capabilities; CLI reference; quick start; compatibility table |
| Repetition and recovery | first run; identical rerun; retry after one surface fails; recover after destructive work |
| Proof boundary | production CLI wiring; Claude subprocess/profile boundary; Codex subprocess/profile boundary; Cursor filesystem reconciliation; live-host proof or named skip |
| Persona walkthrough | NTB human summary and recovery; TBU verbose/JSON evidence and targeted control |

Boundary calls:

- Offline refusal happens before any mutation when the selection requires network access.
- Unqualified uninstall mirrors unqualified install but remains preview-only until exact-plan confirmation.
- Cursor is never implied by an omitted selector.
- Duplicate agent values are harmless and normalized; `none` is exclusive.
- Compatibility aliases remain executable with no scheduled deletion date but never become a second canonical quick path.
