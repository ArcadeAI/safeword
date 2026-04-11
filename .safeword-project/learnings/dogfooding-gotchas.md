# Dogfooding Gotchas

Covers: CLAUDE.md import pattern conflicts when running safeword upgrade on the safeword repo itself.

## CLAUDE.md Import Pattern

**Issue:** Running `safeword upgrade` on this repo modifies `CLAUDE.md` because the CLI prepends the safeword banner to both CLAUDE.md and AGENTS.md.

**Why:** This repo's CLAUDE.md is just `@./AGENTS.md` (a single import line) to avoid duplication. The CLI doesn't know this is intentional.

**Fix:** After running `safeword upgrade`, restore CLAUDE.md:

```bash
git checkout CLAUDE.md
```

**Alternative:** Accept the banner in CLAUDE.md since it's technically correct behavior.
