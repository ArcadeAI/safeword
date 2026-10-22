# OpenCode profile and checkout coexistence

This is a component proof for the accepted mixed-host ownership scenario and
PR 2 task 3, not completion of the full scenario or native admission.

The proof installs the actual current V1 profile and an isolated generated V2
candidate. A shared user JSONC config declares a singular V1 marker plugin and
plural V2 candidate/observer plugins. The candidate receives its profile path,
not the old fixture-only projectDirectory option. It invokes the existing
installOpenCodeProfile controller with the optional selected V2 checkout,
package path and epoch. The pre-change controller ignores that optional request.
No test-owned code writes enrollment or implements a permission decision.

Each exact CLI/TUI runtime launches V2 in the selected checkout, V2 in a second
unenrolled checkout, then V1 in both. Actual native shell/bash attempts use a
scripted model transport and the same protected ticket path. V1 must deny both;
unenrolled V2 must leave the second project alone. The V1 marker must never run
in V2 and must run in V1. JSONC comments, all user configuration values, V1
module bytes and retained skills/commands/agents must survive unchanged. Only
the test server URL changes between runs. The generated V2 package must remain
byte-identical and actual native observations must show its active registration.

The intended RED is V2_ENROLLED_GUARD_MISSING after all these controls: the
requested selected checkout remains unprotected because no profile-local
enrollment reader/writer exists. Author preliminary runs fail there in CLI and
TUI (exit 2), log /tmp/safeword-opencode-coexistence-red-2.log. The independent
execution must repeat the final formatted proof with its added preservation
and active-package assertions before implementation.

The hosts share OPENCODE_CONFIG_DIR. Their databases use separate XDG_DATA_HOME
locations because an actual V1 launch against V2-created storage exits with
"Database is not empty and has no session table". Safeword does not migrate or
modify host databases. This proves shared configuration, not backwards-compatible
OpenCode database schemas. The pinned V2 docs explicitly support the database
override and distinguish config/data paths:
[V2 storage paths](https://github.com/anomalyco/opencode/blob/v2.0.32/services/www/src/docs/content/cli/providers.mdx).

The accepted local package declaration uses the exact V2 documented object form
while retaining the singular V1 field:
[V2 plugin migration](https://github.com/anomalyco/opencode/blob/v2.0.32/services/www/src/docs/content/build/plugins/migrate-v1.mdx).
Customer selection and admission remain ineligible until the later sealed proof
and lifecycle work. This step adds no public flag and does not change defaults.
