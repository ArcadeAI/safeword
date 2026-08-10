# Dimensions: Offload tests without blocking local work

Derived from [spec.md](./spec.md). These partitions separate validation,
eligibility, dispatch authority, execution, recovery, and evidence so a success
on one boundary cannot conceal a failure on another.

| Dimension | Partitions | Rules |
| --- | --- | --- |
| Project choice | opted out / newly opted in / already managed / customer-modified managed file / disabling | TBU1.R1, TBU1.R8, NTB1.R1 |
| Requested lane | done / full / unknown or malformed | TBU1.R2, TBU1.R4, TBU1.R9, TBU1.R10 |
| Local Git state | clean pushed branch tip / dirty / unpushed / detached / tag or abbreviated ref / fork-origin or other repository | TBU1.R2, TBU1.R4, TBU1.R9, NTB1.R3 |
| GitHub readiness | authenticated / unauthenticated / workflow absent / unsupported host or repository / workflow identity diverged before dispatch | TBU1.R4, TBU1.R12, NTB1.R3 |
| Dispatch response | 200 with positive run ID / 200 without ID / 204 / conclusive GitHub rejection with request ID / redirect / transport ambiguity / proxy response / timeout / rate limit / 5xx or other status | TBU1.R3, TBU1.R4, TBU1.R5, TBU1.R7 |
| Dispatch attempt count | first attempt / automatic retry or redispatch | TBU1.R3, TBU1.R5, TBU1.R11 |
| Run lifecycle | queued / running / success / test failure / cancelled / infrastructure failure / interrupted watch | TBU1.R3, TBU1.R6, TBU1.R11, NTB1.R2 |
| Correlation state | recorded positive run ID / no ID and exactly one frozen-identity match / no visible match / duplicate matches / user-selected matching ID / selected mismatching ID | TBU1.R3, TBU1.R5, TBU1.R11 |
| Correlation clock | local or GitHub clock stable / skewed / moved backward or forward — informational only, never an identity filter | TBU1.R11 |
| Pending-record integrity | valid MAC and supported schema/key / missing or changed key / invalid MAC or edited field / newer schema / retired supported identity / duplicate open token | TBU1.R11, TBU1.R12 |
| Workflow source | expected default-branch SHA and exact bytes / branch moves after preflight and changed code may start / changed source SHA / changed bytes / renamed or missing / customer-configured hash | TBU1.R2, TBU1.R8, TBU1.R12 |
| Workflow input | valid lane, token, full SHA, canonical branch ref / invalid lane / moved ref before validation / direct or replayed dispatch / shell-shaped data | TBU1.R7, TBU1.R9, TBU1.R10 |
| Workflow privilege | contents read only, pinned actions, exact CLI / elevated permissions / unpinned or pre-validation executable helper / supplied secret | TBU1.R7, TBU1.R12 |
| Plan resolution | done resolves kind test / full resolves kind verify / unavailable plan entry / ordered commands with working directories and exits | TBU1.R2, TBU1.R4, NTB1.R1 |
| Local fallback authority | ineligible preflight / conclusive rejection / accepted dispatch / indeterminate dispatch / authoritative remote conclusion | TBU1.R4, TBU1.R5, TBU1.R6, NTB1.R3 |
| Local boundary fingerprint | stable matching / changed / unstable / unreadable or special entry / file, byte, or time limit exceeded | TBU1.R13 |
| Local command result | zero / nonzero, crossed with every fingerprint partition | TBU1.R13, NTB1.R2 |
| Local evidence limitation | ignored files / environment / external tools / non-participating writers / out-of-repository dependency / possible ABA change | TBU1.R13 |
| Upgrade transaction | unchanged managed base / customer divergence / crash before replace / crash after one replace / state matching neither journal side / supported pending old reader | TBU1.R8, TBU1.R11, TBU1.R12 |
| Durable publication phase | initial opt-in or pending-record failure containment / later retry from a frozen absent-or-complete state | TBU1.R1, TBU1.R3 |
| Report audience | technical identifiers and resume command / plain-language state and next action | TBU1.R3, TBU1.R5, TBU1.R11, NTB1.R2 |

## Partition notes

- Request validity precedes remote eligibility. Invalid input executes nowhere;
  a valid but ineligible request may use local fallback.
- HTTP 200 with a positive run ID is the only immediate acceptance boundary.
  Any response that could hide a created run is indeterminate, never fallback.
- Once accepted, the remote conclusion is authoritative even for failure,
  cancellation, or infrastructure error. An explicit later local rerun is a new
  user action, not automatic recovery.
- The pending record is written before POST and authenticated locally. Resume
  may correlate a run but may never redispatch or authorize fallback.
- Workflow trust is exact-byte and version-frozen. Configuration cannot bless
  different bytes, and post-dispatch divergence is an integrity failure.
- Local fingerprint integrity takes precedence over the command exit. Only
  matching endpoints permit `local failure` or `passed with evidence limits`;
  every other fingerprint state is indeterminate with the raw exit reported
  separately.
- The required public-CLI disposable-repository path is a distinct live
  contract partition, not replaceable by mocks.
