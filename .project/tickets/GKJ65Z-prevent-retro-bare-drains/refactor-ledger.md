# Refactor ledger

Scope: the uncommitted #1805 implementation. All applied entries must preserve
observable behavior and keep source/template mirrors byte-identical.

## Leaf-first queue

- [x] Move the drain helper's schema entry beside the other `hooks/lib/*`
  entries. Very low risk; ownership/locality only.
- [x] Replace `fileSpooledDrafts`'s signature array with a numeric posted count.
  Very low risk; the collected strings are never read.
- [x] Replace `runRetro`'s acknowledged-signature projection with an
  acknowledged count. Very low risk; only the projection length is consumed.
- [x] Centralize paired `filedSignatures` / `filedDestinations` writes behind a
  private helper. Low risk; preserves the exported `TriageResult` shape while
  preventing branch drift.

## Deliberately deferred

- [x] ~~Remove `filedSignatures` from `TriageResult`.~~ Deferred: this changes an
  exported result contract. The private synchronization helper captures the
  refactor value without widening #1805's API risk.
- [x] ~~Make `markDraftsFiled` private.~~ Deferred: tests intentionally use the
  primitive to reproduce an illicit drain, and changing that seam is a policy/API
  change rather than a behavior-preserving refactor.
- [x] ~~Unify host filing prose or force byte-identical wording.~~ Rejected: the
  agent, skill, Codex, and fallback-guide copies are intentional local safety
  contracts; source/install mirrors and parity tests already enforce ownership.
- [x] ~~Abstract the new prompt assertions further.~~ Deferred: the assertions
  cover distinct host-native surfaces, and a shared phrase table would hide which
  contract failed for negligible production-code benefit.
