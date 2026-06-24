# Dimensions: tracker connect/onboarding flow (2TK5AD)

Derived from the ticket's scope / done-when / resolved open questions. Each
partition → ≥1 scenario; boundaries inline. Per #363, behaviors are exercised
through the real orchestration with only the external boundary (keychain, the
provider auth/verify client, the interactive prompt) mocked.

| Dimension           | Equivalence classes / boundaries                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------------------- |
| Entry point         | `setup` offer (default NO) · standalone `safeword connect <provider>`                                       |
| Setup-offer outcome | declined → stays inert (`provider: none`) · accepted → **delegates** to the connect flow (no inline copy)   |
| Target provider     | `linear` (Arcade OAuth) · `github` (App install / PAT fallback) · unsupported (rejected)                    |
| Config write        | non-secret provider/target written to `.safeword/config.json` · secret **never** written to config          |
| Secret storage      | keychain (preferred) · env-var fallback · never config · never logged                                       |
| Human handoff       | prints the exact per-provider steps and waits (browser OAuth / App install / paste PAT)                     |
| Verification result | pass (auth resolves → "connected") · fail (names the missing piece: no credential / wrong scope / no App)   |
| Sidecar seeding     | success → empty `tracker-map.json` written (first sync won't refuse) · failure → not seeded                 |
| Pollution opt-ins   | offered · accepted → `.cursorindexingignore` + `.gitattributes` marker written · declined → neither written |
| Re-connect / switch | connecting a new provider updates config, leaving no stale provider                                         |

## Notes

- The live OAuth/App-install/PAT handshake is the **untestable boundary** (human +
  browser + Arcade/GitHub). Tests cover the orchestration around it: prompts,
  config writing, secret routing, sidecar seeding, opt-in files, verify dispatch,
  and the pass/fail messaging — with the boundary clients injected.
- Seeding the empty sidecar is the load-bearing tie to JS5K5G (its AC9: present+empty
  = first run; absent = refuse). This flow is what makes a first `sync-tracker` run
  succeed without `--reset-tracker-map`.
