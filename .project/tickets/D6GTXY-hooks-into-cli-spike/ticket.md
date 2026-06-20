---
id: D6GTXY
slug: hooks-into-cli-spike
type: task
phase: intake
status: in_progress
created: 2026-06-20T14:57:43.620Z
last_modified: 2026-06-20T14:57:43.620Z
---

# Spike: hooks dispatched from the CLI (latency + wiring)

**Goal:** Falsify (or confirm) the load-bearing assumption behind moving safeword's hook layer into the CLI — that a CLI-dispatched hook can run at ~the direct-script latency baseline — with the smallest possible prototype, and produce a go/no-go + migration strategy.

**Why:** Hooks + lib are 52/139 owned files (37% of the materialized footprint) and the part that churns most on upgrade. Moving them to `safeword hook <name>` subcommands would turn logic-only releases into a one-line version bump, collapse cross-agent into a shared binary (may subsume the per-agent ports in [BJX7WR](../BJX7WR-auto-upgrade-cross-agent/ticket.md)), and partially re-enable Dependabot/Renovate. The whole bet hinges on hot-hook latency — this spike measures it before any migration.

**Reality check (amended 2026-06-20):** safeword **already uses the CLI in every project** — setup is `bunx safeword@latest setup` and the auto-upgrade hook already runs `execFileSync('bunx', ['safeword@<v>', 'upgrade'])`. Bun is a hard requirement for all safeword projects (the `session-bun-check` hook enforces it), so `bunx safeword` works everywhere — including non-JS (Go/Rust/Python/SQL) projects with no `node_modules`. So moving hooks to the CLI introduces **no new dependency category**; an earlier framing of "non-JS projects break" was overstated. The only real question is **hot-path latency**: today a hot hook is `bun .safeword/hooks/X.ts` (local file, ~32ms, zero resolution); via the CLI it becomes `bunx safeword hook X` (universal, already used, but pays bunx resolution per call) or `node_modules/.bin/safeword hook X` (fast, JS-only). Non-JS viability is then simply **read off the `bunx` number** — not a separate gate.

**Related:** [BJX7WR — cross-agent auto-upgrade](../BJX7WR-auto-upgrade-cross-agent/ticket.md) (this spike gates whether that epic does per-agent script ports or wires all agents to one CLI dispatch). Not a child — hooks-into-CLI is broader than cross-agent.

## Hypothesis (the thing to falsify)

> A lean `safeword hook <name>` entry that dynamic-`import()`s only the requested hook runs within ~1.5× of the direct-`bun script.ts` baseline (~32ms warm), even for a heavy hook.

- **Pass** (lean dispatch ≤ ~1.5× baseline): full hook→CLI migration is viable.
- **Fail** (closer to the full-CLI ~53/83ms cold start): partial migration only — hot per-tool hooks stay materialized, cold hooks (session-start, the auto-upgrade hook) move.

## Protocol (do exactly this — descope everything else)

1. Pick the **hottest, heaviest** hook: `post-tool-quality.ts` (fires on every edit; pulls in the quality/lint libs — representative of the real import graph, NOT a toy).
2. Implement a **lean dispatch** entry: parses argv directly and dynamic-`import()`s only the one hook module (no commander, no command graph). Also keep a **naive** path (ordinary commander subcommand, loads the full CLI graph) purely as the pessimistic comparison point.
3. **Measure the latency matrix** — cold and warm, several runs each. Two axes: dispatch (naive vs lean) × resolution (how the hook command finds the CLI). Minimum cells:
   - **Baseline:** `bun .safeword/hooks/post-tool-quality.ts` (today) — ~32ms warm reference.
   - **Lean via `node_modules/.bin/safeword`** (JS-only fast path; node-dist shape, what customers run).
   - **Lean via `bunx safeword@<pin>`** (the universal path — what **non-JS projects** must use; warm cache, and note cold-cache-after-pin-change separately).
   - **Naive via the same resolvers** (to show how much the lean dispatch buys).
   - **Read non-JS viability off the `bunx` number** — if bunx-lean is within bar, non-JS is fine; if only the `node_modules`-bin path clears it, non-JS is the cohort left on materialized hooks.
4. **Wiring smoke test (Claude Code only):** wire the one hook via the CLI path in `.claude/settings.json` and confirm it fires + behaves identically in a real session.
5. Record the **resolution recommendation** (don't build it): `bunx safeword@<pin>` is the universal, already-in-use path (works for every project, no `node_modules`); `node_modules/.bin/safeword` is a JS-only fast path _if_ the bunx number is too slow hot. The choice falls out of the matrix — don't pre-commit to devDep.

## Must surface (don't solve — feed the epic)

- **Eligibility axis (which hooks should even move, regardless of latency):** moving a hook into the binary trades away **transparency/auditability** (today a customer reads `.safeword/hooks/X.ts`; in the CLI it's opaque bundled code) and **debuggability** (can't instrument a binary the way they `bun`-run a file). For **security-relevant edit-gating hooks** (`pre-tool-quality`, `pre-tool-config-guard`) that opacity may be reason enough to keep them materialized _even if latency passes_. Classify the hooks: cold vs hot, security-relevant vs not — the migration set is the intersection of "fast enough" AND "fine to make opaque."
- **Bootstrapping (node_modules path only):** the `node_modules`-bin resolver needs `bun install` to have run — but the `dependency-readiness` hook guards exactly that, so it (and `session-bun-check`) must stay materialized on that path. The **`bunx` path sidesteps this** (no node_modules), at the cost of bunx's cold-cache fetch after a pin change. Document which resolver carries which constraint.
- **Pin coherence:** `.safeword/version` ↔ the pinned `safeword` version (in the hook command string and/or package.json) must move together — confirm the existing upgrade flow's version sync covers it.
- **Cross-agent wiring shape** for Cursor (`.cursor/hooks.json`) and Codex (`config.toml`) — note the command string each needs; do NOT implement.

## Explicitly out of scope (this is a spike)

- Migrating the other 51 hook/lib files.
- Solving bootstrapping cleanly (just expose it).
- Cursor/Codex wiring (just document the command shape).
- Any production code that ships — the prototype is throwaway; the deliverable is the **numbers + the go/no-go + migration strategy** written back here.

## Done when

- [ ] Latency matrix recorded (baseline / lean-via-`node_modules`-bin / lean-via-`bunx@pin` / naive comparison), cold + warm.
- [ ] Go/no-go stated against the ~1.5×-baseline bar, **with non-JS viability read off the `bunx` number**, and the resulting migration strategy (all-hooks vs hot-stay-materialized vs JS-only-fast-path).
- [ ] Eligibility classification done: which hooks are fast-enough AND fine-to-make-opaque (security-relevant edit-gating hooks may stay materialized regardless).
- [ ] One-agent (Claude) wiring smoke test passed with identical hook behavior.
- [ ] Pin-coherence + per-resolver bootstrapping + cross-agent-wiring-shape notes captured for the epic.

## Premortem

The spike greenlights on a warm cache + a light hook, then real hot hooks drag the dynamic-import graph back to full-CLI cost in production. Mitigation: use the genuinely heavy `post-tool-quality` (real lib imports) and measure **cold** as well as warm.

## Work Log

- 2026-06-20T16:06:00Z Amended after a steelman correction: safeword **already** uses the CLI in every project via `bunx` (setup + the auto-upgrade hook), so "non-JS projects break" was overstated — bunx works everywhere bun does. Downgraded non-JS resolution from a standalone co-gate to "read off the `bunx` latency number." Reframed the protocol as a latency matrix across resolvers (baseline / `node_modules`-bin / `bunx@pin`), and added the **eligibility axis** (transparency/auditability — security-relevant edit-gating hooks may stay materialized regardless of latency). Resolution recommendation no longer pre-commits to devDep.
- 2026-06-20T14:57:43.620Z Created. Conceptual /figure-it-out done: gating risk is hot-hook latency; prototype measures 3 paths (baseline/naive/lean) on the hottest hook; resolution recommendation = local devDep bin; bootstrapping (readiness hook) flagged. Throwaway prototype; deliverable is the decision.
