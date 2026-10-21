# Independent review of the copy/currency repair

This packet covers changes after source review 2a6effee-6e77-4e09-aa00-beecfc7cf7b3.
That complete source review found one release blocker: the changed Execution
reviewer prompt lacks current passing admission. That blocker remains unresolved;
the historical corpus and admission file are unchanged. No full approval,
qualification, or merge readiness may be inferred from this bounded repair.

The new defect was introduced by #5041 copy validation: public status used strict
raw author checks while reconstructing semantic currency. New executable RED
c13f03f2-0038-44e4-aeff-6277b3831b67 independently approved the real installed
hook/status/approval proof, including an unchanged baseline control. The package
and Cursor-project comment-only drift partitions both failed as stale, despite
unchanged semantic inputs. The 146-test focused repair run now passes (two skips).

Review the internal dispatch/currency purpose in packet.ts and job.ts. Only
terminal status reconstructs currency without raw author reads; initial dispatch
and completion still use strict preflight. Currency mode is neither a CLI flag,
serialized packet field nor reviewer-controlled input. A current receipt alone
must not authorize use of a drifted copy: public approve-plan remains strict;
installed phase gates validate actual copies; execution prerequisites validate
both plan copies before public coding authorization. Main's semantic projectors,
normalized Execution identity, approval/discovery policy and parser are retained.
No #5051 Product/scenario context admission or disposition work is enabled.

Review test maintenance without weakening old assertions: the matching
Implementation baseline is now canonical; contradictory reviewer copies still
must name omissions, additions and wrong identity. Native bundle comparison
allows exactly one identity literal, validates its entire phase/path/hash map
against delivered files, and compares every other byte. Typed missing-copy
findings must retain their exact phase, path and message. Existing planning-gate
fixtures retain their semantic collaborator stub but delegate the newly required
integrity command through the actual packaged CLI.

Original review warnings answered:

- Product ownership still fails closed on malformed declared tickets. Broad
  context admission is outside this slice; no generic-review fallback is added.
- receiptReviewCandidates in templates/hooks/run-review.ts always gives bunx an
  explicit homedir cwd, outside the reviewed project (lines 209-212).
- Install validation promises unchanged installed contract files on refusal,
  not rollback of prior namespace/default-config setup effects.
- Managed Cursor assets are checked independently of host env, intentionally
  including ordinary-terminal requests and mixed-host project installations.

Primary sources checked this session: Node fs.readFileSync and crypto Hash docs,
Bun bundler define docs. No new dependency or external API was introduced.
Compiled bundles are excluded from independent source review; deterministic
regeneration, exact host table validation and installed runtime tests cover their
delivery. Host registration/private-injection proof remains deferred.
