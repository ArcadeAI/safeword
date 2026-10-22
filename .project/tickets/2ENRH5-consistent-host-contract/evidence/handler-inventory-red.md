# Inventory handlers outside the five-event projection

Scenario: The inventory includes handlers beyond the five common events.
The owned repository fixture keeps the actual SETTINGS_HOOKS configuration,
including SessionEnd cleanup, SessionStart asyncRewake, background Stop work
and the bash pre-tool handler. All four actual handler source files remain
shipped and registered. Their classification is absent in the current code.

The primary When runs the real check-host-contract.ts --json subprocess.
The Then requires exit2 and an error UNCLASSIFIED_HOST_CONTRACT_HANDLER with
metadata.handler_path naming each actual source: session-cleanup-quality.ts,
session-auto-upgrade.ts, stop-retro.ts and pre-tool-git-bare-fix.sh under hooks/.
Current check output ignores all four and fails at that named finding assertion,
not fixture setup or imports: /tmp/safeword-handler-inventory-red.log.

After bindings exist, the same fixture appends a removal of just those four
classification entries from the canonical SHARED_BEHAVIOR_BINDINGS data array.
It leaves executable policy and event registrations intact. The module path is
the planned pure shared data module beside existing hook decision libraries,
not a host-private policy or new execution runtime. No such production module
or handler discovery has been added before this review. Full inventory and
missing-disposition/repair controls remain required; this first negative does
not by itself prove them. Binding records carry owner references/semantics,
never workflow bodies or a per-host author checklist.

The fixture helper now accepts a valid action_required/empty-errors envelope
with exit3, preserving the check's explicit partial state once old owners are
removed. Failed/unavailable exit3 envelopes remain rejected; this scenario
still requires actual exit2 and all four named error findings. This resolves
the prior quality review warning without treating incomplete coverage as healthy.
