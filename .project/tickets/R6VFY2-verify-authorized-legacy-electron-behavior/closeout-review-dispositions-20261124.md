# Final closeout review dispositions

Independent Claude reviews approved runtime 88305023, tests c74011df and
eval/install evidence 17b610e1 without blocking errors. The following changes
and explicit limits answer their warnings. Follow-up review is required for the
modified targets; the earlier approvals are not relabeled as current.

1. Attestation network contract: fixed. Four real parser/catalog assertions
   failed in RED d3e994225; GREEN 06300eee8 declares registry access for row and
   aggregate attestation and refuses offline requests before proof inputs or
   replay. All 16 public/catalog cases pass. Read-only gates remain offline.
   This also corrects the inherited CKWE2D offline promise without changing
   its review identities, receipt format or normal online authorization.
2. Post-exit Windows cleanup: fixed. RED b3b2e809e reproduces taskkill after a
   modeled Windows parent already exited; the POSIX control passes. GREEN
   37cbe9f5c avoids that Windows sweep while retaining live-timeout termination
   and owned POSIX group cleanup. Six execution/cleanup cases and the broader
   23-case execution/runner protection pass. The Windows regression models OS
   and subprocess boundaries; it is not a native Windows walkthrough.
3. Rollback history: the actual CI test checkout uses fetch-depth 0 in
   .github/workflows/ci.yml, including the pinned pre-extension object. The
   rollback test must refuse unavailable history, not skip or fabricate proof.
   A shallow consumer would need that explicit prerequisite.
4. Deadline tests: both now have explicit 20-second test budgets, separate from
   unchanged ten-second row and 120-second closing subprocess deadlines. Their
   protection plus offline eval grading passed 19 tests; types pass.
5. Shared proof inventory: the disclosed cap remains 88, maximum fan-in 14.
   Literal case ownership and full outline rows remain enforced. No artificial
   wrappers were introduced to manipulate the count.
6. Port allocation: probe/release/bind has a disclosed race. Strict binding and
   no-server-reuse turn a collision into refusal; the implementation makes no
   hostile same-user isolation guarantee. The existing plan already explains it.
7. Committed membership: attestation validates tracked archive membership. The
   read gate then requires a current-HEAD signed row and passed replay journal
   as well as matching bytes. It does not authorize an untracked observation
   from bytes alone. This dependency is deliberate, not missing authorization.
8. Primary opt-in: retrospective_claims supplements the mandatory primary
   retrospective_claim anchor; array-only enrollment is not supported or
   promised. The legacy additional-claim test protects supplement behavior.
9. Reviewer scope: supplied integration tests use real authority helpers, but
   no individual packet claims independent inspection of every Safeword module.
   Locked Playwright message compatibility remains a real-host assessment trigger.
10. Eval attribution: README now explicitly limits the result to classification
    under the assembled guide. The vocabulary carries semantic information, so
    this is not a causal ablation proving each production clause necessary.
    It also correctly names one-element response arrays. Production rules,
    case labels and the eight model responses are unchanged by that clarification.
11. Live install scope: vitest.config.ts excludes live files through the shared
    default project contract. The explicit live configuration runs the real
    Codex marketplace/cache test. Its result proves installed route loading and
    field validation after source removal, not successful Electron observation;
    real earlier Electron proofs are separate and explicitly attributed.
12. Duplicate guide foundation: retained. Loading both actual exported rule
    functions preserves freshness without introducing another rubric assembler.

The first current full local verification attempt at d6db8454e was intentionally
interrupted after review identified items 1 and 2. It exited 143/130 and grants
no aggregate pass. The final full run must start after these fixes, rather than
using that interrupted attempt as evidence. No original missing TDD history,
source-ticket closure or readiness receipt is fabricated by these dispositions.
