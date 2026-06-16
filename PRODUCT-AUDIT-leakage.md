# Safeword Product Audit — Customer-Agnostic & Language-Agnostic Leakage

**Date:** 2026-06-16
**Branch:** `claude/safeword-product-audit-115lwo`
**Scope (agreed):** Shippable surface only — what lands in a *customer* project:
`packages/cli/templates/`, `packages/cli/src/packs/`, `packages/cli/src/presets/`,
the CLI install logic (`src/commands/setup.ts`, `src/schema.ts`), and customer-facing
README sections. **Out of scope:** this repo's own dogfood config (`.safeword/`,
`.claude/`, root `CLAUDE.md`/`AGENTS.md`/`ARCHITECTURE.md`), the website, and
hooks being written in TypeScript and run via `bun` (accepted infrastructure — the
hook runtime is language-neutral-by-fiat and explicitly excluded).

**Two axes audited:**

1. **Customer vs. safeword-as-target** — content that assumes the project being
   worked on *is* safeword itself (its own dev/release workflow, its own monorepo
   paths) rather than an arbitrary customer project.
2. **JS/TS vs. language-agnostic** — content that assumes JavaScript/TypeScript
   when safeword claims to support Python, Go, Rust, and SQL.

> **Deliverable:** findings only — no code changed. Severity reflects customer
> impact, not effort.

---

## Executive summary

The **language axis is where the real exposure is.** Safeword has a genuine
multi-language pack architecture (TS/Python/Go/Rust/SQL), but the *generic shared
surface that every project receives regardless of language* is still JS-first in
three load-bearing places:

- **Install is JS-ifying by design.** Every project — including a pure
  Python/Go/Rust repo — gets a `package.json`, the full TS toolchain
  (ESLint/Prettier/knip/dependency-cruiser/jscpd), and a **TypeScript** Cucumber
  BDD lane it cannot run. This is deliberate (ticket 102b) but it is the single
  deepest piece of JS-coupling in the product and it makes the per-file
  `languages.javascript` guards effectively no-ops.
- **The core workflow skills hard-code the JS toolchain.** `/verify` runs
  `bun run test` / `bun run build`; `/audit` runs `knip`/`depcruise`/`jscpd`;
  `/lint` leads with ESLint/Prettier/tsc. On a non-JS project these degrade to
  "nothing useful happened" at best, and the verify gate is effectively broken.
- **Teaching material uses TypeScript as the only example language** across
  `testing`, `refactor`, the testing-guide, and the doc-templates.

The **customer-vs-safeword axis is mostly clean** — the architecture (template →
`bunx safeword upgrade`, the `dogfood.ts` repo-detector) correctly separates "what
we ship" from "what we are." The residue is small: a handful of customer-facing
examples that cite **safeword's own** `packages/cli/src/...` paths, and a few
shipped hook comments that describe safeword's release process.

---

## AXIS 2 — JS/TS leakage (primary concern)

### A. Structural: install JS-ifies every project *(HIGH — by design, flag for decision)*

`ensurePackageJson()` creates a `package.json` in **every** project before language
detection runs, so `languages.javascript` is always `true` and
`setupJavaScriptProject()` runs unconditionally. The code says so directly:

- `src/commands/setup.ts:146-159` — *"Every safeword project gets one … needs a JS home even in pure Go/Rust/Python repos (ticket 102b)."*
- `src/commands/setup.ts:460-462` — *"every project is a JS project now."*

Consequences a pure Python/Go/Rust repo inherits:

| What gets installed | Where | Why it's a leak |
| --- | --- | --- |
| `package.json` (`private: true`) | `setup.ts:146` | Foreign manifest in a non-JS repo |
| TS BDD lane: `cucumber.mjs`, `steps/world.ts`, `steps/shared.steps.ts`, `features/safeword-lane.feature` | `schema.ts` managed/owned files (`cucumber/*` templates), no language gate | **TypeScript** step defs (`tsx/esm`, `@cucumber/cucumber`) a Python/Go/Rust team cannot run or maintain |
| npm packages: `eslint@^9`, `prettier`, `knip`, `dependency-cruiser`, `@cucumber/cucumber`, `tsx`, `@types/node`, `safeword` | `src/packs/typescript/files.ts` base packages → `schema.ts` `packages` | `node_modules/` + 8 dev deps in a repo with no JS |
| `eslint.config.mjs`, `.prettierrc`, `knip.json` | `src/packs/typescript/files.ts` generators guarded by `ctx.languages?.javascript` | Guard is **always true** post-`ensurePackageJson`, so guards never skip |
| `.jscpd.json` | `schema.ts` owned file, **no** generator/guard | JS/TS-oriented copy-paste detector config, no value for other langs |
| `.dependency-cruiser.cjs` / `.safeword/depcruise-config.cjs` | `setup.ts` arch build (`buildArchitecture`) | CommonJS config for a JS module-boundary tool |

**Recommendation (for decision, not done here):** introduce a
`hasNonJavaScript = python || golang || rust || sql` notion and gate the JS
toolchain on `javascript && !nonJsOnly`, OR move the BDD lane + JS tooling into the
TypeScript pack so it's installed only when JS is actually present. The current
guards can't work while `ensurePackageJson` forces the flag on.

### B. Core workflow skills hard-code the JS toolchain

These ship to every project and are invoked on every language:

| Severity | File:line | Leak |
| --- | --- | --- |
| **HIGH** | `skills/verify/SKILL.md:56-70`, `commands/verify.md:56-66` | Verify gate runs `bun run test`, then `bun run build`, plus a `node -e` `package.json` script probe. On a non-JS repo (empty `scripts: {}`) these no-op or fail — the completion gate doesn't actually verify the project. |
| **HIGH** | `skills/verify/SKILL.md:95-108`, `commands/verify.md:91-104` | Dependency-drift check reads `package.json` `dependencies`/`devDependencies` vs ARCHITECTURE.md — JS-only; Cargo/go.mod/pyproject get no drift check. |
| **MEDIUM-HIGH** | `skills/audit/SKILL.md:44-100`, `commands/audit.md:40-96` | Audit pipeline = `bunx depcruise`, `bunx knip --fix`, `bunx jscpd`, npm `outdated`. Only knip/outdated are `[ -f package.json ]`-gated; architecture (depcruise) and dep-drift are JS-only. Non-JS projects get no dead-code/architecture/outdated audit. |
| **MEDIUM** | `skills/lint/SKILL.md:29-58`, `commands/lint.md:25-53` | The inline lint block leads with ESLint/Prettier/`tsc` (guarded by `[ -f package.json ]`, so OK), but the skill is framed JS-first; other linters (Ruff/golangci/mypy) appear only as a trailing mention. The real multilingual path is the `post-tool-lint` hook, not this skill. |
| **MEDIUM** | `skills/bdd/TDD.md:31-33`, `skills/bdd/SCENARIOS.md:207` | BDD RED step prescribes "thinnest **TypeScript** step definitions" and a "native **vitest** skeleton"; `codify --format gherkin` emits vitest. A Python/Go BDD user is steered into TS/vitest. |

> Note: lines like `bun "$PROJECT_DIR/.safeword/hooks/…"` (audit/verify/explain/
> self-review SKILLs) are the **accepted bun hook runtime** and are *not* flagged
> per the agreed scope.

### C. Teaching material / guides assume TypeScript *(MEDIUM/LOW)*

| Severity | File:line | Leak |
| --- | --- | --- |
| MEDIUM | `guides/testing-guide.md:144-402` | Examples are all ` ```typescript `, plus `playwright.config.ts`, `bun run dev:test`, "Package.json Scripts", "Vitest/Jest". A non-JS reader gets no examples in their language. |
| MEDIUM | `guides/architecture-guide.md:340-349` | Boundary enforcement section is `eslint-plugin-boundaries` + `bun add -D` only — no Python (import-linter) / Go (depguard) equivalent, though the pack spec knows them. |
| MEDIUM | `doc-templates/architecture-template.md:65` | Template a customer fills in bakes in *"Boundaries enforced via `eslint-plugin-boundaries`."* |
| LOW | `skills/testing/SKILL.md` (10× ` ```typescript `), `skills/refactor/SKILL.md:69/97/115`, `guides/design-doc-guide.md:70`, `doc-templates/design-doc-template.md:25/45/61` | All illustrative code is TypeScript; reads as JS-first to non-JS users. |
| LOW | `guides/context-files-guide.md:240` | Suggested context line: *"@package.json for available npm commands."* |
| LOW | `guides/zombie-process-cleanup.md`, `skills/cleanup-zombies/SKILL.md:29` | Node dev-server centric (vite/next, bun/pnpm/yarn/npm) — inherent to the topic, low concern. |
| LOW | `guides/learning-extraction.md:290/319/441-444` | Examples lean Astro/Electron/`bun run build`. |

---

## AXIS 1 — Safeword-as-target leakage (secondary; mostly clean)

The install/upgrade architecture cleanly separates ship-vs-self
(`hooks/lib/dogfood.ts` correctly detects the dev repo to skip auto-upgrade — this
is right and **not** a leak). Residual items:

| Severity | File:line | Leak |
| --- | --- | --- |
| MEDIUM | `templates/SAFEWORD.md:190`, `:205` | Code-citation examples instruct customers using **safeword's own** paths: *"`packages/cli/src/auth.ts:42`"* and *"write `packages/cli/src/foo.ts:142` inline."* Teaches customers safeword's monorepo layout as the norm; use a generic `src/...` placeholder. |
| MEDIUM | `templates/skills/tdd-review/SKILL.md:70` | Worked example: *"implement minimum code in `packages/cli/src/lint.ts`"* — safeword's own source path in shipped guidance. |
| LOW | `templates/hooks/session-auto-upgrade.ts:23`, `templates/hooks/lib/dogfood.ts:5-13`, `templates/hooks/post-tool-sync-learnings.ts:42` | Shipped hook **comments** describe safeword's own release process (*"deployed mirrors of the LOCAL `packages/cli/templates/`"*, *"ahead of the published npm package"*). Harmless at runtime, but it's safeword-internal narrative shipped to customer machines. Comment hygiene only. |
| LOW | `templates/cucumber/safeword-lane.feature`, `world.ts`, `cucumber.mjs` | Starter scaffold is branded "Safeword BDD lane" / `SafewordWorld`. It tells the user to replace it, so acceptable — noting only because it ships to every project (see Axis 2-A for the bigger TS-runtime issue). |
| LOW | `README.md:54`, `:220`, `:406` | Customer-facing README leads JS-first: *"For JS/TS projects: ESLint, Prettier…"* then relegates *"Python, Go, and Rust (beta)"*; hooks described as "TypeScript … Bun runtime". Accurate, but frames JS as the primary citizen. (README:439-514 "Development" is explicitly contributor-facing and correctly out of scope.) |

---

## Prioritized fix list (if/when you act)

1. **Decide the JS-ification policy (Axis 2-A).** Biggest lever. Either gate the JS
   toolchain + BDD lane behind real JS detection, or consciously accept "every
   project is a JS project" and document it as a product stance. Everything else
   downstream depends on this call.
2. **Make `/verify` and `/audit` language-aware** (verify.md/audit.md + their
   SKILLs): branch test/build/drift/dead-code on detected language, mirroring how
   `/lint` and the `post-tool-lint` hook already fan out across Ruff/golangci/clippy.
3. **De-JS the teaching surface:** add non-TS examples (or language-neutral
   pseudocode) to `testing-guide`, `architecture-guide`, `testing`/`refactor`
   skills, and the doc-templates; generalize the boundary-enforcement section to
   import-linter/depguard alongside eslint-plugin-boundaries.
4. **Sanitize safeword-own paths in shipped guidance** (SAFEWORD.md:190/205,
   tdd-review:70) → generic `src/...` placeholders.
5. **Comment hygiene** on the three shipped hooks that narrate safeword's release
   process (low priority).

## What is correctly language-/customer-agnostic (don't "fix")

- `SAFEWORD.md:132-136` — the dependency-versioning guidance is exemplary:
  enumerates `requirements.txt`/`go.mod`/`Cargo.toml` and `uv add`/`cargo add`/
  `go get`. This is the model the rest of the docs should match.
- The language-pack architecture (`src/packs/*`, `LANGUAGE_PACK_SPEC.md`) and the
  `post-tool-lint` hook's multi-language routing.
- `hooks/lib/dogfood.ts` repo-detection (correct ship-vs-self boundary).
