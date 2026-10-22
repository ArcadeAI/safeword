# OpenCode V2 checkout enrollment component

Review scope: source ownership and host API compatibility, checkout/profile
isolation and conservative configuration updates, V1 preservation, and proof
fidelity. This is PR 2 task 3 of consistent-host-contract (2ENRH5), not customer
cutover or completion of the full feature. Public install defaults remain V1.

Executable RED receipt 4fde1301-e395-4438-9c2c-333e875ff1b0 (Claude/opus) approves
the actual CLI and TUI denied-action failure, exit 2 in 33.8 seconds, no signal,
timeout or truncation. Earlier receipts rejected a wrong mixed-host-upgrade
binding and a transient V1 TUI setup stall. Neither authorized implementation.
After investigating the stalled native configuration load and repeating the
author proof successfully, this final independent run passed all controls.

The new reader/writer bind enrollment to machine hostname, canonical profile,
canonical checkout, V2 major lane, immutable package path, epoch, and entry/runtime
hashes. The schema owns enrollment and project-lock paths. Only the existing
profile installation controller's explicit optional internal nativeV2 request
writes enrollment. It takes project then existing profile locks, preserves
different enrollment, and writes the user-profile plural plugins declaration
through jsonc-parser without changing singular plugin or other user values.
Identical repeats return healthy; native package declaration precedes enrollment
so an interruption before enrollment leaves a new package inert. This is not a
complete migration journal or recovery controller; those remain PR 4 obligations.

The SDK no longer accepts fixture-only projectDirectory activation. It requires
profile-local enrollment, an existing project marker, matching actual profile,
unchanged package identity and actual V2 host version. The existing config-root
resolver was moved unchanged to a small module and re-exported from profile.ts;
the SDK reuses it instead of importing the full profile writer or duplicating
profile resolution. Its setup only reads enrollment. Permission decisions still
come from the bundled shared dispatcher, never from this record or adapter.

The native coexistence proof passes both CLI and TUI:
/tmp/safeword-opencode-coexistence-green-1.log. It observes a real status-2 shared
dispatch tied to the enrolled native session and checkout, no dispatch in the
second checkout, V1 denying in both, V1 marker execution once per V1 run and never
in V2, unchanged user JSONC/configuration/V1 module/catalogue bytes, and unchanged
candidate bytes. Evidence roots are opencode-native-R9s8Ju and
opencode-native-ZX24kt under the owned temporary target directory.

This proves shared configuration using separate host databases. Actual V1
cannot read V2's new database schema; Safeword neither migrates nor modifies
those databases. Native catalogue/worker/write fixtures still need their Given
setup moved to this real enrollment writer before the full native-opencode group
can pass. No legacy activation escape hatch is retained for those fixtures.
No full scenario or admission receipt is marked complete by this component.

The source uses existing jsonc-parser and existing durable writes/profile locks;
no new dependency is added. The isolated SDK remains pinned 2.0.32, previously
audited with its complete dependency graph. Current source checked for the
local declaration and profile paths:
[V2 local plugin object form](https://github.com/anomalyco/opencode/blob/v2.0.32/services/www/src/docs/content/plugins.mdx),
[V2 config directory](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/web/src/content/docs/config.mdx).

Principles: one permission owner is preserved; real native observations prove
the boundary instead of a self-report; no per-agent policy is introduced. TBU's
preservation rule has component evidence; NTB's automatic host selection and
truthful public status remain unproved until PR 4. These tests do not establish
persona experience, all workflow registration, unsupported-host status, or
the full shared-owner inventory migration.
