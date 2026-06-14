# Configure Documentation Sources for Audit

## Jobs To Be Done

### configure-audit-doc-sources.MA1

When I audit a project whose documentation lives outside the obvious local defaults, I want safeword to read the configured documentation inventory, so I can get drift findings against the docs that actually matter.

#### configure-audit-doc-sources.MA1.AC1

Audit treats top-level `docs.sources` as the authoritative documentation inventory when at least one source is configured.

#### configure-audit-doc-sources.MA1.AC2

Local documentation sources resolve relative paths against the project root and preserve absolute paths.

#### configure-audit-doc-sources.MA1.AC3

Malformed or unsupported source entries do not crash config parsing; valid sibling entries still load.

### configure-audit-doc-sources.MA2

When I audit a project with no documentation source decision recorded, I want safeword to ask whether to configure sources or intentionally leave them unset, so future audits are based on an explicit choice instead of a guess.

#### configure-audit-doc-sources.MA2.AC1

Audit prompts for a documentation source decision when `docs.sources` is absent.

#### configure-audit-doc-sources.MA2.AC2

Audit does not prompt again when `docs.sources` is explicitly configured as an empty list.

#### configure-audit-doc-sources.MA2.AC3

When no sources are configured, audit still uses local discovery and reports that coverage came from fallback discovery.

## Notes

Persona code `MA` means Maintainer Agent: the AI coding agent running safeword workflows for a customer project.
