---
id: 2TK5AD
slug: tracker-connect-flow
type: feature
phase: done
status: done
depends_on: [JS5K5G]
created: 2026-06-22T13:41:56.003Z
last_modified: 2026-06-24T05:11:00Z
scope:
  - Two opt-in entry points — `safeword setup` offers tracker connect with a single yes/no prompt (default NO; resolved open question: setup delegates to the connect flow, it does not inline its own), and a standalone `safeword connect <provider>` command for later setup / re-config / switching providers.
  - Per-provider human handoff — the agent writes the non-secret config (provider/target), then prints the exact credential steps and waits — Linear via Arcade OAuth authorize (browser approve), GitHub via the `safeword[bot]` GitHub App install or a pasted PAT fallback.
  - Verify-before-first-sync — after wiring, run a no-op identity/auth verification (WhoAmI) and report pass/fail; on failure name the exact missing piece (no credential, wrong scope, App not installed). Resolved open question — v1 verifies auth via WhoAmI (non-destructive); a real one-ticket write-scope dry-run is noted as a follow-up.
  - Seed the empty `.safeword/tracker-map.json` sidecar on successful connect — this is the JS5K5G contract (present+empty = first run; absent = refuse), closing the "first run needs --reset-tracker-map" gap.
  - Secrets — token to OS keychain (preferred) or env var; never `.safeword/config.json`; never logged. (Reuses JS5K5G's secret-resolution rules.)
  - Pollution opt-ins offered at connect time — `.cursorindexingignore` for the project root and a `.gitattributes` generated-marker for `INDEX*.md`.
  - All external auth/verify/keychain I/O injected so the orchestration is tested with real internal components, mocking only the boundary (no live tracker/keychain in tests).
out_of_scope:
  - The projection mechanics (JS5K5G) and the dependency-graph/board projection (M1FGRJ).
  - Two-way auth / token-rotation automation — manual re-`connect` for v1.
  - A dedicated CI service-identity broker (JS5K5G open question) — surface the limitation, don't solve it here.
  - Actually performing the live OAuth/App-install handshake in tests — the human/browser/Arcade steps are the untestable boundary; only the orchestration around them is covered.
done_when:
  - `safeword setup` offers tracker connect (opt-in, default no) and a standalone `safeword connect <provider>` command exists.
  - Each supported provider (Linear, GitHub) has a documented human-handoff path (OAuth / App / PAT) with the agent printing the exact steps and waiting.
  - Connect ends with a verification call that reports pass/fail and names the missing piece on failure.
  - Secrets land in keychain/env, never committed config; connect offers the `.cursorindexingignore` + `.gitattributes` opt-ins.
  - A successful connect seeds the empty `.safeword/tracker-map.json` so the first `sync-tracker` run does not refuse.
  - Orchestration covered by unit + wiring tests with the auth/verify/keychain boundary mocked; no live tracker or keychain in tests.
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

- 2026-06-24T05:11:00Z Complete: implement → verify → **done**. Built the flow across 5 steps (`a582747` ports+handoff, `17cffeb` orchestration AC2–AC7, `1d719f4` command+wiring test+live shims, `4375205` setup offer AC1/AC8, plus the verify-phase `3adfbc3` composition-root refactor and `2ad28e2` review refinements). All 8 ACs implemented and tested through the real orchestration with only the boundary (prompt/secret-store/verify) mocked (#363). **Verify:** full suite 3465 passed | 5 skipped, 0 failures; typecheck/eslint/gherkin/prettier/depcruise clean. **/audit:** 0 arch violations; no unused exports in tracker-connect (the lone unused export is JS5K5G's). **/quality-review** (independent fresh-context): APPROVE, no criticals — applied two refinements (handoff text matches env-only v1; dropped a duplicated keyset). depcruise caught a `setup.ts→connect.ts` cross-command import mid-verify → fixed by extracting `tracker-connect/run.ts` (both entry points call `runConnect`). Scope held; no new behaviors emerged outside test-definitions. Linear verify + OS-keychain storage are documented v1 deferrals (surfaced, not silent). verify.md written.
- 2026-06-24T03:50:00Z Complete: define-behavior. JS5K5G shipped (PR #349) → unblocked. Building on a stacked branch `claude/tracker-connect-flow-2tk5ad` off the #349 branch (own PR, base=#349 branch) to keep it independently reviewable. Resolved both open questions (setup delegates to connect; verify = non-destructive WhoAmI). Authored spec.md (JTBD tracker-connect-flow.TB1, persona TB, 8 ACs), dimensions.md, features/tracker-connect-flow.feature (13 scenarios / 7 rules, @wip — proof in vitest), test-definitions.md. AC-coverage clean. Applying the #363 lesson: the impl will be tested through the real orchestration with only the boundary (keychain / auth-verify client / prompt) mocked, incl. a command-level wiring test. Advanced to scenario-gate.
- 2026-06-22T13:41:56.003Z Started: Created ticket 2TK5AD.
- 2026-06-22T13:42:00Z Filed as the sibling to JS5K5G (per the birthplace rule: execute-now-ish wiring work → internal-first). Owns the human handoff JS5K5G's setup section was thin on: when (setup opt-in + `connect` command), where (per-provider auth: Arcade OAuth / GitHub App / PAT), and verify-before-sync. `depends_on: JS5K5G`; status blocked until the projection skeleton lands.
