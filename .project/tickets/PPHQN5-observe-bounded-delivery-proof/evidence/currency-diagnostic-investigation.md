# Root Cause

The accepted source-change example correctly refused current success but named
an unchanged ticket before the assertion source that actually changed. This is
an observer diagnostic defect, not evidence that original delivery behavior
failed and not historical RED repair.

The conservative reader policy switches from projected ticket identities to
full-byte identities when a non-project source reader changes. That makes the
two audit tickets' derived identities differ even when their raw bytes did not.
`requireIdentical` walks insertion order, where `.project/` sorts before
`packages/`, and reports that derived difference before the changed raw source.

Competing causes checked:

1. Accidental ticket mutation: ruled out by identical raw ticket digests before
   and after changing only the assertion source in a complete owned snapshot.
2. Wrong source path or assertion: ruled out because the exact named required
   source is present among changed `file:` identities. The actor-facing test
   reached verification, got exit 2 and current=false, then failed at its
   specific recovery-message assertion.
3. Derived identity order: confirmed. The reader policy changed, both audit
   ticket identities changed, and the first changed key is the unchanged
   observer ticket. See currency-diagnostic-root-cause.json.

The smallest repair is to compare raw product file/mode identities before
projected project records and aggregate identities. Keep every identity bound,
keep all stale/refusal decisions, and retain the existing actor-facing assertion.
No new projection exemption, gate, command or historical ledger change is needed.

The complete acceptance run must finish and remain retained before the repair.
Then obtain trusted execution/review of the existing failing source-change row,
make this ordering correction, rerun the freshness examples and ordinary
verification, and perform the final clean-checkout pilot. This note is an
investigation within the active feature; it does not reclassify that feature as
a separate bug ticket or alter its reviewed scope.
