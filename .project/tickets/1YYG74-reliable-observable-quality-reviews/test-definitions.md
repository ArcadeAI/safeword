# Test Definitions: Keep quality reviews observable and actionable

Feature source: `packages/cli/features/reliable-observable-quality-reviews.feature`

The executable contract is intentionally consolidated around customer-visible
boundaries. Focused runtime tests continue to own the complete landed failure
taxonomy (`not_installed`, `unsupported`, `probe_timed_out`,
`not_authenticated`, `launch_failed`, `timed_out`, and `invalid_output`).

## Rule: reliable-observable-quality-reviews.TBU1.R1 — Managed JSON reviews report bounded lifecycle progress separately from their typed result

### Scenario Outline: A slow managed review remains visible without changing its result

- [x] RED b9cf90383
- [x] GREEN 7b675263b
- [x] REFACTOR skip: Review found no behavior-preserving extraction clearer than the existing policy and wiring seams.

### Scenario: Lifecycle reporting is bounded across slow or delayed clocks

- [x] RED skip: Timing behavior pre-existed this characterization; tests were added to expose boundary and coalescing regressions.
- [x] GREEN 81d35a8aa
- [x] REFACTOR skip: Scheduler extraction would enlarge the public timing seam without simplifying the implementation.

## Rule: reliable-observable-quality-reviews.TBU1.R2 — Other callers retain their existing output contract

### Scenario: Only the exact managed signal enables JSON progress

- [x] RED b9cf90383
- [x] GREEN 7b675263b
- [x] REFACTOR skip: Exact signal consumption is already isolated in a single policy helper.

## Rule: reliable-observable-quality-reviews.SWM1.R1 — Progress is a best-effort Safeword-owned side channel

### Scenario Outline: A failed progress destination cannot alter the terminal result

- [x] RED b9cf90383
- [x] GREEN 7b675263b
- [x] REFACTOR skip: The narrow sink wrapper is the smallest safe failure boundary.

### Scenario: Lifecycle output cannot disclose untrusted review data

- [x] RED skip: Reviewer-output isolation was a landed invariant; this ticket adds adversarial regression coverage.
- [x] GREEN 81d35a8aa
- [x] REFACTOR skip: Fixed-message rendering already centralizes the non-disclosure boundary.

## Rule: reliable-observable-quality-reviews.SWM1.R2 — Generated required-review workflows use the compatible managed wrapper

### Scenario: The wrapper scopes its private signal to the Safeword CLI child

- [x] RED 80e55391d
- [x] GREEN e339e2e42
- [x] REFACTOR skip: Environment construction is already a single explicit wrapper function.

### Scenario: Required-review workflows cannot bypass the managed wrapper

- [x] RED skip: Generated surfaces already delegated through the wrapper; this is parity protection against future bypasses.
- [x] GREEN 53e94d96f
- [x] REFACTOR skip: A shared catalogue assertion is the least duplicated representation.

### Scenario: The wrapper remains compatible with a CLI that predates progress support

- [x] RED skip: Compatibility follows from using an environment signal; the live harness records the invariant.
- [x] GREEN e812b8c96
- [x] REFACTOR skip: The wrapper must remain a transparent spawn boundary, so further abstraction would obscure compatibility.

## Feature-level cross-scenario refactor

- [x] cross-scenario skip: Review found no shared extraction that reduces complexity without coupling CLI policy, wrapper compatibility, and generated-surface parity.
