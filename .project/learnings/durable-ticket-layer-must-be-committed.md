# Durable Ticket Layer Must Be Committed (Relocate, Don't Git-Ignore)

Covers: ticket store git-tracking, committed-vs-ignored split, ephemeral/cloud persistence, file-canonical seam, paths.projectRoot relocation.

**Discovered:** 2026-06-22, during the sync-tracker (JS5K5G) design — stress-testing "what if `.project/` were git-ignored?"

## The invariant

Safeword's **durable** ticket layer (`ticket.md` status/phase/relations/decisions, `spec.md`, `.feature` scenarios, `verify.md`) **must be committed**. It is the source of truth and the cross-session/cross-agent context anchor. Git-ignoring it breaks the system in two load-bearing ways:

1. **Persistence dies where safeword is aimed.** In cloud/CI/multi-agent/fresh-clone contexts (e.g. Claude Code on the web — the container clones fresh and is reclaimed), only committed files survive. An ignored anchor doesn't anchor. The mechanics still read local disk, so it "works on one persisted machine and is gone everywhere else" — a silent failure, worse than an obvious one.
2. **The seam inverts to the rejected model.** With no committed local record, the external tracker becomes the only shared truth → safeword degrades to a thin cache of an **external-canonical** system — exactly the two-master, network-in-the-loop design rejected in the file-vs-tracker figure-it-out. Git-ignore _forces_ the architecture we refused.

Precedent: every local-first tracker (git-bug, Fossil, Sciit) commits its issue data — that IS the local-first value (git-bug: "not just a wrapper around GitHub").

## The committed-vs-ignored split (already in place)

- **Committed (durable, shared, reviewable):** the ticket artifacts above.
- **Git-ignored (ephemeral / machine-local):** `quality-state*.json`, `failure-counts.json`, `skill-invocations.log`, `re-entry.md`, `dependency-readiness.json`, `.update-cache.json`.
- **Optional valve:** scratch work logs (`.safeword/logs/`) are where the noise/privacy case is strongest — a team may ignore _those_ while keeping the durable ticket.

## The escape hatch for "not in my product repo"

Teams that don't want tickets in their code repo should **relocate `paths.projectRoot`** (sibling dir/repo/dedicated branch) — which preserves the commit/persistence property — **not git-ignore**, which destroys it. Relocate, don't ignore.

## Managing "pollution" (commit ≠ index; index-ignore ≠ access-block)

Keeping the tree committed does **not** mean the coding agent must index it. "Pollution" is three separate surfaces with three different tools — none of them git-ignore (verified 2026-06-22):

1. **Agent retrieval/index** — _mostly a Cursor problem._ Cursor keeps an embedding index; a large ticket tree dilutes `@codebase` retrieval. Fix: **`.cursorindexingignore`** (drops them from the index but keeps them readable on @-mention — the access-preserving variant; **not** `.cursorignore`, which blocks access and would blind the safeword agent). **Claude Code does not index at all** — it uses agentic ripgrep on demand ([no RAG/vector by design](https://vadim.blog/claude-code-no-indexing/)), so the index-pollution fear barely applies; don't blanket-ignore (it'd hide tickets from the agent's own grep). **Codex** `.codexignore` is requested but not reliably respected yet — no action.
2. **Human PR-diff + merge churn** — the magnet is the auto-generated `INDEX*.md` (rewritten on every ticket creation). Mark it generated: `.gitattributes` → `INDEX*.md linguist-generated=true merge=union`. Per-ticket folders + Crockford IDs (ticket 080) already isolate the tickets themselves.
3. **"Not in my repo at all"** — relocate `projectRoot` (above).

**Setup implication:** `safeword setup` may _offer_ (opt-in, like the tracker) to write `.cursorindexingignore` for the project root + the `.gitattributes` generated-marker for `INDEX*.md`. Opt-in because it edits the user's repo.
