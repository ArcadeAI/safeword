# Spec: Resume interrupted closeout after a Codex upgrade

<!-- safeword:inspiration-contract:v1 -->

## Intent

Make the required Codex restart a safe continuation boundary instead of a dead end for already-merged deliveries.

## Intake Brief

- **Requested by:** Safeword maintainer after dogfood upgrades stranded merged PR cleanup
- **Cost of inaction:** Users must remember PR numbers and reconstruct destructive cleanup context after the original task loses Safeword protection.
- **Reversibility:** Two-way door; the handoff is an expiring advisory receipt and carries no cleanup authority.

## References

- GitHub issue #2802
- Existing profile-scoped Codex activation marker and SessionStart proof
- Parent epic KMB053

## Personas

- Non-Technical Builder (NTB)
- Technical Builder (TBU)

## Surfaces

Affected:

- OpenAI Codex
- Closeout Cleanup Guard

Unaffected:

- Claude Code — does not require the Codex profile-plugin restart boundary
- Cursor — does not require the Codex profile-plugin restart boundary

## Vocabulary

- **Closeout handoff:** A repository-bound advisory receipt naming an observed pull request identity, expiring exactly 24 hours after its millisecond-precision write timestamp. It grants no cleanup or merge authority.
- **Structural decoding:** Parsing the expected JSON object and required field types; it does not make persisted values or timestamps trusted.
- **Identity validation:** Rejecting values that are not a positive safe integer no greater than 9,007,199,254,740,991 for the pull request, a canonical case-insensitive GitHub owner/repository identity, an exact 40-character lowercase hexadecimal commit head, or current-profile provenance after structural decoding.
- **Profile provenance:** Evidence that the handoff carries the current Codex profile installation identity. It detects records copied from another profile, but it is not a secret or a defense against another local writer that can read and copy the current profile identity. It is bound to the profile installation identity, not the Safeword plugin version, so an ordinary plugin upgrade preserves trust while a different profile does not.
- **Closeout claim:** An atomic owner record bound to a handoff and current profile task. It has no independent clock or lifetime; the handoff's fixed expiry governs both records.
- **Filesystem trust boundary:** Static symlinks and path escapes are rejected before advisory records are read or mutated. An active process running as the same user can race profile-owned files and is outside this advisory receipt's threat model; the existing closeout guard remains the authority boundary.
- **Persistence guarantee:** A completed operation exposes one complete old or new record and never a torn mixture. Surviving sudden power loss after success is not guaranteed beyond the host filesystem's rename semantics.

## Product Inspiration

### Product Unsuccessful Search

| Customer job | Framed question | Products attempted | Source categories | Queries attempted | Search date | Sources inspected | Why none transfers | Decision retained |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Resume guarded destructive work after a mandatory host restart | Which established product safely transfers a session-bound destructive workflow across a forced AI-agent restart? | Git worktree recovery; GitHub merge queues; Codex activation receipts | Repository source; installed CLI documentation | Existing restart and receipt patterns in this repository | 2026-08-13 | Codex activation marker and SessionStart proof; closeout guard receipts | Available patterns cover durable identity or resumable work, but not both without weakening session-bound retrospective evidence | Reuse the profile-scoped activation boundary while keeping closeout revalidation and authority in the existing guard |

## Jobs To Be Done

### resume-closeout-after-upgrade.NTB1 — Trust that a restart does not lose unfinished delivery work

**Persona:** Non-Technical Builder (NTB)

> When Safeword requires a new Codex task after an upgrade, I want the next protected task to discover unfinished closeout work, so I do not need to remember technical cleanup details.

#### resume-closeout-after-upgrade.NTB1.R1 — Blocked closeout records one bounded handoff and the first matching protected task receives its continuation

#### resume-closeout-after-upgrade.NTB1.R2 — Expired, malformed, or foreign handoffs never surface as current work

### resume-closeout-after-upgrade.TBU1 — Resume without transferring destructive authority

**Persona:** Technical Builder (TBU)

> When closeout crosses a required Codex restart, I want every persisted target revalidated under the new task, so stale state or a second consumer cannot delete the wrong branch or worktree.

#### resume-closeout-after-upgrade.TBU1.R1 — A handoff is bound to one repository and claimed by at most one current Codex task

#### resume-closeout-after-upgrade.TBU1.R2 — Resumption re-observes pull-request and repository state and never carries merge or cleanup authority

## Rave Moment

skip: table-stakes — safe recovery after a required restart is baseline reliability.

## Outcomes

- A blocked closeout can persist its observed PR identity before directing the user to restart.
- The next matching protected Codex task receives one concrete closeout command without choosing a transcript, branch, or worktree.
- Foreign, malformed, expired, concurrently claimed, or changed targets receive no destructive action and are reported.
- Successful guarded cleanup removes the handoff; failed attempts remain recoverable until expiry.
- Expired records may remain inert until the same repository next writes a handoff; background garbage collection is out of scope.

## Open Questions

None.
