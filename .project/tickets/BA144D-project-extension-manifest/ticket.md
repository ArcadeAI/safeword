---
id: BA144D
slug: project-extension-manifest
type: feature
phase: implement
status: in_progress
created: 2026-06-26T03:01:36.577Z
last_modified: 2026-06-26T06:03:41Z
external_issue: https://github.com/ArcadeAI/safeword/issues/454
depends_on: [Y06KJS]
scope:
  - Add an explicit `extensions` section to `.safeword/config.json` for project-owned guides, templates, skills, and hook commands.
  - Resolve extension paths from the project root and keep extension source files customer-owned, never copied into safeword-owned templates.
  - Reject extension source paths that live under safeword-owned directories or generated adapter paths, so reset/upgrade cannot delete customer content.
  - Expose declared extensions through safeword-owned adapters or pointers on requested Claude, Codex, and Cursor surfaces where the compatibility matrix supports that mapping.
  - Validate extension entries in `safeword check`, including missing paths, duplicate names, unsafe hook declarations, and unsupported agent/event mappings.
  - Require hook extensions to declare target agent/event, matcher, structured command plus optional args, timeout, blocking mode, and a project-local script/target path (directly or as an argument to an allowed runtime such as `bun`).
  - Preserve customer-authored hooks while adding or updating safeword hooks across Claude, Codex, and Cursor, including same-event Cursor hooks.
  - Route customer skill extensions through the neutral skill manifest expansion path instead of adding a second skill-registration model.
  - Document the manifest with a worked example and add focused tests for parsing, validation, reconciliation, hook preservation, and adapter exposure.
out_of_scope:
  - Plugin-pack distribution, marketplace installation, versioned team guardrail packs, or fleet-wide adoption reporting.
  - Template overrides of safeword-owned files.
  - Auto-discovery by glob, magic folders, cosmiconfig, or any additional config discovery layer.
  - Remote URL hook command paths or default free-form shell hook strings.
  - Copying, migrating, or deleting customer-owned extension files.
  - Supporting extension source files stored inside safeword-owned directories or generated adapter paths.
  - Guaranteeing every native hook event maps to every agent; unsupported combinations fail `safeword check`.
  - A `safeword config set` command or interactive setup prompt for extensions.
done_when:
  - `.safeword/config.json` parsing accepts absent, empty, and populated `extensions` config safely with project-root-relative path resolution.
  - `safeword check` reports missing extension files, duplicate extension names, unsafe hook declarations, and unsupported agent/event mappings with actionable messages.
  - Setup and upgrade preserve customer-owned extension files while creating or updating only safeword-owned adapter surfaces.
  - Reset removes safeword-owned extension adapters but leaves customer-owned extension files intact.
  - Existing customer hooks survive safeword setup and upgrade across Claude, Codex, and Cursor, including same-event Cursor hooks.
  - Hook extension validation rejects ambiguous or unsafe declarations before installation.
  - The Claude/Codex/Cursor extension compatibility matrix is documented and test-covered for supported and unsupported mappings.
  - Declared guide, template, skill, and hook examples become available on supported requested agent surfaces without duplicating source content.
  - Tests cover config parsing, check diagnostics, reconcile preservation/reset behavior, hook merge preservation, unsupported mapping failures, and at least one end-to-end adapter exposure path.
  - Documentation shows a minimal `extensions` manifest and calls out v2 team-pack distribution as future scope.
---

# Let projects extend safeword guardrails without forking safeword

**Goal:** Let projects add project-owned safeword guides, templates, skills, and hook guardrails without editing or forking safeword-owned files.

**See:** [spec.md](./spec.md) for personas, jobs-to-be-done, and outcomes.

## Work Log

- 2026-06-26T06:03:41Z Complete: scenario-gate - Scenarios validated (AODI) + adversarial pass; impl-plan.md written (test layers + build order in Approach)
- 2026-06-26T06:03:41Z Updated: Figure-it-out confirmed implementation should use one manifest parser plus adapter expansion in the existing reconciliation path, with plugin/team-pack distribution kept as v2 scope
- 2026-06-26T05:57:24Z Updated: Applied pass-review strengthenings for runtime wrapper outside-root, same-kind/cross-kind duplicate names, and upgrade adapter exposure
- 2026-06-26T05:52:29Z Updated: Independent review-spec found 3 must-fix and 4 should-strengthen issues; revised scenarios to remove vacuous no-op, split diagnostics, add setup hook preservation, and expand hook/path/matrix partitions
- 2026-06-26T03:44:22Z Complete: define-behavior - 16 scenario definitions / 53 executable example cases across 5 rules
- 2026-06-26T03:44:22Z Complete: intake - Understanding converged, scope established; advisory cold-start executability check offered for cross-cutting feature and not run before user-directed proceed
- 2026-06-26T03:38:17Z Updated: Quality-review tightened scope against extension source paths under safeword-owned/generated directories and clarified hook runtime-plus-script validation
- 2026-06-26T03:35:33Z Updated: Drafted engineering scope, out-of-scope, and done-when for scope gate; resolved live open questions into v1 scope decisions
- 2026-06-26T03:30:43Z Updated: Quality-review tightened ACs by adding adapter exposure criterion and explicit hook command safety semantics
- 2026-06-26T03:26:19Z Updated: Added deferred process question about multi-horizon Rave Moment framing; not blocking BA144D intake
- 2026-06-26T03:22:18Z Updated: Drafted acceptance criteria under confirmed TB1 and SM1 jobs; kept v2 promotion as horizon, not v1 AC scope
- 2026-06-26T03:21:10Z Updated: User accepted JTBD gate; reran Rave Moment for one-year v2 horizon and recorded promotion-to-team-standard as future product moment
- 2026-06-26T03:07:48Z Updated: Replaced skipped Rave Moment with grounded upgrade-preservation moment after figure-it-out pass
- 2026-06-26T03:04:30Z Updated: Started full BDD intake from GitHub issue #454; drafted intake brief and JTBDs in spec.md
- 2026-06-26T03:01:36.577Z Started: Created ticket BA144D
