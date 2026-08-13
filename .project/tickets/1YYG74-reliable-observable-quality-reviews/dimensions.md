# Behavioral Dimensions: Keep quality reviews observable and actionable

| Dimension | Partitions and boundaries | Scenario coverage |
| --- | --- | --- |
| Invocation owner | Managed wrapper; direct CLI caller | Managed review reports progress; direct JSON review stays silent |
| Output mode | JSON; JSON plus `--quiet`; human output | Managed JSON review reports progress; quiet review suppresses progress; human review emits each update once |
| Internal opt-in | Exact `1`; absent; any other value | Managed review reports progress; direct JSON review stays silent; unsupported signal values stay silent |
| Review outcome | Approved; changes requested; routes exhausted | Managed review reports progress; action-required result follows progress; exhausted review remains typed |
| Progress lifecycle | Completion before/at timer boundaries; delayed start; repeated heartbeat boundaries; suspended-clock coalescing; route transition; after result | Slow managed review remains visibly active; completion cancels pending writes; missed heartbeats coalesce; fallback receives fresh timers |
| Progress sink | Writable; descriptor write fails synchronously; descriptor is closed; approved and action-required results | Managed review reports progress; progress failure does not change either terminal class |
| Reviewer isolation | Valid typed output; rejected/raw output; private signal visibility | Typed result is emitted; reviewer-controlled bytes never become public output; private progress signal never reaches the reviewer |
| Installed surface | Claude Code; OpenAI Codex; progress while child remains active | Installed workflows use the managed wrapper; the wrapper forwards progress before completion |
| CLI generation | Current CLI understands signal; older CLI ignores signal | Current managed review reports progress; older resolved CLI completes silently |

The exact 100 ms delay, 30-second heartbeat cadence, 300-second attempt cap,
540-second shared budget, 120-second funding floor, per-stream byte caps, and
complete reviewer-failure taxonomy are implementation contracts already covered
by focused tests. The feature scenarios retain only the end-to-end regressions
that this progress wiring could break.
