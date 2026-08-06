# Spec: Migrate legacy Claude projects automatically

## Intent

Finish the native Claude plugin migration automatically once the exact plugin
has actually handled a prompt in the repository. Remove framework-owned legacy
delivery without asking the user to understand cleanup mechanics, while keeping
every byte Safeword cannot prove it owns.

## Intake Brief

- **Requested by:** The Safeword maintainer after inspecting live Arcade and www worktrees following the 0.73 release.
- **Cost of inaction:** Repositories retain duplicate Claude hooks and dozens of framework files, clean historical installations are mislabeled as user conflicts, and each maintainer must manually diagnose a migration that was meant to be invisible.
- **Reversibility:** One-way at each deletion, so every target requires exact historical ownership proof plus a durable, idempotent transaction before automatic contraction.

## References

- GitHub issue #1785 and completed ticket `0S31PG`
- Ticket `H87DZR` for project/user Claude plugin scope
- Live 0.68, 0.69, and 0.72 evidence from `www` and `arcade-monorepo`
- Claude Code plugin scope, marketplace, settings, and hooks documentation revalidated 2026-08-05

## Personas

- Non-Technical Builder (NTB)
- Technical Builder (TBU)
- Safeword Maintainer (SWM)

## Surfaces

Affected:

- Claude Code
- Safeword CLI

Unaffected:

- Cursor — its project runtime remains materialized.
- OpenAI Codex — its automatic bootstrap and migration remain unchanged.
- Claude Code Cloud — trust and local plugin-cache enrollment are not claimed.

## Vocabulary

- **Accepted historical asset:** Bytes at a Safeword-managed Claude path whose path-specific digest appears in the immutable released-asset catalogue.
- **Unknown content:** A file or settings entry at a legacy path that has no exact accepted structural fingerprint.
- **Contraction:** Removing accepted legacy Claude delivery and writing the durable plugin-mode marker.
- **Effective installation:** The one exact plugin identity Claude applies to the repository after scope precedence is resolved.

## Jobs To Be Done

### automatic-claude-migration.NTB1 — Leave migration ceremony to Safeword

**Persona:** Non-Technical Builder (NTB)

> When the native Claude plugin has taken over my repository, I want Safeword
> to remove its obsolete framework files automatically and explain anything it
> cannot remove, so I can keep working without learning a migration procedure.

#### automatic-claude-migration.NTB1.R1 — A proven plugin automatically contracts every exact legacy asset while preserving and reporting unknown content without blocking work

#### automatic-claude-migration.NTB1.R2 — Missing or failed plugin proof leaves legacy delivery unchanged and names one understandable next action

### automatic-claude-migration.TBU1 — Keep migration safe under real repository concurrency

**Persona:** Technical Builder (TBU)

> When multiple sessions or developers use the same repository, I want
> migration to converge transactionally despite crashes and races, so no agent
> overwrites concurrent work or strands the repository in recovery.

#### automatic-claude-migration.TBU1.R1 — Competing migrations have one durable winner and recovery accepts recorded before or after images while refusing a third image

### automatic-claude-migration.SWM1 — Enroll teams without reviving legacy delivery

**Persona:** Safeword Maintainer (SWM)

> When Safeword supports project and user Claude installations, I want project
> declarations to survive migration and historical ownership to be release
> checked, so teammates are enrolled through Claude's supported flow without
> duplicate execution or recurring repository churn.

#### automatic-claude-migration.SWM1.R1 — Project enrollment survives contraction, identical scope overlap resolves to one effective plugin, and incompatible overlap remains visible

#### automatic-claude-migration.SWM1.R2 — Every supported historical fingerprint and generated migration entrypoint is release-checked against real artifacts

## Rave Moment

- **Moment:** The first prompt after the plugin loads quietly removes dozens of old Safeword files; the user's actual edits remain, accompanied by one sentence explaining the two files Safeword left alone.
- **Beats:** A manual cleanup command, a giant upgrade diff, or a frightening choice between duplicate hooks and deleting custom work.
- **They'd say:** “It cleaned up the old integration by itself and knew exactly which two files were mine.”

## Open Questions

None.
