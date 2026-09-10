---
id: MNS9J2
slug: readiness-status-without-ai-reviewer
type: task
phase: intake
status: backlog
created: 2026-09-08T00:19:55.565Z
scope: |
  Let `safeword/pr-readiness` install without `prReview.enabled`. The check
  needs no model, no secret, and no checkout, so coupling it to the LLM
  reviewer's config gate is arbitrary. Likely shape: its own workflow template
  plus a schema entry gated on its own key.
out_of_scope: |
  - Requiring the status. ARCHITECTURE.md's "Deterministic Readiness Evidence
    Status" record advises against it and explains why; that stands.
  - Re-litigating where the job lives for architectural reasons. Relocation
    does not change merge capability — branch protection matches required
    checks by context-name string, not by workflow file.
done_when: |
  - A repository with the reviewer disabled still gets the readiness status.
  - Turning the reviewer on or off does not add or remove the status.
  - Parity holds and the new template is schema-registered.
last_modified: 2026-09-08T00:19:55.565Z
---

# Let teams use readiness discipline without paying for an AI reviewer

**Goal:** The readiness status installs independently of prReview.enabled

**Why:** It needs no model, secret, or checkout, but today only ships to repos that enable the LLM reviewer

## Work Log

- 2026-09-08T00:19:55.565Z Started: Created ticket MNS9J2
