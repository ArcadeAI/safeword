# Return to scenario review before production implementation

No production implementation has been written. The real installed public command
failed because observation is absent, as recorded in public-red-20261123.md.

The initial commit's markdown heading fix invalidated the optional ledger target
of the earlier scenario approval. A fresh review of the canonical feature alone
then found that the failed-replay outline did not explicitly exercise both row
authorization at a new HEAD and aggregate closing authorization. That finding is
accepted. Coding authorization correctly remains denied.

Required repair: return from implement to scenario-gate, explicitly vary those
two operations, retain their strict evaluator and refusal outcomes, and obtain
fresh scenario and dependent plan reviews before production edits. Also separate
the existing compatibility, ordinary TDD and installed-surface checks and add the
missing changed-policy case within the already accepted Rules. These are proof
repairs, not new scope or implementation completion.

The phase-provenance helper allows backward movement, but the independent
phase-exit hook still demands a review stamp for implement even when moving
backward. This bounded review covers only the work produced so far and the
proposed return for repair. An approval may support that backward transition;
it must not be represented as completed implementation, verification or Ready
authority. The new scenario approval will target the canonical feature, without
the mutable test-progress ledger as an extra work target.
