# Restore captured live-reviewer profiles

The first final live run failed all 28 cases before a reviewer judgment. Base
Vitest config deliberately sandboxes CLAUDE_CONFIG_DIR and CODEX_HOME. Live
config captures the operator's prior value, using an empty string to mean the
operator used the default profile. A cleanup incorrectly treated that empty
capture as missing and left the unauthenticated sandbox active. This is a test
harness regression, not evidence of 28 semantic defects or expired user login.

The new small fixture helper overrides a profile only when capture metadata is
present. A nonempty value restores a custom profile; an empty capture clears
the test sandbox and restores the native default; absent capture leaves the
existing profile untouched. The other host's environment remains unchanged.
Both direct headless and CLI probes use the same helper. No credentials or
operator configuration files are modified.

Six native-child tests cover both providers and all three capture states. RED
was two failed / four passed, reproducing the empty-capture bug. GREEN was 86
passed across five focused files, including all six new cases, slicing fixtures,
proof tags, the Cucumber missing-hook control and the CLI boundary tests. Lint
and typecheck passed. The full CLI-only live matrix is now running with unchanged
judgment assertions; its actual terminal result is reported separately.

Production source remains unchanged from CI-green 72129cbf1. Review this test
repair plus the existing production repair as a current bounded source review.
Do not use stale, setup-failed or partial live results as passing semantic proof.
The broader Verify dependency advisories and configured CI policy are documented
in delivery-final.md; no dependency, ignore or threshold was changed.
