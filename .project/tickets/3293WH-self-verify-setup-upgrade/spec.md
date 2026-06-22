# Spec: Auto-run health verification after setup & upgrade; stop treating check as a human command

> Child of epic [VKNF1T](../VKNF1T-platform-uplift-epic/ticket.md). Design forks
> settled by figure-it-out (2026-06-13): extract the health core, report +
> exit-1 (no repair), keep `check` public but de-emphasized, reuse the existing
> summary reporter with a parameterized remediation hint.

## Intent

A mutating command proves its own postcondition. `setup` and `upgrade` end by
running safeword's config-health verification (the same core `check` uses,
minus the npm update-check); a broken result is reported loudly with a
non-zero exit, a clean result stays to one success line. Humans stop being
told to run `safeword check` as a routine step — it remains a standalone
doctor-style diagnostic for CI and debugging.

## References

- [ticket.md](./ticket.md) — current-state survey (health core private in check.ts, update-check coupling, ~20 doc references)
- [469YSR](../469YSR-styled-output-leading-newline/ticket.md) — output-glyph fix that should land first or together (done)
- Doctor idiom prior art: `npm doctor`, `brew doctor` — standalone diagnostics stay public even where installs self-verify

## Personas

- **Technical Builder (TB)** — runs `safeword setup`/`upgrade` on their project and needs breakage surfaced at the moment it happens, not discovered sessions later.

## Jobs To Be Done

### self-verify-setup-upgrade.DEV1 — Know immediately when setup or upgrade left the project broken

**Persona:** Technical Builder (TB)

> When I run `safeword setup` or `safeword upgrade`, I want the command to
> verify the configuration it just wrote and fail loudly if it's broken, so I
> don't run sessions on a half-applied install I had no way to notice.

#### self-verify-setup-upgrade.DEV1.AC1 — Setup ends with a config-health verification: issues are reported and the command exits non-zero

#### self-verify-setup-upgrade.DEV1.AC2 — Upgrade ends with the same verification and failure semantics

#### self-verify-setup-upgrade.DEV1.AC3 — The self-verify is config-health only: no npm update-check, no network, no "update available" nag

#### self-verify-setup-upgrade.DEV1.AC4 — A clean result stays quiet: one health success line, no duplicate output walls

#### self-verify-setup-upgrade.DEV1.AC5 — A failing post-upgrade verification never tells the user to "run `safeword upgrade`" as the fix (remediation hint matches context)

### self-verify-setup-upgrade.DEV2 — Trust the install without learning safeword's diagnostic commands

**Persona:** Technical Builder (TB)

> When I install or upgrade safeword, I want health verification to happen
> without me knowing a separate command exists, so the tool carries its own
> quality bar instead of delegating it to my memory.

#### self-verify-setup-upgrade.DEV2.AC1 — Docs present `check` as an automatic step that also exists standalone (CI/debugging), not a routine human command

#### self-verify-setup-upgrade.DEV2.AC2 — Standalone `safeword check` behavior is unchanged by the extraction

## Outcomes

- A broken install/upgrade is caught at the command exit for every customer — zero "silent half-applied config" reports.
- No new human workflow step: nothing additional to remember or run.

## Open Questions

_None — the four intake open questions (fate of check, failure semantics,
advisory rewording, idempotence/noise) were resolved by the 2026-06-13
figure-it-out pass; decisions recorded in the header note and ticket work log._
