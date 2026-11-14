# Preserve stronger current-main proof before delivery

The last pre-merge check found upstream PR #5994 merged as `7fae8f97fbc30962b916d3b3aba9c61f943ac531`. Integrated it normally as `41a51f256ae3e0f58b85637f885f110d62f216a0`, without rebase, force push or conflict edits. The complete own-slice binary diff against updated main exactly matches the saved pre-integration diff; all 166 frozen product paths and both dependency files retain their recorded hashes.

The incoming stronger `planning-contract-generation.test.ts` matrix is preserved byte-for-byte. Its supported declaration must install pending changes in all three contracts; its invalid variants retain the exact refusal/metadata and byte-preservation assertions. Fresh combined verification: 75 tests across this matrix and `bdd-proof-tags.test.ts` passed, exit 0, 21.48 seconds. All five generated surfaces are current, exit 0. No product regeneration or paid qualification was required.

The incoming feature/proof-map/ledger changes improve discrimination but do not implement conditional native guidance. Their 54 definitions /162 unchecked boxes remain unfinished, and main's 176 undefined cases /528 undefined steps are not acceptance proof. Parent/epic closure and #5139 remain excluded. Older broad counts and failures remain historical rather than being silently overwritten.

Earlier independent reviews cover the unchanged own-slice diff; they are not a new exact-whole-head review. This note and the updated verification record receive their own bounded review. New exact-head CI and a fresh canonical completion receipt are required before merge. The single failed Node 22 timeout and its unchanged passing retry are retained in verify.md and the PR, not relabeled a clean first attempt.
