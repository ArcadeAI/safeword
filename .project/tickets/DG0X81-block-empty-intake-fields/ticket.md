---
id: DG0X81
slug: block-empty-intake-fields
type: patch
phase: done
status: done
created: 2026-11-13T14:41:00.000Z
last_modified: 2026-11-14T05:40:00.000Z
external_prs: [https://github.com/ArcadeAI/safeword/pull/7356]
scope:
  - Intake gates (Codex hook, shared PreToolUse gate, feature readiness) treat YAML forms that mean "nothing" as empty
  - The shared frontmatter parser follows YAML for comments, block scalars and list layout
out_of_scope:
  - Claude ticket gates honoring a configured project root (PR 7357)
  - childSpecIssues Contribution-heading gap
  - Codex plugin-hook stdin snapshot order
done_when:
  - Empty, null, comment-only and empty-block intake fields block test-definition creation on Codex and the shared gate
  - Valid tickets in less common YAML layouts are accepted
  - Existing test-definitions.md stays editable through Codex
---

# Stop empty YAML intake fields from passing ticket gates

**Goal:** An agent cannot start test definitions while a ticket's `scope`, `out_of_scope` or `done_when` is effectively empty, and valid tickets are not rejected.

**Why:** Codex accepted an empty `scope:` in custom ticket folders; review then showed the shared hand-written frontmatter parser read many empty YAML forms as content and dropped some valid list items.
