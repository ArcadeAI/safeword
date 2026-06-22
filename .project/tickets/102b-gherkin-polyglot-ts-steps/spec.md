# Spec: Cucumber-js acceptance lane as core safeword setup (102b)

## Intent

Safeword's whole purpose is BDD/TDD discipline — so the executable-Gherkin acceptance lane is **core infrastructure, not an opt-in feature**. 102a wired the cucumber-js lane into safeword's own repo by hand. This slice makes `safeword setup` install that lane into **any** project it runs on, automatically: the runner config, a step-definition scaffold with a shared shell-out vocabulary, a `features/` dir with a runnable starter, the deps, and a `test:bdd` script. Because the lane is TypeScript (cucumber-js + tsx) and the tests drive the app from the outside, it works regardless of the app's language — a pure Go/Rust/Python repo gets a minimal `package.json` created to host it.

## References

- Parent: epic 102 (under Phase 1 / 0AWSY8). Decisions: cucumber-js, all-TypeScript, **BDD is core (no opt-in flag)** — 2026-06-10.
- Builds on 102a (the lane proven in safeword's own repo) and subsumes the TS-customer scaffold 102a deferred.
- Mechanism grounded in safeword's setup machinery: `detectLanguages` + `ensurePackageJson` (`setup.ts`), `SAFEWORD_SCHEMA.ownedFiles` (the templated-file manifest), base-package install (`reconcile.ts`). Packs are language-only, so the lane is NOT a pack; ownedFiles + base deps are the right home.
- Tests are always TypeScript: step defs shell out to native tooling (`go test`, `cargo test`) or hit the app over HTTP; the app's language never touches the test code.

## Personas

**Technical Builder (TB)** — runs `safeword setup` on a real project (any stack) and expects safeword's BDD discipline, including a runnable acceptance lane, to be set up for them.

## Vocabulary

**Acceptance lane** — the cucumber-js runner + `features/` + `steps/` that safeword installs, distinct from the project's own unit tests. Always TypeScript.

**Shell-out step** — a shared, language-agnostic step (`When I run {string}` / `Then the exit code is {int}` / `Then the output contains {string}`) that runs a command and asserts on its result — how a TS step tests a non-TS app.

## Jobs To Be Done

### gherkin-setup.DEV1 — Get a runnable acceptance lane from `safeword setup`, in any project

**Persona:** Technical Builder (TB)

> When I set up safeword on my project — whatever language it is — I want the executable-Gherkin acceptance lane installed as part of that setup, so running `.feature` tests is built in rather than something I hand-wire.

#### gherkin-setup.DEV1.AC1 — `safeword setup` scaffolds the full cucumber-js lane (config, steps scaffold, features/ starter, deps, test:bdd script) as standard output

#### gherkin-setup.DEV1.AC2 — In a repo with no `package.json` (pure Go/Rust/Python), setup creates a minimal one to host the lane — the only TS-vs-non-TS divergence

#### gherkin-setup.DEV1.AC3 — The scaffolded lane runs green out of the box: `test:bdd` executes the starter feature and it passes, proving the wiring is real

## Outcomes

- A developer runs `safeword setup` in a Go (or TS, or Python) repo and immediately has a working `test:bdd` lane — write a `.feature`, run it.
- Non-JS repos get exactly one extra file (`package.json`) versus JS repos; everything else is identical.
- The foundation for `safeword check` lane-verification and the `.feature`-as-source authoring change (both follow-ons).

## Open Questions

_None — runner (cucumber-js), language (all-TS), and opt-in (none — BDD is core) are decided. The only divergence (the non-JS `package.json`) is in scope._
