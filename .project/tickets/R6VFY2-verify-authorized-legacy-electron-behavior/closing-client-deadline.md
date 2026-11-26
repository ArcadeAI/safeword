# Combined closing-check deadline

## Root cause

The shared completion helper gives the 17-row closing reader the same ten-second
local process deadline as one row. The current installed CLI at SHA-256
48de020dce911c7b0a39be666649eba7621a27ef5c20e5ab24ea1d20079506ad
returns authentic approval for the final Soulless HEAD
f7a1d907c08787908772c5d228c20fb586a5baf8, but a cold query took 48,133 ms.
The ten-second client killed it before its JSON response arrived.

Wrong runtime was ruled out by the exact trusted cache path and matching bundle
digest. Stale records were ruled out by the same query, cwd and environment
returning healthy approval when allowed 120 seconds. An isolated copy changing
only the closing deadline let the actual shared completion check pass in 26,021
ms. These diagnostics are retained in /tmp/issue163-shared-gate-*.json and
/tmp/issue163-shared-hook-budget-prototype.json; the prototype is not installed
delivery evidence.

The fix gives only combined closing checks a bounded 120-second process budget.
Individual-row deadlines and response identity checks remain unchanged. The
read-only delivery driver uses the same closing budget; its enclosing live
rollback preflight has 240 seconds for all row reads plus the closing read.
No policy, runner, signed record, original observation or Soulless tracked input
changes. The earlier bundle digest remains the truthful producer provenance.

The new test uses a real external process that emits a valid closing response
after eleven seconds, beyond the previous ten-second boundary. This fixture
uses only temporary empty directories and synthetic responses. It cannot create
or authorize real review records. A companion control will confirm individual
row checks still refuse a response after their unchanged deadline.

## Full verification snapshot

Full verification at clean source 5c37f814f539f8d9b7b2023a0fbd8ea1ac736745
exited zero before this deadline correction: CLI 12,263 passed / 14 skipped,
relay 198 passed / 1 skipped, collector 153 passed, acceptance 599 scenarios /
11,786 steps, and proof inventory 53 passed. Go checks, builds, types and
dependency scans passed. Go reports zero called vulnerabilities, with one
imported and fourteen required-module advisories outside called code. Resolved
duplicate delegations were run once per unique suite, with one CLI worker.
Log: /tmp/issue163-monitor-full-verification.log. Later deadline-only changes
require their own focused checks; this snapshot is not claimed for a later HEAD.
