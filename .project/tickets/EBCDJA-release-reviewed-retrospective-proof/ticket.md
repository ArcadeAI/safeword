---
id: EBCDJA
slug: release-reviewed-retrospective-proof
type: task
phase: implement
status: in_progress
scope:
  - release the reviewed retrospective claim and append-only proof renewal guard as Safeword 1.1.0
  - keep CLI, Claude plugin, Codex plugin, generated runtimes, and installed version aligned
out_of_scope:
  - completing or relabeling historical #2121 scenario evidence
  - changing the existing historical proof ledger row
done_when:
  - focused guard tests, full suite, release contract, lint, typecheck, and generated surfaces pass
  - CLI package, source installer, Claude and Codex manifests, generated runtimes, and project version identify Safeword 1.1.0 consistently
  - independent review covers this release branch's final source and exact head; CI and Ready advisory review pass before publication
created: 2026-10-07T19:57:35.859Z
last_modified: 2026-10-07T19:57:35.859Z
---

# Release reviewed retrospective proof for Safeword users

**Goal:** Publish Safeword 1.1.0 with the reviewed retrospective proof and renewal guard so the already implemented #2121 scenarios can be verified honestly.

**Why:** The installed 1.0.0 guard cannot validate multiple historical claims or renew a checked proof after support-file drift.

## Work Log

- 2026-10-07T19:57:35.859Z Started: Created ticket EBCDJA
- 2026-10-07T19:59:00Z Split the release prerequisite from #2121: copied only the reviewed runtime, release artifacts, generated plugin output, and focused tests from codex/review-generated-targets. Historical proof packets, scenario ledger, and original tickets remain on their branch.
