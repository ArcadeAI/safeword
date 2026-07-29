# Refactor Ledger — Keep stop reviews quiet until a new user prompt

Scout scope: the marker field, its two hook transitions, and their installed-hook integration tests.

1. [x] **Coverage gap — leaf first:** prove the complete `Stop → UserPromptSubmit → Stop` cycle re-arms generic review, using the installed hooks and a real state file. (Quality-review suggestion; behavior proof only.)
2. [x] **Naming — after coverage:** rename `recordReviewMarker` to describe that it writes both phase-review and idle-review state. (Tier 1; behavior-preserving.)

Deferred deliberately: extracting a general read-modify-write helper would make independently running hooks share an abstraction around a known concurrency hazard. The existing explicit writes are safer and clearer at this scope.

Evidence: package-local Vitest ran `stop-hook-transcript-format.test.ts` successfully (17/17) after the rename. The canonical `bun run test` invocation is still queued behind the shared package-test lock.
