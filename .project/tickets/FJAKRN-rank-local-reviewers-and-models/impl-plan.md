# Impl Plan: Let users rank local reviewers and models

**Status:** planned
**Planned on:** 2026-09-01

## Approach

**Riskiest assumption:** the existing fixed three-runtime coordinator can become a data-driven route loop without weakening its source-integrity, provenance, deadline, and degraded-policy results. Prove that first through the public `review run` command with a reversed two-route config and process-boundary fakes; a hardcoded preferred order must fail.

Build in four slices:

1. Add a closed `ReviewRoute` parser in `review/policy.ts`. A present `crossAgentReviewRoutes[author]` must be a non-empty list of supported reviewers with optional validated models; unknown author/reviewer keys reject configuration. It completely replaces legacy model settings. Absence compiles today's primary, alternate, independent fallback, and same-author degraded tail. Public-command rejection tests assert zero process launches.
2. Replace the coordinator's preferred/alternate/fallback control flow with one bounded route loop. Runtime-wide failures suppress later routes for that runtime; attempt failures do not. Same-author success is always degraded and never terminates the chain while a later route remains, under either `prefer` or `require`; only independent success terminates it. When the shared minimum-route deadline cannot fund the next route, the loop stops and reports that route plus every remainder as unattempted. A route with no model omits `--model` entirely. Every skipped, attempted, and unfunded route remains in typed evidence.
3. Add read-only route observations to `safeword status`, only for configured or compiled routes and within one shared five-second probe budget. Capability evidence reuses the coordinator's bounded trusted-executable discovery and exact `--help` required-flag assessment. OpenCode 1.18.23 is verified to expose `models [provider] --pure`, returning provider-qualified identifiers without `--refresh`; add that exact-version real-process case to the existing conformance lane. A successful probe that lacks the flag/model reports `not_compatible`/`not_catalogued`; launch failure, timeout, or unparseable output reports `inspection_unavailable` and never a substantive negative. A runtime-default route reports catalogue `not_applicable`; its execution proof binds the route identity, not an inferred model. Claude/Codex report `catalogue_source: unavailable`, not `not_catalogued`. Under `--offline`, skip catalogue probing and report the source unavailable. Invalid route configuration makes status action-required with the parser error and no displayed routes. Integrity-validated review job results persist the executed reviewer plus optional model; extend runtime-default attempts with an explicit marker, then key `proven` or `known_failure` to that exact route identity. Pre-change records lacking both explicit model identity and the runtime-default marker match no route and supply no execution proof. Tests cover a two-model route, a pre-change record, invalid status config, and a persisted known failure on the first route that must not change attempt order. Observations never affect order.
4. Update configuration docs, command presentation, and the existing `ARCHITECTURE.md` coordinator record in place. Focused policy tests complement public-command process-boundary tests for all three legacy author chains and new-list precedence. Coordinator integration tests cover route/failure/deadline semantics; lifecycle status tests cover evidence; public-command tests prove wiring and zero launch on rejection.

The existing TypeScript/testing guidance applies to every slice. No new dependency or direct Claude/Codex/OpenCode interactive-surface integration is needed.

## Decisions

### Implementation Inspiration

| Reference | Checked on | Source version | Target version | Evidence of fit | Principle to borrow | Mismatch / license / security boundary |
| --- | --- | --- | --- | --- | --- | --- |
| https://opencode.ai/v2/docs/models | 2026-09-01 | OpenCode 1.18.23 binary plus current v2 docs | pinned OpenCode 1.18.23 | Exact binary exposes `models [provider] --pure`; isolated run returned provider-qualified identifiers without refresh | Keep explicit route models concrete and distinguish catalogue presence from execution proof | V2 docs are supporting only; exact-version conformance owns the 1.x contract and offline mode skips the probe |
| https://docs.anthropic.com/en/docs/claude-code/cli-usage | 2026-09-01 | current CLI docs | installed Claude CLI | Documents explicit `--model` selection | Pass model as one argv value through the existing locked-down runner | Model catalogue and credential readiness are not exposed |

**Decision impact:** retained: one ordered route list is the only configuration authority when present; discovery remains descriptive.
**Decision informed:** Represent fallback as one ordered reviewer/model route list

### Recorded Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Represent fallback as one ordered reviewer/model route list | Parse one per-author list and execute it directly; validate only safe identifier shape, never catalogue membership or quality | Separate reviewer/model rankings; fixed runtime order plus overrides | Separate rankings require a hidden join rule; fixed order cannot express the user's fallback intent |
| Preserve local readiness evidence | Derive capability/catalogue live and success/failure from the most recent validated review job | Paid probe; mutable readiness cache | Paid probes spend money and mutate state; a parallel cache can become stale and influence order |
| Handle legacy settings | Compile them only when the new list is absent | Merge both; remove legacy immediately | Merging violates one-list authority; removal breaks existing projects |
| Stop when the shared deadline cannot fund the next route | Reuse `minimumRouteMs` in `packages/cli/src/review/runtime.ts` (`min(60s, configured attempt timeout)`) and report every remainder unattempted | Estimate route-specific cost and skip selectively | Reviewer runtimes have no honest comparable cost estimate; selective funding adds false precision and complexity |

Failure scope is explicit: `not_installed`, `untrusted_install`, `unsupported`, `probe_timed_out`, `launch_failed`, and `not_authenticated` suppress later models on the same runtime. `process_failed`, `timed_out`, `invalid_output`, and provenance failures are attempt-specific, so the next model remains eligible. Cleanup failure remains terminal for the whole run.

If a same-author route succeeds and every later independent route fails, `prefer` retains that completed degraded review as the best-available result with exact provenance; `require` remains blocked. The host-native finish-review ladder remains unchanged after typed route exhaustion when no configured degraded result exists.

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Plain evidence states in status; exact ordered route control in config | [Public review wiring](packages/cli/tests/cli-protocol/review-wiring.test.ts); [route inspection](packages/cli/tests/review/runtime.test.ts) | |
| 1. Structure enforces; instructions suggest | Closed parser rejects invalid/empty routes and coordinator derives independence from author/reviewer identity | [Route policy](packages/cli/tests/review/policy.test.ts); [public review wiring](packages/cli/tests/cli-protocol/review-wiring.test.ts) | |
| 3. Add, never replace | Existing settings preserve behavior until the new list is present | [Route policy](packages/cli/tests/review/policy.test.ts); [public review wiring](packages/cli/tests/cli-protocol/review-wiring.test.ts) | |
| 5. Correct and safe; then clear; then simple | One route type and one loop execute opt-in routes without replacing the legacy path | [Route policy implementation](packages/cli/src/review/policy.ts); [coordinator implementation](packages/cli/src/review/coordinator.ts) | |

Architecture alignment: supersedes only the fixed route-authority clause in the existing cross-agent coordinator record. It preserves trusted executable discovery, read-only reviewer processes, provenance, shared deadline, and typed CLI results; `ARCHITECTURE.md` is updated in the same change.

## Known deviations

The current coordinator record says routing is fixed. This feature deliberately supersedes that clause because fixed routing is the defect being solved; the retained trust and execution boundaries are unchanged.

User-ranked routes may select a weaker model. Safeword records exact provenance and retains guidance to prefer comparable-or-better reviewers, but does not maintain a brittle provider-specific strength ranking or override explicit TBU authority.

## Doc impact

- Update `packages/website/src/content/docs/reference/configuration.mdx` with route syntax, precedence, runtime-default semantics, and evidence limits.
- Update review/status reference prose where it describes fixed routing.
- Amend the existing `ARCHITECTURE.md` coordinator decision with the new route authority and reassess conditions.

## Assessment triggers

- A reviewer CLI removes explicit model selection or exposes a trustworthy credential/readiness command.
- Route lists routinely exceed the shared foreground deadline, making per-route budgets necessary.
- Model-provider provenance becomes a required independence policy rather than descriptive evidence.
- OpenCode changes or removes the verified 1.18.23 `models --pure` contract.
