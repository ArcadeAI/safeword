# R16 ledger scenario label: historical executable RED

The fresh review must use the exact ledger scenario label, including Scenario:.
The first approved RED a978f125-60a5-470c-878b-f3c8dd4a3d2d used the bare title,
which the GREEN transition gate does not match. The working implementation is
already green. Do not pretend it is currently missing or mutate it to fail.

Run the original missing-bindings proof from the immutable dbe89f82c Git archive
under .safeword/state/4200-r16-red-baseline. That is the recorded RED baseline.
The accepted root feature in that archive is byte-identical to the current
review target (cmp passed). The archive's original step modules have no R16
coverage bindings. Shared installed dependencies and unchanged built CLI are
symlinked from this checkout for module loading, not for new step definitions.
No provider runs in this wiring RED. Expected failure is Undefined scenarios:,
exactly rows648 and649. An import, setup or timeout failure cannot count.

This fresh independent review corrects the label of original executable RED
proof; it is not a new regression or claim that fcc3afbf8 fails. Current GREEN
has already passed both semantic cases and the strengthened negative recheck.
The new label must be Scenario: Scenario review proves every applicable persona
outcome, matching the ledger parser's exact scenario identity.

The first corrected-label attempt was rejected at 7b6436fb-9e5a-4600-9b42-
06ca60372396 because the archived launcher tried an untrusted mise.toml. That
was infrastructure failure, not RED. A subsequent local preflight exposed the
archived retro-relay dist import; its unchanged installed build is now shared.
The proof invokes this checkout's trusted pinned launcher by absolute path while
retaining the archived cwd and archived step modules. No mise trust or shell
profile is changed. Local preflight reaches Cucumber, reports exactly rows648
and649 as undefined, and matches the expected literal; JSON is
/tmp/4200-r16-ledger-red-preflight.json.

The command also adds an exact anchored scenario-name filter. This rules out
other undefined scenarios. Keep the bare feature argument: cucumber.mjs only
omits default path globs when an argv item ends in .feature; a :648:649 item
alone does not. With the bare path, CLI line filters and the exact name filter,
JSON confirms just the intended two examples. The gate explicitly requested
Scenario: as the label; the ledger uses ### Scenario: for this outline.
