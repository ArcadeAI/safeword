# Shared intake gate through configured namespace aliases

Supporting actual-CLI guard proof for Scenario: A host route cannot evade a
shared denial. This is the existing packaged hook subprocess boundary, not a
new native-host E2E claim or complete scenario coverage.

Review identified a concrete supported configuration missed by the new common
namespace check: edited targets are canonicalized, while resolveNamespaceRoot
returns the configured spelling. Relative and absolute configured symlink roots
therefore differ from the physical target passed into isNamespacePath. The
shared intake gate fails to recognize a new test-definitions.md under its own
configured namespace and returns allow despite missing scope/out_of_scope/done_when.

Two controls establish an enrolled isolated project, real physical ticket
directory with an incomplete ticket and an actual namespace directory symlink.
paths.projectRoot uses the relative alias or its absolute path. The actual built
CLI hook codex pre-tool-use receives a real Write protocol input targeting the
physical definitions path and explicit exit-code denial mode. It must exit2
with the shared missing-intake reason. Before the repair it exits0 instead;
SHARED_INTAKE_NAMESPACE_ALIAS_BYPASS marks the intended assertion. No adapter
policy, hook result or subprocess outcome is injected. Fixture cleanup stays
under the exact owned temporary parent.

Root-cause fix belongs in the shared namespace path comparison. The existing
canonicalPathForGate already resolves symlink ancestors of not-yet-created
files; reuse it for both operands instead of adding host-specific predicates.
No production repair has been made before this executable RED review.

Each alias case also fills the real sibling ticket's required fields and
repeats the same actual hook route, requiring allow0. This contrast prevents
a blanket symlink rejection from satisfying the proof. The initial author
run reproduces both false allows; log /tmp/safeword-namespace-alias-red.log.
