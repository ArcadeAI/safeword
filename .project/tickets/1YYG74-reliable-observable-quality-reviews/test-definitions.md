# Test Definitions: Keep quality reviews observable and actionable

Feature source: `packages/cli/features/reliable-observable-quality-reviews.feature`

The executable contract is deliberately limited to customer-visible behavior
that has named Vitest proof. Exact scheduler interleavings, TTY duplication, and
the coordinator's complete failure taxonomy are lower-level implementation
contracts owned by their focused tests, not claims made by this feature.

## Rule: reliable-observable-quality-reviews.TBU1.R1 — Managed JSON reviews expose reviewer activity without changing their result

### Scenario Outline: Managed progress preserves each terminal review outcome

- [x] RED b9cf90383
- [x] GREEN 7b675263b
- [x] REFACTOR skip: The result and progress boundaries remain independently asserted.

### Scenario: Active route progress identifies the assigned reviewer

- [x] RED b9cf90383
- [x] GREEN 53e94d96f
- [x] REFACTOR b57369073

### Scenario: Completion cancels pending lifecycle output

- [x] RED skip: Characterization mutation removed cancellation and made the policy test fail.
- [x] GREEN 81d35a8aa
- [x] REFACTOR skip: The reporter already owns both pending handles in one closure.

## Rule: reliable-observable-quality-reviews.TBU1.R2 — Unsupported callers retain the existing machine and human contracts

### Scenario Outline: Only the exact private signal enables JSON progress

- [x] RED b9cf90383
- [x] GREEN 7b675263b
- [x] REFACTOR b57369073

### Scenario Outline: Quiet mode wins over managed progress

- [x] RED b9cf90383
- [x] GREEN 53e94d96f
- [x] REFACTOR b57369073

### Scenario: Human-readable progress remains enabled without the private signal

- [x] RED skip: This is the pre-existing compatibility baseline.
- [x] GREEN 53e94d96f
- [x] REFACTOR skip: One output-policy predicate expresses the precedence.

## Rule: reliable-observable-quality-reviews.SWM1.R1 — Progress is a best-effort Safeword-owned side channel

### Scenario Outline: Progress write failures stay contained and retryable

- [x] RED b9cf90383
- [x] GREEN 7b675263b
- [x] REFACTOR skip: The narrow sink wrapper is the smallest failure boundary.

### Scenario: The reviewer allowlist excludes the wrapper-only signal

- [x] RED 80e55391d
- [x] GREEN e339e2e42
- [x] REFACTOR skip: The allowlist outcome is the customer-relevant isolation boundary.

## Rule: reliable-observable-quality-reviews.SWM1.R2 — Required-review workflows use a compatible managed wrapper

### Scenario: The wrapper scopes progress to its JSON review child

- [x] RED 80e55391d
- [x] GREEN e339e2e42
- [x] REFACTOR b57369073

### Scenario Outline: The wrapper remains compatible with an older review-capable CLI

- [x] RED skip: Compatibility follows from the environment-only opt-in; the live harness records it.
- [x] GREEN e812b8c96
- [x] REFACTOR skip: The wrapper remains a transparent spawn boundary.

### Scenario: Required-review surfaces cannot bypass the managed wrapper

- [x] RED skip: Generated surfaces already delegated through the wrapper; this prevents future bypasses.
- [x] GREEN 53e94d96f
- [x] REFACTOR skip: Catalogue inspection is the least duplicated parity representation.

## Feature-level cross-scenario refactor

- [x] cross-scenario b57369073
