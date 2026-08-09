# Dimensions: Make review coverage clear without false alarms (Z45MTC)

| Dimension | Partitions | Source |
| --- | --- | --- |
| Achieved coverage | standard best-available · independent | NTB1.R1, TBU1.R1 |
| Reviewer route | same-agent headless · host fresh-context · main-thread self-review · independent agent | NTB1.R1 |
| Requested policy | preference/best-available · explicit `require` | NTB1.R1, SWM1.R1 |
| Visibility | completion summary · details/status | NTB1.R1, TBU1.R1 |
| Guidance frequency | none in ordinary summary · user-requested detail | TBU1.R1 |
| Agent environment | independent configurable · independent unavailable · Claude local/cloud/web · Codex local/cloud · Cursor local/cloud | NTB1.R1, TBU1.R1 |

## Partition → scenario mapping

- Standard best-available × preference × CLI completion summary → “A permitted
  same-agent review completes with standard coverage.”
- Independent × preference × completion summary → “Independent coverage is a
  positive result.”
- Standard best-available × explicit `require` × completion summary → “Required
  independence is not presented as standard coverage.”
- Host fallback instructions × `prefer` → prescribe calm supplemental feedback
  without claiming standard completion or trusted provenance.
- Standard best-available × details/status → “Details offer an independent
  coverage upgrade on demand.”
- Standard best-available × details/status × independent unavailable → “Details
  do not advertise an unavailable independent upgrade.”
- Standard best-available × ordinary summary → “Ordinary completion does not
  repeat upgrade advice.”
- Standard best-available × explicit `require` → “Required independence stays
  unsatisfied.”
- Independent × explicit `require` → “Independent coverage satisfies a
  required policy.”
- Host fallback instructions × explicit `require` → prescribe supplemental
  feedback while keeping required independence unsatisfied.

## Boundary notes

- The same-agent fallback is a standard completed review only where the active
  policy permits it; `require` is the boundary that changes outcome semantics.
- Raw `independence` provenance remains available to integrations even when
  “degraded” is removed from ordinary user-facing language.
- A cloud runtime is a first-class normal environment, not an error condition.
- The two explicit-requirement rejection scenarios deliberately share setup but
  assert different channels: NTB1.R1 protects completion presentation, while
  SWM1.R1 protects the policy outcome. Collapsing them would lose one contract.
