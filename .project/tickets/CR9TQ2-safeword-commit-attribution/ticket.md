---
id: CR9TQ2
slug: safeword-commit-attribution
type: task
phase: intake
status: todo
created: 2026-07-02T16:03:00.000Z
last_modified: 2026-07-02T16:03:00.000Z
scope: |
  Give the safeword framework durable, honest attribution on the work it drives —
  the commits (and the retro-filed issues) produced while safeword's hooks/skills
  are steering the workflow — WITHOUT a dangling or misleading GitHub co-author.

  Decision (from /figure-it-out, 2026-07-02): use a DEDICATED git trailer, not
  Co-Authored-By.
    - Commit footer gains one line: `Generated-with: safeword vX.Y` (X.Y read from
      packages/cli/package.json at stamp time — NOT a hardcoded literal, so it never
      goes stale). Sits alongside the existing Claude / session trailers; three
      honest layers = model+agent (Claude), session (traceability), framework (safeword).
    - Retro-filed issue bodies gain a one-line footer: `— filed by safeword retro vX.Y`
      in the code-assembled body (egress-safe: static text + version, no free input).

  Durable mechanism (the point of the ticket — a memorized string drifts):
    - A `commit-msg` git hook that appends the `Generated-with` trailer if absent,
      reading safeword's own version. safeword is already a git-hook framework, so
      this is the natural home. Must be idempotent (never double-stamp) and must not
      fight the existing Claude/session trailers or the committer identity.
    - The retro-issue footer is added in the draft/body assembly (src/retro), covered
      by the egress + draft tests.
  For THIS session's 5 pending commits, the trailer was added by hand at the user's
  request (they were unpushed, so a clean rebase — no force-push); this ticket makes
  it automatic going forward.
out_of_scope: |
  - `Co-Authored-By: safeword <email>` — REJECTED: Co-Authored-By only links with a
    real registered GitHub email (else an unlinked grey name), a registrant of that
    email inherits attribution for every commit (the documented Claude Code noreply
    bug), and it misrepresents a tool as a human contributor. See citations below.
  - Signing/verifying commits (separate concern; no signing key in the agent env).
  - Changing the Claude / Claude-Session trailers (those come from the harness, not
    safeword; leave them).
done_when: |
  - A commit produced under safeword carries `Generated-with: safeword v<current>`
    with the version resolved from package.json, added idempotently by a commit-msg
    hook (proven by a test: run the hook over a message with and without the trailer).
  - Retro-filed issue bodies carry the `— filed by safeword retro v<current>` footer,
    covered by a draft/egress test, with no new egress surface (static + version only).
  - No Co-Authored-By trailer for safeword anywhere; existing Claude/session trailers
    and committer identity unchanged.
references: |
  - fabiorehm.com/blog/2026/03/02/our-coding-agent-commits-deserve-better-than-co-authored-by/
    (dedicated tool/model trailers over Co-Authored-By; `Coding-Agent:` / `Model:` / `Assisted-by:`)
  - github.com/anthropics/claude-code/issues/58479 (Co-Authored-By noreply links to an
    unrelated account — the dangling-attribution failure mode)
  - docs.github.com/articles/creating-a-commit-with-multiple-authors (email must be
    account-registered to link)
---

# Durable safeword attribution on the work it drives

**Goal:** Credit the safeword framework on its commits (and retro-filed issues) with
a dedicated `Generated-with: safeword vX.Y` trailer, stamped automatically from
safeword's own version — honest tool credit, no Co-Authored-By dangling.

**Why:** safeword shapes the work (hooks, skills, BDD/TDD guides) but currently gets
no attribution; only Claude does. Co-Authored-By is the wrong tool for a framework
(links to a real account or dangles; misrepresents tool as human). A dedicated
trailer is honest, unbreakable, and doubles as code-archeology metadata.

## Work Log

- 2026-07-02T16:03Z Created from a `/figure-it-out` on how to credit safeword.
  Decision: dedicated `Generated-with:` trailer (not Co-Authored-By), version read
  at stamp time. This session's 5 pending commits get the trailer by hand (unpushed →
  clean rebase); this ticket makes it automatic via a commit-msg hook + adds the
  retro-issue footer.
- 2026-07-02T22:18Z Filed pick-up-cold GitHub issue #620 (two deliverables: the
  retro-issue footer — dependency-free, ship first; and the commit-msg hook, gated on
  the open install-mechanism sub-decision husky/core.hooksPath/native). Use `VERSION`
  from `src/version.ts` for both; footer target `assembleBody` (finding.ts:68-86).
- 2026-07-02T22:20Z Scope broadened (user): attribution on ISSUES + PRs too, not just
  commits. Added Deliverable 3 to #620 (comment): 3a code-assembled bodies get a shared
  `VERSION`-stamped `attributionFooter()` (retro path already does via finding.ts:68-86);
  3b model-created issues/PRs get a `— filed with safeword` footer by convention in
  AGENTS.md / a guide (no hook — model-driven, not code-assembled). 3a is code+test; 3b
  is guidance.
