---
id: J1GW31
slug: catch-broken-doc-links
type: task
phase: intake
status: in_progress
created: 2026-09-06T14:50:18.531Z
last_modified: 2026-09-06T14:50:18.531Z
---

# Catch broken links and anchors across project docs

**Goal:** Every markdown link and #anchor in the repo is checked, so a citation that goes nowhere is caught before review.

**Why:** A proof reference in BR373S already points at a nonexistent anchor; MD051 only checks within one document, so cross-file fragments go unvalidated.

## Work Log

- 2026-09-06T14:50:18.531Z Started: Created ticket J1GW31

- 2026-09-06T14:52:00.000Z Split out of PJT893, which removed a hand-rolled
  anchor resolver from the principle-trace gate. Six independent review passes
  showed the resolver could not be made correct inside a hook: reproducing a
  GitHub anchor needs github-slugger's ~8 KB generated Unicode table plus its
  stateful duplicate-heading suffixes (`#evidence-1`), and hooks carry no
  third-party dependencies. Every approximation either accepted dead links or
  rejected live ones.

  **Known-broken link to fix here.** `.project/tickets/BR373S-protect-remote-test-runners/impl-plan.md`
  cites `test-definitions.md#rule-remote-runnertbu1r3-repository-code-...`.
  GitHub renders that heading as `...tbu1r3--repository-code-...` — two hyphens,
  because the stripped em dash leaves both of its neighbouring spaces. The
  citation has one, so the link is dead today. It was almost certainly generated
  by the same collapsing logic the old resolver used, which is why the old check
  accepted it.

  **Approach.** Repo-wide, not gate-scoped: the same defect can sit in any of the
  ~2300 markdown files, not just proof cells. `markdownlint`'s MD051 is
  same-document only, so it cannot cover cross-file fragments. `lychee
  --include-fragments=anchor-only` does, over local markdown. Wire it into CI
  alongside the existing markdown lint.

  **Out of scope.** The principle-trace gate keeps validating that a proof
  reference resolves to a real in-repo file — that check is correct and stays.
