# Development runtime mismatch — 2026-10-21

## Immediate shared-profile repair — 18:07 UTC

The user explicitly requested an immediate hotfix because other worktrees were
blocked. Through supported Codex marketplace commands, the shared `safeword`
registration was restored to official `ArcadeAI/safeword` pinned to current main
`9f6ac6fcee254b684abf7a5bb014538a6aa6470d`, then `safeword@safeword` 1.2.0 was
installed. This deliberately supersedes the freeze below for this repair only.
The official `stable` branch was inspected and carries 1.1.0; no downgrade was
performed. The official current-main bundle was first installed and checked in
the temporary isolated Codex home.

The shared cached runtime now has SHA-256
`c535706afa985ac3e76fa83b0d033baf9d42ed17eb08a245de1085d9cdc5e6a1`, matching
the independently staged official bundle. `codex plugin list` reports enabled
1.2.0 from the official Git marketplace; the installed runtime's `codex status`
reports healthy/protected. A full app restart remains required by the setup
skill to refresh loaded instructions.

Direct byte comparisons of `DISCOVERY.md`, `PLAN_IMPLEMENTATION.md`, and
`PLAN_EXECUTION.md` prove all three installed planning files match the Python
setup worktree (`3aa0`) and #5504 (`4c5e`). All three differ in the older OpenCode
worktree (`ffcf`). This repair therefore addresses the shared-runtime mismatch
for the first two; it does not prove every worktree is unblocked. OpenCode needs
a separate baseline-alignment or isolated-activation step. No other worktree
source, ledger, or receipt was changed, and no other chat was messaged.

This #5139 development branch again has a candidate/runtime mismatch under the
shared official plugin. Do not reinstall its candidate into the shared profile.
Its direct headless conformance collection remains active and independent of
that profile. No final matrix, final verification, or Draft PR is claimed.

At the user's explicit request, issue #5486's body was updated with the
investigation, native CLI probe, immediate repair, proof limits, integration
constraints, and concurrent-worktree acceptance tests. The original body was
preserved and the updated body was read back and compared with the submitted
text. The user asked to finish #5139 afterward, not to implement #5486 here.
The required full desktop restart has not yet been confirmed. A separate
`CODEX_HOME` can isolate CLI commands, but does not itself select a different
runtime for the already-loaded desktop plugin hooks; no complete desktop
isolation workaround is claimed or activated.

## Shared-profile collision and isolation investigation

After the authorized local install, another chat reported incompatible installed
planning-contract hashes in the OpenCode, #5504, and Python setup worktrees.
Further changes to the shared marketplace registration and cached plugin are
frozen. The user requested a `figure-it-out` investigation because concurrent
worktrees are the normal operating condition. This does not expand #5139 into
runtime-isolation implementation or authorize changes to those worktrees.
The existing [issue #5486](https://github.com/ArcadeAI/safeword/issues/5486),
"Codex candidate verifier activation is profile-wide", already tracks this gap;
no duplicate issue was created or external comment sent. Its acceptance proof
should run two worktrees with different bundles concurrently and demonstrate
that upgrading or retiring either leaves the other's runtime, skills, hooks,
and receipt verification unchanged.

Codex CLI 0.163.0 was tested with two inert plugins in a temporary `CODEX_HOME`
outside the shared profile. Both used plugin name `isolation-proof`, version
`0.0.1`, and distinct marketplace names `isolation-proof-a` and
`isolation-proof-b`. They installed into separate cache directories. Refreshing
A changed its marker to `a-refreshed` while B retained `b-initial`. Trusted
project configurations selected A/disabled B and selected B/disabled A as
expected in `codex plugin list --json`. This proves native CLI cache and
selection isolation for those fixtures, not desktop hook/skill activation or
Safeword runtime compatibility.

Code inspection also found the native integration work this requires:
`packages/cli/src/codex-plugin/catalogue.ts` embeds the fixed marketplace/plugin
cache coordinates in generated skill commands because skill shells do not
receive `PLUGIN_ROOT`. Plugin hook commands already use `PLUGIN_ROOT`, while
`templates/hooks/lib/safeword-cli.ts` has a fixed-coordinate trusted-cache
fallback. Installer observations also select `safeword@safeword`. A development
bundle identity must flow consistently through those paths, with an explicit
trusted installation binding; merely renaming a marketplace is incomplete.

The recommendation is immutable development bundles with distinct marketplace
identities bound to their bundle digests, selected per worktree through native
project configuration. Preserve the trusted-runtime boundary: arbitrary mutable
project code must not become receipt-verification authority. Separate
`CODEX_HOME` directories are a useful CLI test boundary; per-chat desktop home
selection is unverified. A new shared runtime dispatcher adds routing and trust
machinery before native isolation has been exhausted. The main failure risk is
reusing a development identity after its bundle bytes change; immutable sources
and digest verification must prevent that.

Sources checked on 2026-10-21:

- [Codex plugin packaging and project enablement](https://developers.openai.com/plugins/build/plugins)
  documents shared marketplace/plugin/version cache coordinates and warns that
  disabled plugins can still have files refreshed.
- [Codex configuration](https://learn.chatgpt.com/docs/config-file/config-advanced)
  distinguishes project overrides, CLI profile layers, and `CODEX_HOME` state.
- [Harness-aware plugin evaluation](https://developers.openai.com/cookbook/examples/partners/harness_aware_plugin_evals/harness_aware_plugin_evals)
  demonstrates a separate Codex home for evaluation.
- [Nix immutable store objects](https://releases.nixos.org/nix/nix-2.34.8/manual/store/store-object.html)
  supplies the immutability model, not a proposed Nix dependency.

The exact-Claude conformance collection remains independent of the shared
profile. Its results are pending; no additional passing cases are inferred from
an active process. No isolation implementation, shared-profile repair, merge,
or Ready promotion was performed during this investigation.

## Local plugin installed; restart pending

Update at 17:30 UTC: the user restarted Codex. The local plugin reports healthy,
the existing reduced Implementation receipt was revalidated and stamped, and
the normal transition to `plan-execution` succeeded. The required latest-package
bootstrap retry still failed its 1.1.0/1.2.0 version check; local 1.2.0 protection
remains active. A direct baseline inspection then disproved the plan's narrower
Execution context premise: main already directly requires dimensions,
architecture records and triggered data guidance. The plan wording was corrected;
the pending scenario-row restoration and dependent re-reviews remain necessary.
Returning to scenario review was refused by the phase-exit review gate. The
remaining 62 exact-Claude conformance cases are therefore being collected to
restore a qualified Execution route, reusing the completed first case. No full
matrix or fresh Execution admission is yet claimed.

At 17:22 UTC the user authorized the local development plugin switch. The
supported marketplace commands replaced only `safeword`'s official registration
with `/Users/alex/.codex/worktrees/dba0/safeword`, then installed
`safeword@safeword` version 1.2.0. The plugin is enabled and its cached runtime
matches the checkout bundle byte for byte (SHA-256
`35e432d6f8ee1a0d3c061ecd5730987a41ee72e12540ae1990945909bab82765`).
All five generated surfaces passed before installation. No guard or receipt
was edited. The setup skill requires a full Codex restart before resuming.
Keep this worktree available while it is the profile's marketplace source;
return the profile to the official marketplace after development is complete.

After restart: run `codex status`, revalidate the existing Implementation Plan
receipt, record only its actual reduced independence if still admissible, and
resume the unfinished test/refactor/qualification work. Do not repeat completed
capability collections or the unchanged completed live conformance case.

## Earlier blocker and preserved diagnostics

The LOC deadlock was resolved through normal checkpoint `5477ef85f`; no guard
was disabled. The child parent digest was refreshed with the supported command,
and the current-parent scenario review approved as cross-agent
`c3dc89dc-306c-446d-934e-04568a0f1bff`. Its real stamp allowed the normal transition
to `plan-implementation`. Historical ledger entries remain untouched.

The corrected Implementation Plan is approved by current-source CLI review
`ae716942-e017-470c-bcf6-97b78e1f5e71`, Claude `claude-opus-5`, with **reduced**
independence because trusted exact author identity is unavailable for this Codex
host. Its status remains approved under the current-source CLI. No stamp was
written for this result:

- The installed 1.2.0 runtime's stamp command rejects `reduced`, allowing only
  `cross-agent`, `degraded`, and `none`.
- The current project helper accepts the vocabulary but refuses the receipt as
  stale through the trusted installed runtime. That runtime's status command
  also reports stale for the same approved current-source result.
- Supported `codex migrate --json` reports healthy, version 1.2.0, changed false.
  It does not align the installed runtime with these branch-built contracts.
- The Safeword marketplace is the official Git source, not this checkout.
  Changing the profile's trust source requires an explicit user choice and
  activation/restart; no cache bytes or receipt identity were patched.

Execution review preflight returned `REVIEW_ROUTES_EXHAUSTED`, zero evaluated
routes, independence none: current conformance evidence cannot admit the changed
contract. The required fresh-context supplemental review approved with one
nonblocking 44-versus-54 ledger-count warning, corrected to the actual 54. That
degraded feedback creates no machine stamp. One subsequent live conformance
case passed; no full matrix or admitted route is claimed.

The exact pending packet source diff is preserved in
`evidence/5139-current-main/pending-packet-integration.patch` as well as the
working tree. It still needs the lint-required helper extraction. Independent
test-review fixes, final generation, full verification, final review, push and
Draft PR remain unfinished. No merge or Ready promotion occurred.

Recovery proposal: explicitly select this checkout's generated Safeword plugin
as a local development marketplace source through the supported Codex plugin
commands, then fully restart Codex and verify the active runtime. This changes
the profile's plugin source and can affect other sessions; do not do it under
the earlier LOC-only exception. The setup skill requires the full restart.
After alignment, validate the existing receipt rather than relabeling its
independence, finish only changed-input qualification, and resume the bounded
test/refactor work. No #5857 recovery implementation is proposed.
