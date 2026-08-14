# Test Definitions: Resume interrupted closeout after a Codex upgrade

Feature sources: `features/resume-closeout-after-upgrade.feature` and `features/resume-closeout-after-upgrade-rejections.feature`

## Rule: resume-closeout-after-upgrade.NTB1.R1 — Blocked closeout records one bounded handoff and the first matching protected task receives its continuation

### Scenario: A blocked old task records the one observed pending pull request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Valid pull-request integer boundaries are persisted [1]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Valid pull-request integer boundaries are persisted [9007199254740991]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A normally protected closeout does not create a handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A never-protected Codex task cannot create a restart handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A formerly protected task without the current marker cannot create a handoff [is superseded by another task in the profile activation marker]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A formerly protected task without the current marker cannot create a handoff [has no profile activation marker]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An ambiguous closeout target does not create a handoff [zero]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An ambiguous closeout target does not create a handoff [two]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hostile observed identities are not persisted [a flag-shaped pull request value]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hostile observed identities are not persisted [a negative pull request value]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hostile observed identities are not persisted [a non-integer pull request value]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hostile observed identities are not persisted [a non-hexadecimal observed head]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hostile observed identities are not persisted [an uppercase hexadecimal observed head]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hostile observed identities are not persisted [pull request zero]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hostile observed identities are not persisted [pull request 9007199254740992, one above the maximum safe integer]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hostile observed identities are not persisted [a 39-character hexadecimal observed head]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Hostile observed identities are not persisted [a 41-character hexadecimal observed head]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A traversal-shaped repository identity cannot escape the handoff store

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Concurrent blocked closeouts create only one handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A second pending handoff does not overwrite the first

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Re-recording the same pending pull request is idempotent

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A changed head does not rewrite a saved pull request

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An ambiguous existing store is not rewritten

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One valid and one unusable matching handoff block blind replacement [expired]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One valid and one unusable matching handoff block blind replacement [invalid]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A valid match and a store-key identity disagreement remain ambiguous

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Authorized creation replaces multiple unusable matching handoffs [two expired handoffs]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Authorized creation replaces multiple unusable matching handoffs [one expired and one invalid handoff]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Interrupted multi-record replacement preserves the complete old generation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Foreign handoffs do not block writing for the current repository

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unrelated malformed store entry does not block authorized creation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One invalid existing handoff is replaced explicitly [a malformed schema]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One invalid existing handoff is replaced explicitly [a store key whose decoded repository identity disagrees]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One invalid existing handoff is replaced explicitly [missing profile provenance]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One invalid existing handoff is replaced explicitly [foreign profile provenance]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One invalid existing handoff is replaced explicitly [an impossible clock]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One invalid existing handoff is replaced explicitly [an excessive lifetime]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An expired handoff can be replaced

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An expired claimed handoff can be replaced

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Authorized creation clears an unbound repository claim [an orphan claim without a handoff]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Authorized creation clears an unbound repository claim [a claim naming a different absent handoff]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A handoff at its expiry boundary can be replaced [no claim]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A handoff at its expiry boundary can be replaced [a claim record]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A handoff claimed by a current task is not overwritten

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A blocked former claim owner cannot rewrite its handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A current claim owner records the same pending closeout idempotently

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A current claim owner cannot overwrite its handoff with a different identity

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A fresh handoff with a stale claim is preserved for restart discovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Closeout without one canonical repository does not create a handoff [zero]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Closeout without one canonical repository does not create a handoff [two]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The matching restarted task receives one concrete continuation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The handoff written by blocked closeout is consumed after restart

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Installed Codex SessionStart wiring delivers the pending closeout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Installed Codex SessionStart wiring rejects an unusable handoff [expired handoff]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Installed Codex SessionStart wiring rejects an unusable handoff [handoff carrying foreign profile provenance]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The installed continuation invokes the shipped guarded closeout surface

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Shipped guarded cleanup removes the real profile receipt

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Shipped blocked-closeout wiring records the pending closeout

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A handoff with unknown fields remains forward compatible

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A matching repository handoff from another checkout is not delivered

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A handoff written before a plugin-version change is consumed afterward

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: The installed profile upgrade preserves a pending handoff end to end

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Equivalent repository remote spellings match one handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Case-only repository spelling differences match one handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Discovery selects one matching handoff among foreign handoffs

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Discovery ignores an unrelated malformed store entry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A handoff-store failure still tells the user how to recover

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unreadable store blocks handoff creation without writing blind

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Interrupted first handoff creation exposes no partial record

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Interrupted handoff replacement preserves the complete old state [invalid]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Interrupted handoff replacement preserves the complete old state [expired]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Interrupted handoff replacement preserves the complete old state [expired with a claim]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Unaffected hosts do not create Codex restart handoffs [Claude Code]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Unaffected hosts do not create Codex restart handoffs [Cursor]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: resume-closeout-after-upgrade.NTB1.R2 — Expired, malformed, or foreign handoffs never surface as current work

### Scenario: An expired handoff is not presented as current work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A malformed handoff is not presented as current work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A foreign handoff is not presented as current work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An unusable foreign handoff remains silent [expired]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An unusable foreign handoff remains silent [schema-invalid but repository-decodable]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An unusable foreign handoff remains silent [foreign profile provenance]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A same-named repository under another owner is foreign

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A handoff expires at the exact lifetime boundary

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An expired claimed handoff is not presented as current work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A handoff with an excessive lifetime is not presented as current work

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An impossible handoff clock is not presented as current work [a write time more than five minutes in the future]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An impossible handoff clock is not presented as current work [an expiry at its write time]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: An impossible handoff clock is not presented as current work [an expiry before its write time]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Reader tolerance accepts bounded handoff clocks [a write time exactly five minutes in the future]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Reader tolerance accepts bounded handoff clocks [an expiry one hour after its write time]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unreadable handoff store does not break protected startup

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Discovery without one canonical repository cannot claim a handoff [zero]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Discovery without one canonical repository cannot claim a handoff [two]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Multiple matching handoffs are rejected as ambiguous

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One valid and one unusable matching handoff remain ambiguous [expired]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: One valid and one unusable matching handoff remain ambiguous [invalid]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Multiple unusable matching handoffs remain inert during discovery [two expired handoffs]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Multiple unusable matching handoffs remain inert during discovery [one expired and one invalid handoff]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An empty handoff store emits no continuation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: resume-closeout-after-upgrade.TBU1.R1 — A handoff is bound to one repository and claimed by at most one current Codex task

### Scenario: Concurrent protected starts elect one current claimant

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A different task cannot consume a live claim

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A repeated startup in the same current task does not duplicate delivery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A task reclaims a claim whose owner is no longer current

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A newer protected task revokes an overlapping former owner before re-delivery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A missing activation marker does not authorize reclaim

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A claim from another profile installation is not reclaimed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A superseded claim owner cannot resume after reclaim

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A malformed claim record cannot trigger reclaim [a truncated owner claim record]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A malformed claim record cannot trigger reclaim [a structurally valid claim record with an invalid owner identity]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A failed atomic claim does not emit a continuation

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Interrupted first claim creation exposes no partial owner

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Interrupted claim reclaim preserves the complete former owner

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An orphan claim record cannot trigger discovery

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A store key that disagrees with its handoff repository is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repository disagreement takes precedence over foreign provenance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Structural failure takes precedence over foreign provenance

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Foreign profile provenance takes precedence over expiry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Handoff rejection takes precedence over malformed claim state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Unsafe path takes precedence over malformed contents

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A claim bound to another handoff is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A handoff symlink escaping the store is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A claim-record symlink escaping the store is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A store path replaced by a symlink before mutation is rejected [handoff creation]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A store path replaced by a symlink before mutation is rejected [invalid-handoff replacement]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A store path replaced by a symlink before mutation is rejected [claim creation]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A store path replaced by a symlink before mutation is rejected [claim reclaim]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A store path replaced by a symlink before mutation is rejected [repository-store generation swap]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A store path replaced by a symlink before mutation is rejected [receipt removal]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A handoff without current-profile provenance is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A handoff from a different profile installation is rejected

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Reinstalling the Codex profile invalidates an old pending handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [a flag-shaped pull request value]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [a negative pull request value]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [a non-integer pull request value]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [a repository identity with path traversal]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [a non-hexadecimal observed head]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [an uppercase hexadecimal observed head]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [pull request zero]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [pull request 9007199254740992, one above the maximum safe integer]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [a 39-character hexadecimal observed head]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Injection-shaped handoff identities are rejected [a 41-character hexadecimal observed head]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Valid pull-request integer boundaries are delivered [1]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Valid pull-request integer boundaries are delivered [9007199254740991]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unprotected Codex task cannot discover or claim a handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [a force-push]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [local branch deletion]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [remote ref deletion]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [a hard reset]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [tag mutation]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [remote mutation]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [a worktree command]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [direct filesystem removal of a cleanup target]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [a merge mutation]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [an approval mutation]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: The command observer covers destructive escape routes [a pull-request mutation]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Unaffected agent hosts cannot discover or claim a Codex handoff [Claude Code]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Unaffected agent hosts cannot discover or claim a Codex handoff [Cursor]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

## Rule: resume-closeout-after-upgrade.TBU1.R2 — Resumption re-observes pull-request and repository state and never carries merge or cleanup authority

### Scenario Outline: Changed closeout targets remain untouched after restart [a different pull-request head | head changed since handoff]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Changed closeout targets remain untouched after restart [a pull request that is not merged | pull request is not merged]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Changed closeout targets remain untouched after restart [a changed canonical repository remote | repository identity changed]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Changed closeout targets remain untouched after restart [a missing branch target | branch target is missing]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Changed closeout targets remain untouched after restart [a recreated branch target | branch target identity changed]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Changed closeout targets remain untouched after restart [a missing worktree target | worktree target is missing]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Changed closeout targets remain untouched after restart [a recreated worktree target | worktree target identity changed]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Changed closeout targets remain untouched after restart [a pull request that no longer resolves | pull request is unavailable]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Pull-request identity drift takes precedence over a missing cleanup target

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Pull-request head drift takes precedence over an unmerged state

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unavailable pull request takes precedence over recorded head mismatch

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Repository drift takes precedence over pull-request head drift

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: An unmerged pull request takes precedence over recreated cleanup targets

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Recreated target identity takes precedence over a missing target

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Successful guarded cleanup clears the handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Receipt removal failure is reported after cleanup [the claim record]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Receipt removal failure is reported after cleanup [the handoff record]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A later task safely resolves a receipt left after cleanup [the branch target]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: A later task safely resolves a receipt left after cleanup [the worktree target]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A later task clears a receipt after cleanup already completed

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Failed guarded cleanup preserves the handoff until expiry

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: A user dismisses a permanently undeliverable handoff

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario: Expiry revokes an in-flight cleanup before destructive apply

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Restarted closeout cannot remove its current execution context [the current branch]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Restarted closeout cannot remove its current execution context [the current worktree]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Current execution context follows earlier safety observations and precedes target drift [an unmerged pull request]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR

### Scenario Outline: Current execution context follows earlier safety observations and precedes target drift [a recreated target identity]

- [ ] RED
- [ ] GREEN
- [ ] REFACTOR
