# Existing repair dependency comparison

Decision under investigation: retain the four-PR candidate with a complete bounded backport, or add the higher PRs that own the repair. Correctness includes repeated approve-plan with either human gate setting, a prior approval for identical plan bytes, unrelated reviews, stale Execution discovery, legitimate repair plus fresh review, and existing legacy compatibility.

## Evidence and closure

Remote main remains d5885e58771cd87f8108196ce67986f7725a1974. Read-only `gh pr list` now works; all epic PRs remain Draft. Exact four heads remain #4906 711e324126e937bc2029f4962d6ad2add311fe21, #4989 65f7963af95f102999417a42de218649383b36ac, #4990 945c839a28e4e863392da35b1da9164008fb6311, #4991 db50bc23db43e59ec5609ad9ff13f820afaf15d8.

93781e058 retains design-changing discovery in the ticket body. This invalidates native planning receipts only when the job fingerprint binds ticket context semantically. c91547387 additionally refuses legacy reentry after retained discovery until conversion and fresh review. The schema-based native template lookup from c91547387/d74a2dc15 is already present in the candidate.

The existing semantic mechanism is available from #5051, codex/4200-semantic-context-pr3 at 11867f743542616868fcb7ae2a59bae741c9c711. Its native planning dependency resolver and identity modules do not require fallback routing or scope-review policy. Its packet adapter also includes independent Product authoring/copy handling from parent #5041 (2f8a39d9d8047b1c5c92f5ca61995ec8a48b4620); importing that entire adapter is unnecessary for native Implementation/Execution discovery repair.

The bounded backport keeps the existing modules unchanged: packet-error, planning-context-error, planning-context-identity, planning-role-context, planning-ticket-owner, planning-accepted-boundary and ticket-metadata. It wires native Implementation/Execution packet context and review identity through the current packet/job owners, adds their existing contract fields, schema data-guide constant and utility exports, and applies the retained notice and legacy refusal. The closure also includes e9850c228’s bundler setting for the imported Markdown parser; omitting it breaks a packaged CLI on an older dependency base. Authentication, generated-target exclusion, executable-RED identity, normalized Execution identity and approval ledger ownership stay with the existing owners. No new timestamp, ordering ledger or authorization rule is introduced. Product quality-review routing, fallback selection, scope review and model qualification are outside this repair.

## Comparison

Counts use `git diff` against candidate 44fc50c47, restricting canonical production to packages/cli/src and packages/cli/templates; source/test counts additionally include packages/cli/tests, steps and features. Generated bundles and historical project records are excluded consistently.

- Expand through #5051: 45 canonical production files; 118 source/test files, 10,624 insertions and 830 deletions. This still lacks both discovery-repair changes and would require a backport of them. It imports Product authoring/copy admission that the native repair does not need.
- Expand through owning #5139 (6bde6bfd0c7526dd23a002e19798826e5afeb841), including #5041, #5051 and #5086 (854a376861bc034d65cc81ddfa6a85d0ae55821e): 71 canonical production files; 217 source/test files, 28,546 insertions and 2,037 deletions. This also imports fallback/capability/qualification and scope work with unresolved proof. The separate recovery branch does not certify it.
- Bounded backport: 16 production files, retaining the complete existing native context identity modules and adapting only their packet/job wiring. Focused native currency, approval recovery, ledger/concurrency and packet boundary tests apply. No paid reviewer qualification matrix is changed or requires rerunning.

Choose the bounded backport: its required code is smaller than either expansion, and its verification can focus on the already accepted native planning/approval boundaries. The strongest expansion argument is avoiding extraction errors. Mitigation: retain shared modules byte-for-byte, review the adapter diff independently, and verify real CLI receipts and recovery rather than relying on unit counts.

Premortem: a packet or job integration omission could leave an old receipt current or damage generated-target/RED behavior. Include those neighboring tests and require current independent review before readiness.

## Root cause and falsification

The lower candidate changes only phase on design discovery. That leaves old plan bytes and the authenticated Implementation receipt unchanged, so the next approval admits it. The human gate cannot supply missing reviewer freshness: a prior decision for identical bytes is still current. This rules out a problem limited to interactive prompting or a forged ledger stamp. A notice without ticket-context identity fixes legacy refusal but is incomplete for native tickets. A new ledger-order guard would duplicate authorization policy and is rejected.

The original real-CLI repeated-approval assertion is retained. The first post-backport run passes its refusal but fails later legacy recovery (36 passed, 1 failed), correctly exposing the missing explicit conversion fixture rather than concealing it. The extended matrix will distinguish legacy conversion from native recovery and test both human settings, stale discovery after edited bytes, and unrelated reviews after the repair has been recorded.

Next: verify the bounded backport and update landing-proposal.md only from current evidence. No PR is mergeable or promoted by this decision alone.

## Adapter boundaries and independent challenge

The bounded adapter preserves generic and legacy packet behavior: unlike the whole higher adapter, it does not add mandatory inventories to root-level generic plans, Product review routing or scenario review routing. It activates role identity only for owned native Implementation/Execution targets. All seven shared modules remain byte-identical to #5051. This is a compatibility boundary in packet construction, not a second admission authority.

Claude review acea3321-8fd7-4bb8-a2ef-1ed3c37426f8 approved the bounded mechanism with warnings; its receipt became stale after adapter/test corrections and is historical only. Its unsupported-type warning exposed a real consistency gap in the existing higher fix: the legacy refusal tested only the v1 marker, while role identity requires the existing feature/epic ownership predicate. The candidate now calls that same ownership predicate for refusal after a recorded repair. A task carrying a v1 marker must not escape both mechanisms; the CLI matrix includes this case. No ordinary legacy ticket acquires a new conversion requirement.

The review also identified captured-workspace cleanup on malformed disposition context; the adapter now evaluates that context inside the existing cleanup boundary. The higher fix's broad heading match remains unchanged. Native receipts recorded before this backport require fresh review because they do not carry the new planning identity; this is a compatibility cost, not evidence those old reviews failed.

Unrelated-review coverage here means a repair already recorded on the ticket cannot be cleared by another ticket's review. The inherited latest-job lookup before a discovery is applied can still hide a not-yet-recorded discovery; in implement the command fails its phase transition and can leave an informational not-required line. It does not advance or create coding authority. This warning is retained, not represented as solved by the post-recording test. The landing proposal must name that boundary.

## Native delivery closure and measured proof

The final closure is 16 production files. The packaging dependency from e9850c228 (`noExternal: ['smol-toml', 'prettier/plugins/markdown']`) is required: the parser is a development dependency, so an npm CLI must bundle it rather than assuming the target project installed it. The existing packaged-startup test exposed this omission in the first extraction; it passes after the faithful setting is restored.

The reviewer’s native data-guide warning also reproduced. Native-only installs omit project framework guides, so data-applicable owned plans could not be reviewed even with an intact package. The packet adapter now resolves only the schema-registered data guide from the trusted template directory when its project copy is absent. It records each captured file’s source root and uses the existing containment/read/snapshot/freshness checks. Project copies take precedence; blank copies and escaping symlinks refuse. This supplies an input to the existing identity, not a new authorization policy. Four packet tests and a copied native-plugin public CLI replay prove the boundary. The replay resolves pinned Bun before restricting PATH to its trusted fake reviewer; the bundle is Bun-targeted and is not claimed to run under plain Node.

On final production bytes, 11 targeted files pass 177 tests, including packaging and the human approval matrix. The subsequent two-file run passes all 10 tests, including the additional copied-plugin guide replay (the runs overlap; do not add their totals). The four accepted root features pass 145 scenarios / 6,769 steps / both hooks. Root lint/typecheck pass and all five generated surfaces were regenerated and verified.

The first complete local repository run remains failed: 16 failed files, 25 failed tests, 11,043 passed and 18 skipped, before the data-guide and bundler correction. Raw compressed output and log hashes are in evidence/resumed-verification/. A standalone instrumented probe establishes cold temporary-script execution timeouts; it does not establish that all 25 failures are environmental. The packaged-startup failure was a real omitted backport prerequisite and was fixed. Current candidate CI is still required before a merge decision.
