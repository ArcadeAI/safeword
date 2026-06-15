# Work Log: 71Q4DV eslint-10-react-plugin-path

**Anchored to:** `.project/tickets/71Q4DV-eslint-10-react-plugin-path/ticket.md`

---

## Session: 2026-06-15

- [20:31] Implemented the React preset migration from `eslint-plugin-react` to `@eslint-react/eslint-plugin`; kept `eslint-plugin-react-hooks` for Hooks and Compiler diagnostics.
- [20:31] Added behavior tests for missing keys, duplicate keys, direct state mutation, children prop usage, unsafe target blank, and unknown DOM properties at `error` severity.
- [20:31] Added explicit parity-gap tests for duplicate JSX props and unescaped entities because `@eslint-react` does not ship direct equivalents.
- [20:31] Added an `eslint-v10` npm alias so the React preset can be loaded by ESLint 10 in tests without moving Safeword's production peer range yet.
- [20:48] Updated architecture docs to record `@eslint-react/eslint-plugin` as the React framework lint plugin and to note legacy `eslint-plugin-react` is not bundled.
- [20:48] Verified focused tests, related preset/schema tests, smoke-fast tests, BDD, build, typecheck, ESLint, markdown lint, Gherkin lint, and Prettier checks. Recorded full-suite and knip caveats in `verify.md`.
- [21:13] Fixed quality-review findings: `@eslint-react` hook/compiler overlaps are off, official `react-hooks/*` remains authoritative, and React-family inherited warnings are normalized to errors. Focused React tests pass 32/32.
- [21:23] Tracked the future production ESLint 10 Node runtime floor in ticket 099: `eslint@10.5.0` requires `^20.19.0 || ^22.13.0 || >=24`, so Safeword's Node-22 floor must move from `>=22.12` to at least `>=22.13` when ticket 099 expands the production ESLint peer.
- [21:52] Refactored the React preset tests by extracting repeated flat-config plugin lookup logic into `hasPlugin`. Focused React tests still pass 32/32.
