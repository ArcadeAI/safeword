# Native hook startup repair

Project `.env` injected `SAFEWORD_PLUGIN_CLI`; project `bunfig.toml` preload
executed before native hook policy. Four real startup regressions failed before
repair (`/tmp/pr5151-native-startup-red.log`), then 165 targeted tests passed
(`/tmp/pr5151-startup-targeted.log`).

Native commands now start Bun with `--no-env-file --cwd <plugin root>`.
Codex routes through host payload `cwd`; Claude retains its existing trusted
host/payload routing. Child Codex hooks run from packaged/snapshot directories
and receive the actual CLI identity. OpenCode retains explicit reentrant CLI
semantics. Nonplugin snapshot-before-stdin behavior remains intact.

Independent Claude review `ae8e6e0d-9d40-45e4-b0b8-a5c3109c22da` approved
with no errors. Follow-ups: missing native project identity now denies tool
use visibly; its regression failed before repair
(`/tmp/pr5151-startup-followup-red.log`). The startup fixture now also places a
forged dotenv inside the plugin directory. A real Bun flag-removal experiment
returned `clean` normally and `forged` without `--no-env-file`.

The outer Codex resolver gives trusted `CLAUDE_PROJECT_DIR` precedence;
the underlying Stop adapter resolves `input.cwd`, then `CLAUDE_PROJECT_DIR`.
SessionStart's shared resolver checks `CLAUDE_PROJECT_DIR` first. Child adapters
inherit that value; their cwd remains the packaged/snapshot hook directory.
Windows shell execution remains untested locally; the existing host placeholder
and quoted command convention is preserved.

Primary documentation checked 2026-10-05:
[Bun configuration](https://bun.sh/docs/runtime/bunfig) and
[Bun environment variables](https://bun.sh/docs/runtime/environment-variables).

First full run passed 10,427 tests and failed one schema check because temporary
review context was wrongly placed inside `.safeword/`. That file was removed.
Final targeted verification passed 166/166. Independent Claude review
`0d2f9487-591a-45f5-b61b-624975a7a45f` approved the follow-up with no errors.
Its conditional host-variable concern is answered by
`src/codex-plugin/project-directory.ts`: the resolver checks
`CLAUDE_PROJECT_DIR` before Git or cwd. The enrolled cwd fallback preserves
direct CLI compatibility; native hosts provide payload cwd. Updated native test
fixtures now send that real host field. The SessionStart fallback wording warning
is inherited and outside this startup repair; Windows execution is still a
disclosed limitation. Version synchronization and parity passed. Final full
verification passed 609 files / 10,429 tests, with 14 expected skips
(`/tmp/pr5151-startup-full-repaired.log`). The simulated activation fixture now
supplies the real host's common `cwd` field; independent Claude review
`01e3f761-dc88-44bb-8307-9cb481d53ced` approved that fixture update.
Frozen production/test review `49421546-ffe3-49f4-aa5a-81e6766cf860` approved.

Actual shipped manifests and real bundled runtimes also returned genuine broad
process-kill denials through their child policies against a disposable enrolled
project with hostile dotenv and Bun preload. Neither preload executed:
`/tmp/pr5151-native-composed.json` (Codex) and
`/tmp/pr5151-native-claude-composed.json` (Claude Bash quality command).
These are local runtime experiments, not native-host activation receipts.
Inherited fixture assertions/model/timezone warnings do not change this scoped
payload repair; the tests passed in this Mac's non-UTC local timezone.

Both tickets remain `implement`, ledger 3/49; historical evidence is unchanged.
Fresh pushed-head CI/advisory, real Codex cache/migration proof, post-merge CI,
stable publication and installation remain pending.

## Relative-path regression found by CI

At e1daa47ab, Node 24 CI exposed dropped cwd in the Codex-to-Claude bridge.
Relative edit paths resolved against the isolated child runtime directory.
Four existing acceptance scenarios and two helper tests failed before repair.
The bridge now preserves explicit host cwd and supplies the trusted project
directory when the payload omits it. Independent review
719cafb6-0f21-47dd-b0a0-1027613e5749 approved with no errors.
Frozen full verification passed 609 files / 10431 tests (14 expected skips).
Full acceptance passed 595/596; the remaining old manifest command assertion
was corrected to require both startup isolation flags.

Review 2bc74083-6f0f-4c56-b943-66d6a6e20740 reviewed the entire existing
acceptance step file and flagged its inherited map-row assertion as too weak.
The current edit changes only the native-command regex at the manifest step;
it strengthens that assertion and does not alter map-row behavior. That
inherited concern is outside the startup/routing repair and does not establish
a changed release behavior. Existing unit contracts check event bindings.
Do not expand this repair into unrelated step-file restructuring.

The first focused acceptance retry overlapped a release wrapper's dist rebuild
and failed on a transient missing chunk, not a policy assertion; serialize
subsequent dist consumers. Release found one dogfood mirror drift because the
normal installer intentionally preserves legacy Codex hook assets. The
supported parity fixer reconciled that mirror from the source template.
