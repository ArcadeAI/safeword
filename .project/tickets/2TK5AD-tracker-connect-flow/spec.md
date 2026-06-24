# Spec: Tracker connect/onboarding flow — interactive wiring (when + where the human authorizes)

## Intent

Make wiring a tracker a clear, opt-in, human-in-the-loop flow: the agent prepares
the non-secret config and orchestrates, the human does the steps only they can
(authorize OAuth / paste a token / install the GitHub App), and the agent verifies
the connection before any real sync — closing the "set-but-silently-broken" trap
and making the first `sync-tracker` run succeed without `--reset-tracker-map`.

## References

- Sibling: `JS5K5G` (sync-tracker — projection mechanics; this configures + verifies what it uses, and seeds its sidecar).
- `M1FGRJ` (v2 graph projection), `#347`, `#361` — downstream of the projection, not this flow.

## Personas

- **Technical Builder (TB)** — a developer running an agent who wants their team's tracker connected and trusts the agent to prepare config + verify, while they do the auth steps only a human can.

## Vocabulary

- **connect** — the act of wiring a provider: write non-secret config, store the secret out-of-repo, verify, seed the sidecar.
- **handoff** — the per-provider human step (browser OAuth / App install / paste PAT) the agent prints and waits on.
- **verify** — a non-destructive identity/auth check (WhoAmI) run before declaring the connection live.

## Jobs To Be Done

### tracker-connect-flow.TB1

**Persona:** Technical Builder (TB)

> When I want my agent to mirror tickets to my team's tracker, I want a guided,
> opt-in flow where the agent prepares the config and walks me through only the
> steps I can do (authorize OAuth / install the App / paste a token) and then
> verifies it works, so I'm never silently half-connected and the first sync just
> works.

Acceptance Criteria:

#### tracker-connect-flow.TB1.AC1 — setup offers connect, opt-in, default no

`safeword setup` offers to connect a tracker with a single yes/no prompt
defaulting to **no**. Declining leaves the project inert (`provider: none`) — no
config provider, no secret, no sidecar. The offer is never forced.

#### tracker-connect-flow.TB1.AC2 — connect writes non-secret config and prints the handoff

`safeword connect <provider>` writes the **non-secret** provider/target to
`.safeword/config.json`, then prints the exact per-provider human steps and waits
(Linear → Arcade OAuth authorize; GitHub → install the `safeword[bot]` App or
paste a PAT). Re-running with a different provider updates the config, leaving no
stale provider.

#### tracker-connect-flow.TB1.AC3 — secrets to keychain/env, never config, never logged

The credential is stored in the OS keychain (preferred) or an env var, **never**
written to `.safeword/config.json`, and never logged or echoed.

#### tracker-connect-flow.TB1.AC4 — verify before first sync

After wiring, connect runs a non-destructive identity/auth verification (WhoAmI).
On success it reports the connection is live; on failure it reports **not
connected** and names the missing piece (no credential / wrong scope / App not
installed).

#### tracker-connect-flow.TB1.AC5 — a successful connect seeds the empty sidecar

A successful connect writes an empty `.safeword/tracker-map.json` (JS5K5G's
contract: present + empty = first run), so the first `sync-tracker` run projects
instead of refusing. A failed verification does not seed it.

#### tracker-connect-flow.TB1.AC6 — pollution opt-ins offered at connect

Connect offers the pollution opt-ins; accepting writes a project-root
`.cursorindexingignore` and a `.gitattributes` generated-marker for `INDEX*.md`.
Declining writes neither.

#### tracker-connect-flow.TB1.AC7 — an unsupported provider is rejected cleanly

`connect <provider>` for an unsupported provider is rejected with a clear message
and performs **no** partial wiring (no config, no secret, no sidecar).

#### tracker-connect-flow.TB1.AC8 — setup delegates to the connect flow

When the `setup` offer is accepted, it runs the same connect flow rather than a
duplicate inline implementation — one code path, so setup-connect and
standalone-connect can't diverge.

## Outcomes

- A developer can go from `provider: none` to a verified, ready-to-sync tracker in
  one guided command, or decline and be unaffected.
- A misconfiguration is caught at connect time (named), never as a silent no-op at
  sync time.
- The first `sync-tracker` run after connect projects without `--reset-tracker-map`.

## Open Questions

- Setup inline vs delegate — RESOLVED: `setup` offers a one-line yes/no that
  delegates to the connect flow (no duplicate inline logic). See AC8.
- Verification depth — RESOLVED: v1 verifies auth via a non-destructive WhoAmI; a
  real one-ticket write-scope dry-run is deferred (would risk a side effect during
  connect). See AC4.
