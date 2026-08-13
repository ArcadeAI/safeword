# Behavioral Dimensions: Keep quality reviews observable and actionable

| Dimension | Partitions and boundaries | Scenario coverage |
| --- | --- | --- |
| Invocation owner | Managed wrapper; direct CLI caller | Managed review reports progress; direct JSON review stays silent |
| Output mode | JSON; JSON plus `--quiet`; human output | Managed JSON review reports progress; quiet review suppresses progress; human review emits each update once |
| Internal opt-in | Exact `1`; absent; any other value | Managed review reports progress; direct JSON review stays silent; unsupported signal values stay silent |
| Review outcome | Approved; changes requested; routes exhausted | Managed review reports progress; action-required result follows progress; exhausted review remains typed |
| Progress lifecycle | Completion before/at timer boundaries; delayed start; repeated heartbeat boundaries; suspended-clock coalescing; route transition; after result | Slow managed review remains visibly active; completion cancels pending writes; missed heartbeats coalesce; fallback receives fresh timers |
| Progress sink | Writable; injected writer fails synchronously on first or later attempts; approved and action-required results | Managed review reports progress; sink-unit proof shows failures remain contained and later writes are attempted |
| Reviewer isolation | Valid typed output; rejected/raw output; wrapper-only signal presented to the reviewer environment allowlist | Typed result is emitted; reviewer-controlled bytes never become public output; the allowlist omits the wrapper-only signal |
| Installed surface | Claude Code; OpenAI Codex; progress while child remains active | Installed workflows use the managed wrapper; the wrapper forwards progress before completion |
| CLI generation | Current CLI understands signal; older CLI ignores signal | Current managed review reports progress; older resolved CLI completes silently |

The exact 100 ms delay, 30-second heartbeat cadence, 120-second default route
attempt, 1,800-second detached-worker run bound, per-stream byte caps, and
complete reviewer-failure taxonomy are implementation contracts already covered
by focused tests. The feature scenarios retain only the end-to-end regressions
that this progress wiring could break.
