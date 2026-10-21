# Native OpenCode V2 shared guard

## Review plan

Review the isolated guard carrier, not full host-contract completion. Check the
exact SDK import/export and blocking semantics; separation of transport from
policy; canonical project binding; complete dependency closure and current
advisories; and actual CLI/TUI allowed/denied side effects. Catalogue transforms,
worker guarantees and customer enrollment remain unimplemented obligations.

## Observed result

The unchanged proof approved by executable RED receipt
`9f78c492-5283-4389-a40b-d40c46f3bc04` now passes both selected V2 scenarios:
2 scenarios / 8 steps, 56.596 seconds. The BeforeAll hook also passes all four
production V1 CLI/TUI allowed/denied controls. V2 allowed setup contrasts pass.
The protected sentinel stays absent and the native tool result carries the
shared denial. Each candidate dispatch record binds its own runtime, canonical
project directory, native session, original shell command and status (0/2).

Command: `scripts/dev env SAFEWORD_OPENCODE_TEST_CONFIG=/tmp/safeword-2enrh5-targets.aOFAud/opencode-fixture.json bun packages/cli/scripts/run-host-contract-proof.ts --proof native-opencode --require-targets`.

- Candidate: `/tmp/safeword-2enrh5-targets.aOFAud/native-v2-green-3`.
- Log: `/tmp/safeword-opencode-v2-green-3.log`.
- Report: `/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-host-contract-proof-RX2bfi/cucumber.json`.
- V2 CLI denied actor: `/private/tmp/safeword-2enrh5-targets.aOFAud/opencode-native-YNgeTY`.
- V2 TUI denied actor: `/private/tmp/safeword-2enrh5-targets.aOFAud/opencode-native-7vCjT5`.

The group correctly exits 3 / `HOST_CONTRACT_PROOF_INCOMPLETE` after these
component successes. No whole scenario ledger, group admission or customer
activation credit is claimed. The initial attempted carrier used a nonexistent
root Tool export and was correctly unavailable; it earned no behavior credit.

## Implementation and authority

`packages/opencode-v2-plugin` pins the accepted target's Promise SDK 2.0.32;
registry latest is 2.1.2 on the environment date, 2026-10-21. This is an explicit
compatibility target, not a claim that 2.0.32 is latest. The native entry imports
Plugin from the public root and Tool.Error from its exported promise/tool
subpath. It normalizes event fields and invokes the existing OpenCode shared
dispatcher. No ticket predicate or policy decision is duplicated. SDK/Effect
remain external to the entry and absent from the shared runtime dependency
graph. There is no copied upstream source.

The generator produces a fresh standalone package from the portable catalogue,
bundled CLI, canonical templates and existing dispatcher. Schema owns bundle
paths. Setup requires the explicit candidate project option to match the real
native location and an existing enrollment marker. This is fixture enrollment;
profile-local enrollment and multi-project boundaries remain PR 4 obligations.

Sources:

- [Versioned Promise implementation and typed rejection conversion](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/plugin/src/promise/adapter.ts).
- [Versioned tool API](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/plugin/src/promise/tool.ts).
- [Native plugin API and loading](https://opencode.ai/v2/docs/build/plugins/).

## Checks and limitations

CLI and SDK workspace typechecks and targeted ESLint pass. The preceding full
CLI suite passed 727 files / 11,686 tests before this isolated production entry
was added; it is regression baseline, not a final verification of this change.

The retained full locked isolated SDK dependency audit (including Effect 4.0.1)
reports no advisories. Root workspace audit still reports seven advisories in
six pre-existing packages: braces, dompurify, fast-uri, http-cache-semantics,
katex and postcss-selector-parser. Do not describe the root audit as clean.
The standalone CLI audit bundle contains 500 inputs, none of those six package
names, and no external output imports. Final carrier module closure must also
be checked before adjudicating the carrier's exposure. SDK-only audit records
are in `opencode-v2-sdk-audit/` beside this evidence.

This proves structural guard mechanics for both native surfaces. It does not
prove the planned NTB/TBU experience or the remaining worker/catalogue/lifecycle
contracts.

## Review response

Cross-agent Claude/opus review `0244b8d4-6a32-4bd0-af0c-b9436a68d139`
accepted the real shell path but requested proof for anticipatory file-tool
mappings and unclassified mutating routes. Remove the unexercised write/edit
mappings from this component. Its claim is explicitly **shell sentinel guard
only**, not complete V2 mutation coverage. Other names retain the existing shared
owner's treatment; there is no invented deny-all policy. Full tool inventory and
normalization remain the accepted PR 3 obligation and block customer admission.

The captured real 2.0.32 model tool schema does use path for both write and edit
(and camelCase edit fields), as observed in
`/tmp/safeword-2enrh5-targets.aOFAud/opencode-v2-boundary-SJS6cN/request-1.json`;
the review's V1 field concern does not establish a V2 defect. Still, a schema
capture is insufficient to claim actual file-tool guard enforcement. Do not
keep speculative code just because its field spellings are plausible.

Warnings adjudicated: NODE_ENV development follows the existing bundle helper
and avoids bundling test-only behavior; this is the current generated-runtime
convention, not a new environment policy. The adapter preserves native workdir
input without adding a second shell/path policy; that pre-existing shared owner
limitation remains visible. A child timeout is optional resilience, not required
for the proved case; defer rather than overharden. Silent unenrolled setup is
intentional inert behavior; truthful customer status is still a PR 4 obligation.


After removing anticipatory mappings, candidate native-v2-green-4 passes the
same unchanged native component again: 2 scenarios / 8 steps, 61.703 seconds,
plus four V1 controls and V2 allowed setup contrasts. Report:
`/var/folders/v4/1hqkg6ln4nd71j_bjw3_xxb00000gn/T/safeword-host-contract-proof-L9aHj8/cucumber.json`.
Log: `/tmp/safeword-opencode-v2-green-4.log`. CLI and SDK typechecks, targeted
ESLint and Prettier checks pass. This is the current candidate for review.

Final closure inspection: Bun metafiles record 4 SDK-entry inputs, 113 shared
OpenCode dispatcher inputs, and 500 CLI inputs. None contains any of the six
packages named by the root audit. The entry retains external public SDK imports
(root and promise/tool); dispatcher and CLI include no Effect inputs. Native
Bun builtins remain external. Bun's metafile output.imports array omits those
external inputs, so do not use an empty output.imports array as proof that the
SDK is bundled. The generated JavaScript confirms the SDK imports remain
external; its separately locked complete SDK graph was audited above. The root
advisories do not occur in this carrier's bundled modules or SDK graph and are
adjudicated as unaffected pre-existing development/site dependencies for this
isolated change. No global dependency remediation is included.
