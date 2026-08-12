# Implementation Plan: Durable independent review

**Status:** planned

## Approach

Introduce a small local job boundary around the existing review coordinator. The initiating command starts a detached worker, polls its persisted record for a short courtesy window, and either returns the existing final `CliResult` or a typed pending result. A status command reads the same record, validates its source fingerprint, and returns the stored final result without invoking another reviewer.

Persist records beneath `.safeword/state/reviews/` using atomic replacement. The record owns the review ID, inputs, source fingerprint, worker PID, timestamps, state, and final result. The existing coordinator remains the only implementation of reviewer routing and output validation.

## Build order and proof

1. Add job-record parsing, atomic persistence, fingerprinting, and lifecycle unit tests.
2. Add a hidden worker command that runs the existing coordinator and seals its terminal result.
3. Wrap `review run` with start-and-courtesy-wait behavior and prove quick/pending paths through the CLI boundary.
4. Add `review status` and `review cancel`, proving collection, staleness, and process cleanup.
5. Update quality-review skill templates and generated Codex copy so agents collect pending results.

## Decisions

| Decision | Choice | Rationale | Alternatives considered |
| --- | --- | --- | --- |
| Persistence | Atomic JSON records under Safeword state | Local, inspectable, dependency-free, and adequate for one-worktree jobs | SQLite adds migration and locking cost without a demonstrated need |
| Execution | Detached CLI worker | Survives the initiating process and reuses the exact coordinator contract | Keeping a promise alive cannot survive terminal exit |
| Fast path | Courtesy polling before returning pending | Preserves today's excellent quick-review experience | Always-background adds ceremony to the common case |
| Validity | Source fingerprint checked at collection | Prevents old approval from being mistaken for current evidence | Commit-only binding misses dirty worktrees |
| Time control | A larger absolute deadline in the detached worker | Lets legitimate deep work outlive the caller while still bounding runaway work | A short caller-derived wall-clock timeout caused the current failure |

## Design alignment

- **Structure enforces; instructions suggest:** persisted source binding makes stale approval structurally unreturnable.
- **Fire at boundaries:** status changes only at start, completion, cancellation, and collection.
- **Correct and safe; then clear; then simple:** one JSON record and one worker reuse the coordinator; no scheduler or service is introduced.

## Known deviations

- Automatic host notification is deferred because the standalone CLI has no portable callback into an exited agent task. Durable collection is the honest first boundary.

## Assessment triggers

- Move records to SQLite if multiple processes need transactional updates beyond atomic whole-record replacement.
- Add a host notification adapter when Claude, Codex, or Cursor exposes a stable task-resumption callback.
