# Dimensions: Choose local or remote test execution per contributor

| Dimension | Partitions |
| --- | --- |
| Preference source | command override with valid lower scopes; command override with invalid personal config; personal config; project default; built-in local |
| Personal config | absent; valid local; valid remote-preferred; malformed/unknown; unsafe filesystem object |
| Provider state | remote not installed; later installed provider (contract only) |
| Requested lane | done; full; invalid |
| Observable output | effective mode and origin; local fallback reason; exact local-plan exit; invalid-config error |
| State change | none for request/status; additive `.gitignore` personal entry during setup |

The child does not dispatch remotely. Its remote-preferred partition is the
proven-no-dispatch local fallback owned by this slice; actual provider
installation and dispatch are covered by X2Z8MN and S2TF4J.
