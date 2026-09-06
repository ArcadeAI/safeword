# Work Log: Stop hollow acceptance proofs before implementation

## 2026-09-06

- Resumed from issue #2336 at intake on `origin/main` (`9c3408e1c`).
- Research domains: provenance integrity, subprocess isolation and bounded capture, wrong-reason
  RED semantics, freshness, shared-proof reuse, and advisory rollout UX.
- Compared source-only review, universal mutation, and trusted execution attestation plus
  independent judgment. Selected the last option because it separates observable execution from
  semantic judgment without imposing framework-specific mutation cost.
- Premortem: an incomplete proof target set could leave a changed helper outside the freshness
  fingerprint. Mitigation: make declared support files explicit and bind the canonical command,
  evidence class, and every proof target into the attestation and receipt.
- Reconciled with current code: reuse the integrity-protected durable review job and packet
  machinery; extend it with one host-neutral executable-RED contract rather than add a second
  review subsystem.
- Derived seven behavior dimensions, partitioned their material happy, failure, and boundary
  cases, and authored fourteen scenarios against the review-spec rubric. The cases assert public
  execution/review outcomes rather than implementation details.
- Supplemental scenario review found three real proof gaps: multiple distinct proofs, tampered
  attestation evidence, and unrelated actor-boundary assertion failures. Added all three; the
  reported Rule-count mismatch was a packet-summary typo (eight actual Rules, not nine).
- The revised fourteen-scenario set received a clean supplemental review after all configured
  independent routes were exhausted. Policy is `prefer`; no independent stamp is claimed.
- Planned four coupled components (CLI request, attestation collector, durable binding, workflow
  rubric/parity), below the five-component split trigger. Added a concise feature design because
  their trust-boundary interaction is non-obvious.
- Implemented `executable-red` as an extension of the durable review coordinator. The trusted
  worker executes structured argv without a shell, confines cwd to the project, hashes complete
  stdout/stderr while retaining bounded excerpts, records runtime/environment identity and exact
  termination, and binds the request and declared proof inputs into the sealed source fingerprint.
- Added a fixed failure-attribution rubric, public CLI flags, exact retry reconstruction, approved
  receipt reuse for identical proof identities, and canonical generated workflow guidance for
  Claude and Codex surfaces.
- Cross-scenario review found that a child ignoring `SIGTERM` could violate the execution bound.
  Added forced `SIGKILL` escalation after a short grace period and recorded the configured timeout
  in the attestation. Focused verification passed 145 tests with 2 skipped; typecheck, lint, and
  both generated-plugin freshness checks passed.
- Current Node child-process documentation exposed a second timeout gap: killing a test-runner
  parent can leave worker descendants alive. A dedicated RED proved the leak; the executor now
  creates a POSIX process group and kills the group, or uses Windows `taskkill /t`, before recording
  timeout completion.
