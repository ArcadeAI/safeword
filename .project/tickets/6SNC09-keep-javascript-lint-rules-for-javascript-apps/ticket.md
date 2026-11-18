---
id: 6SNC09
slug: keep-javascript-lint-rules-for-javascript-apps
type: patch
phase: implement
status: in_progress
parent: 4ZRS4P
external_prs:
  - https://github.com/ArcadeAI/safeword/pull/7662
scope:
  - Framework detection ignores a root typescript that .safeword/config.json records as Safeword-owned
  - The JavaScript preset parses BDD step files (steps/**/*.ts, features/steps/**/*.ts) with the TypeScript parser, without type-checked rules
out_of_scope:
  - Changing how a project that declared its own typescript is detected
done_when:
  - A JavaScript app whose only typescript is Safeword-owned is detected as javascript (test)
  - The JavaScript preset lints a TypeScript step file without a parse error (test with real ESLint)
  - A fresh JS-only install keeps JSDoc rules on its own source files (integration test with real installs)
created: 2026-11-18T06:41:35.887Z
last_modified: 2026-11-18T06:41:35.887Z
---

# Keep JavaScript lint rules for JavaScript apps after Safeword adds typescript

**Goal:** A JavaScript app keeps the JavaScript ESLint preset after install adds typescript for its BDD steps, and its TypeScript step files still lint

**Why:** Bugbot on PR 7662: a declared typescript switches JS apps to the TypeScript preset, dropping JSDoc rules and failing ordinary CommonJS

## Work Log

<!-- Progress history, not part of the accepted contract: record scope and decisions above. -->

- 2026-11-18T06:41:35.887Z Started: Created ticket 6SNC09
- 2026-11-18T06:42:24.506Z Phase: intake → implement
