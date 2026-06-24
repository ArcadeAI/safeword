---
id: 2TK5AD
slug: tracker-connect-flow
type: feature
phase: intake
status: blocked
depends_on: [JS5K5G]
created: 2026-06-22T13:41:56.003Z
last_modified: 2026-06-22T13:42:00Z
---

# Tracker connect/onboarding flow — interactive wiring (when + where the human authorizes)

> **Sibling of [sync-tracker (JS5K5G)](../JS5K5G-sync-tracker/ticket.md).** JS5K5G owns the projection _mechanics_ (the _what_ of config); this ticket owns the human-in-the-loop _wiring_ — the _when_ it's triggered and _where_ the human authorizes. `depends_on: JS5K5G` (it configures + verifies what sync-tracker uses). Blocked until the projection skeleton exists to verify against.

**Goal:** Make wiring a tracker a clear, opt-in, human-in-the-loop flow: the agent prepares config and orchestrates, the human does the steps only they can (authorize OAuth / paste a token / install the GitHub App / pick team+repo), and the agent **verifies before any real sync** — closing the "set-but-silently-broken" trap.

**Why:** safeword is agent-driven, but connecting a tracker needs actions the agent can't take. The design says config _exists_ (JS5K5G) but not _when_ it's triggered or _where_ the agent hands off to the human. Without a defined handoff, users hit silent failures (provider set, no credential) or never connect at all.

## Scope

### When — two opt-in entry points

- **`safeword setup` offers it** with a single prompt, **default no** (most projects start `provider: none`). Never forced.
- **`safeword connect <provider>`** standalone command for later setup / re-config / switching providers.

### Where — the per-provider human handoff

The agent writes the non-secret config (provider/target) and walks the human through the credential step, which differs per provider:

- **Linear (via Arcade):** trigger the Arcade OAuth authorize flow; the human approves in-browser. Token handled by Arcade; safeword stores only the Arcade key (keychain/env).
- **GitHub:** install/authorize the **GitHub App** (`safeword[bot]`) for the target repo, or fall back to a PAT the human pastes. Stored in keychain/env, never config.
- The agent prints exactly what to do and where, waits, then proceeds.

### Verify before first sync

After wiring, run a no-op verification (`WhoAmI` / a single dry-run projection) and report pass/fail. A green check is the signal the connection is live; a failure names the exact missing piece (no credential, wrong scope, App not installed).

### Secrets + pollution opt-ins (carry from JS5K5G)

- Token → OS keychain (preferred) or env var; never `.safeword/config.json`; never logged.
- Offer the pollution opt-ins at connect time: `.cursorindexingignore` for the project root + the `.gitattributes` generated-marker for `INDEX*.md`.

## Out of scope

- The projection mechanics (JS5K5G) and the dependency-graph/board (M1FGRJ).
- Two-way auth / token rotation automation — manual re-`connect` for v1.
- A dedicated service-identity broker for CI (JS5K5G open question) — surface the limitation, don't solve it here.

## Done when

- `safeword setup` offers tracker connect (opt-in, default no) and `safeword connect <provider>` exists.
- Each supported provider (Linear, GitHub) has a documented human-handoff path (OAuth / App / PAT) with the agent printing the exact steps.
- Connect ends with a verification call that reports pass/fail and names the missing piece on failure.
- Secrets land in keychain/env, never committed config; connect offers the `.cursorindexingignore` + `.gitattributes` opt-ins.

## Open questions

- **Setup prompt vs fully separate command** — does `setup` inline a minimal connect, or just point to `safeword connect`? Lean: setup offers a one-line yes/no that delegates to `connect`.
- **Verification depth** — `WhoAmI` only, or a real dry-run projection of one ticket? Lean: dry-run one ticket (proves write scope, not just auth).

## Work Log

- 2026-06-22T13:41:56.003Z Started: Created ticket 2TK5AD.
- 2026-06-22T13:42:00Z Filed as the sibling to JS5K5G (per the birthplace rule: execute-now-ish wiring work → internal-first). Owns the human handoff JS5K5G's setup section was thin on: when (setup opt-in + `connect` command), where (per-provider auth: Arcade OAuth / GitHub App / PAT), and verify-before-sync. `depends_on: JS5K5G`; status blocked until the projection skeleton lands.
