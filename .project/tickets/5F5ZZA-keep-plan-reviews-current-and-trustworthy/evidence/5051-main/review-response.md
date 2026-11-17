# Review follow-up

Review a7043499-6b22-42ae-b3c6-5a1c77c112a4 requested changes. Implemented follow-up:

- Added public-path cross-ticket, invalid-index, blocking-error and confirmation-time edit tests. Error verdicts are refused by authenticated job status before optional-finding selection, so that test asserts REVIEW_NOT_CURRENT rather than manufacturing an approved error receipt.
- Moved Product classification after bounded capture. Nonregular target proof must fail before context resolution; never pre-read a FIFO or symlink.
- Preserved downstream empty-inheritance diagnostic behavior (generic nonowned reviews) while enabling owned Product/scenario context.
- Added a typed stale-disposition recovery result when captured ticket, boundary or current review changes during confirmation.
- Normalized expected finding target with toReviewPath for Windows.
- Retain limitation: atomic rename and cooperating disposition-writer lock are not a universal compare-and-swap against out-of-band writers.
- Retain limitation: TTY confirmation matches approve-plan. It does not cryptographically prove the human is the source of terminal input. The PTY tests prove mechanics, not human authentication.

RED repair run: two intended failures and 13 passing controls; retained in
`review-repair-red.log.gz`. GREEN is queued behind the next foreign test run;
no pending check is claimed as a pass. Full current-head CI remains required.
