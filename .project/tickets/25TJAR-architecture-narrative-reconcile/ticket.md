---
id: 25TJAR
slug: architecture-narrative-reconcile
type: task
phase: intake
status: in_progress
created: 2026-07-06T03:40:11.819Z
last_modified: 2026-07-06T03:40:11.819Z
scope:
  - ARCHITECTURE.md CLI Structure tree gains the 8 undocumented src/ modules with one-line purposes
  - Runtime dependencies table gains @cucumber/gherkin + @cucumber/messages
  - plugin/ line corrected (Claude Code plugin, non-workspace, marketplace-distributed)
out_of_scope:
  - rewriting generated architecture.generated.md prose sections (machine-owned)
  - website docs (audit found them clean)
done_when:
  - every module in packages/cli/architecture.generated.md appears in ARCHITECTURE.md
  - audit E002-E007 structural/dependency findings no longer reproduce
---

# Reconcile ARCHITECTURE.md narrative with the generated module map

**Goal:** ARCHITECTURE.md documents all 13 real CLI modules, the test-plan module location, the plugin/ packaging note, and the cucumber runtime deps

**Why:** Full audit found 9 structural/dependency documentation errors: 7 CLI modules missing from the narrative, test-plan documented as a command file when it is a top-level module, plugin/ absent from the generated package map, and @cucumber/gherkin+messages runtime deps undocumented

## Work Log

- 2026-07-06T03:40:11.819Z Started: Created ticket 25TJAR
- Reconciled: CLI Structure tree now lists all 13 generated-map modules (one-liners sourced from each module's own doc comments); cucumber runtime deps added to the Dependencies table; plugin/ line fixed — it is the Claude Code plugin (plugin/.claude-plugin/plugin.json), not Cursor, and deliberately not a workspace package; header bumped to 1.16
