# Refactor Ledger — Keep stop reviews quiet until a new user prompt

Scout scope: the marker field, its two hook transitions, and their installed-hook integration tests.

1. [x] **Coverage gap — leaf first:** prove the complete `Stop → UserPromptSubmit → Stop` cycle re-arms generic review, using the installed hooks and a real state file. (Quality-review suggestion; behavior proof only.)
2. [x] **Naming — after coverage:** rename `recordReviewMarker` to describe that it writes both phase-review and idle-review state. (Tier 1; behavior-preserving.)
3. [x] **State writes — hook-local:** batch prompt-hook mutations into one final write so clearing the marker does not add another torn-write window. (PR #1652 review.)
4. [x] **Test home — focused:** move marker-lifecycle coverage out of the frozen transcript-format suite into `stop-hook-idle-review.test.ts`; share its state-path helper between setup and assertions. (PR #1652 review.)

Deferred deliberately: extracting a general read-modify-write helper would make independently running hooks share an abstraction around a known concurrency hazard. The explicit cross-hook writes are safer and clearer at this scope; the prompt hook batches only its own already-loaded state object.

Evidence: package-local Vitest passed the idle-review (3), typecheck (4), phase-backstop (3), frozen transcript (14), and prompt-marker (1) focused coverage after the PR-feedback fixes. The canonical Node 24 CI job was re-run and the new branch head will trigger a second CI run.
