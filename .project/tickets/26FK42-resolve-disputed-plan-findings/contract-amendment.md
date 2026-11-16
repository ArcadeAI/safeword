# Proposed dispute-contract amendment

Status: draft for reconciliation; not an approval or replacement for the
parent or child Rules. The user accepted the simpler path on 2026-11-14 after
the plan review showed that the default two-agent route could be cumbersome.

## User decision

- Log a disagreement with its reason and the relevant accepted requirement or
  plan text. A disputed nonblocking suggestion does not prevent progress.
- A disputed blocking correctness finding remains unresolved and the plan is
  not approved. Continue work that does not depend on that approval.
- After a material correction to the plan or review basis, request a fresh
  review. Do not silently redispatch an unchanged disagreement.
- All additions, removals or narrowing of accepted product scope require the
  user, whether or not a reviewer is involved. Correcting an omission already
  inside accepted scope is not a scope change.

## Contract impact to resolve

The accepted parent TBU5.R2 currently requires a fresh adjudicator for
correctness or relevance, and TBU5.R5 names `unresolved after available
independent routes`. The child R2, R3 and route-exhaustion scenarios also
explicitly require adjudication. The simpler path removes an automatic
adjudication requirement for a disputed blocking finding; it must not be
described as satisfying those unchanged Rules. Parent and child need a coherent
amendment and fresh scenario review before implementation.

This decision does not authorize an agent to waive a blocking finding or mark
unresolved correctness approved. It also does not resolve how to distinguish a
truly optional suggestion from a blocking defect when classification itself is
disputed, nor how a pending finding survives a reclaimed cloud runtime. Preserve
both existing obligations until their replacement is specified and reviewed.
In particular, do not infer that optional-classification adjudication, durable
recovery, or existing human-approval behavior was removed.

## Proof boundaries

Prove nonblocking disagreement is logged and the gate can proceed; a disputed
blocking finding leaves approval unchanged; independent work can continue; a
changed plan or review basis starts a fresh review; unchanged bytes do not
silently redispatch; and all scope changes require user authority. Real-host
reclaim-and-resume remains necessary for the existing cloud recovery scenarios.
Preserve the historical test ledger, missing RED, failures and 33 deferred cases;
new evidence cannot retroactively mark them complete.

## Scenario reconciliation map

The 15 original scenario headings remain historical until the amended contract
and replacement scenario set have been reviewed. Do not check their RED, GREEN
or REFACTOR boxes merely because the requirement changes.

- Keep the missing-origin refusal, explicit classification, unsupported-class
  refusal and provenance-based currency examples where they remain applicable.
- Preserve optional-advice user choice, the accepted-but-undelivered gate check,
  and the rule that an agent cannot adopt extra scope. Preserve the independent
  optional-classification requirement until its owner and replacement are clear.
- Preserve immediate headless exit, durable later-session recovery, interactive
  user decision and the refusal to approve unresolved correctness.
- Replace correctness-adjudicator and available-route-count scenarios with
  examples of logged disagreement, blocked approval, continuing unrelated work,
  and a fresh review after a material correction. Preserve the unchanged-byte
  refusal; this change does not authorize silently retrying an unchanged finding.
- Reconcile typed outcomes against the amended parent; do not invent an upheld,
  rejected or reclassified verdict merely because an agent logged disagreement.

The mapping is not a replacement scenario set and is not a review verdict. A
fresh scenario review must compare every retained and replaced behavior against
the amended parent, including the 5F5ZZA optional-advice boundary and both cloud
recovery examples.
