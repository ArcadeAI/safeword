# Dependency Claims Are Consumer-Scoped, Not Lockfile-Scoped

Covers: dependency bump descriptions, transitive dependencies, monorepo lockfile vs published package graph, native bindings.

**Finding:** PR #1467 (eslint-plugin-astro 2 → 3) described the `@astrojs/compiler` → `@astrojs/compiler-rs` swap as "not a new dependency / net reduction." That was true of `bun.lock` and false for everyone who installs safeword from npm. Both halves of the claim came from looking at the wrong graph.

**Mechanism:** `@astrojs/compiler-rs` was already in this repo's lockfile before the bump — `packages/website` dev-depends on `astro@7`, which depends on it. So the bump added no lockfile entry and the diff genuinely looked like a net reduction. But `packages/website` is not published; safeword's consumers install `packages/cli`, where `eslint-plugin-astro` is a **production** dependency. What reaches them is a substitution:

- v2: `@astrojs/compiler` (WASM) + `astrojs-compiler-sync` + `entities`
- v3: `@astrojs/compiler-rs` → `@astrojs/compiler-binding` → one of nine platform-specific native binaries (`linux-x64-gnu`, `darwin-arm64`, …, plus a `wasm32-wasi` fallback)

A pure-JS/WASM parse path became a native NAPI one. For a consumer that is a new class of dependency — new install-time platform resolution, new prebuilt-binary supply-chain surface, new failure mode on unsupported platforms — regardless of the package count moving down by one.

**The rule:** when a bump touches a dependency of a **published** package, describe its effect on the consumer's install, not on `bun.lock`. Concretely, before writing "no new dependency" or "net reduction":

1. Ask which package declares it. `packages/cli` dependencies ship; `packages/website` and every `devDependency` do not.
2. Diff the transitive deps of the old and new versions directly (`node -p "require('.../package.json').dependencies"` on both, or `npm view <pkg>@<version> dependencies`), rather than reading the lockfile diff — a monorepo lockfile hides additions that another workspace already pulled in.
3. Say what changed in kind, not just in count. Native ↔ WASM ↔ pure JS, optional platform binaries, and postinstall scripts are all consumer-visible even when the package count falls.

Counting packages answers "did the lockfile grow?" Consumers are asking "what runs on my machine now?" — and those questions come apart exactly when a monorepo happens to already carry the new dependency for unrelated reasons.

**References:**

- PR #1467 — the bump whose body carried the over-broad claim (correction lives here; the merged body cannot be fixed).
- `packages/cli/package.json` — `eslint-plugin-astro` sits under `dependencies`, so it reaches every consumer.
- `packages/cli/src/presets/typescript/eslint-configs/__tests__/astro.test.ts` — the `.astro` smoke fixtures that now regression-test the native parse path this swap introduced.
- `bun.lock` — `@astrojs/compiler-rs@0.3.1` present before the bump via `astro@7.1.3` (`packages/website`), which is why the lockfile diff read as clean.
