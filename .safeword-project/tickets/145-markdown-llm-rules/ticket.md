---
id: 145
type: patch
phase: implement
status: open
created: 2026-05-14T16:25:00Z
last_modified: 2026-05-14T16:25:00Z
---

# Enable MD040 + MD036 in markdownlint-cli2 config

**Goal:** Catch two LLM-specific markdown antipatterns at pre-commit time before they degrade the repo's LLM comprehension surface.

**Why:** safeword's docs (tickets, learnings, guides, READMEs) are read constantly by Claude during development. Two specific markdown rules catch antipatterns that LLM-generated docs produce frequently:

- **MD040** (fenced code blocks must specify language) — LLMs default to bare ``` fences. Specifying the language helps both syntax highlighting AND helps a downstream LLM disambiguate code from prose when re-parsing.
- **MD036** (no emphasis used as a heading) — LLMs produce `**Important Section**` as a fake heading instead of using a real `##`. Costs outline structure; confuses LLM-driven table-of-contents generation.

Both rules fit the existing `.markdownlint-cli2.jsonc` philosophy ("Only enforce rules that affect rendering or LLM comprehension. Cosmetic/stylistic rules disabled.")

## Scope

**In:**

- Add `"MD040": true` and `"MD036": true` to the `config` object in `.markdownlint-cli2.jsonc`
- Verify `bun run lint:md` passes after the change (whole-tree audit). Today: 0 violations expected — repo is clean against the default ruleset (verified during ticket #145 intake; the only existing violations were in `roadmap-2025-12.md` which is deleted by PR #87)
- This ticket should land **after** PR #87 (delete-stale-roadmap) merges; otherwise the roadmap's existing violations will cause `lint:md` to fail unrelated to these new rules

**Out of Scope:**

- Wiring `bun run lint:md` to CI — explicitly declined per [research summary](#references). The pre-commit gate is the right level of enforcement for style severity.
- Enabling other candidate rules (MD047, MD025, MD045) — speculative without evidence of pain. Add when a real violation pattern emerges.
- Migrating to a different markdown linter (Vale, textlint, Biome) — Biome doesn't lint markdown today; the others are out of scope.

## Done When

- [ ] `.markdownlint-cli2.jsonc` has `MD040: true` and `MD036: true` in the `config` object, with comments explaining the LLM-comprehension rationale
- [ ] `bun run lint:md` exits 0 on the whole tree
- [ ] Pre-commit hook still passes (lint-staged invokes `markdownlint-cli2 --fix` which will now also auto-fix MD040/MD036 where possible — note MD036 may not be auto-fixable, just reported)

## References

- PR #81 quality review discussion (this session) — established the severity-matched enforcement philosophy: style/structure → pre-commit; security/correctness → CI
- [Biome project's CI workflow](https://github.com/biomejs/biome/blob/main/.github/workflows/main.yml) — does not lint markdown in CI; precedent for "pre-commit only for markdown"
- [.markdownlint-cli2.jsonc](.markdownlint-cli2.jsonc) — current config with stated philosophy
- PR #87 — delete-stale-roadmap, must merge first
