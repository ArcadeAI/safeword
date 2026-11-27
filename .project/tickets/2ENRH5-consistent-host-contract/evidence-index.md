# 2ENRH5 evidence index

The full ticket history lives on the retained `codex/2enrh5-headless-qualification`
branch at `44cf8f2fae94ef6f25151255cad05ed28ac4006a`. Paths beginning with
`evidence/` in the ticket’s historical notes refer to that branch.
The delivery history keeps product changes, ticket decisions, and this index.

| Observation | Tested source | Archive record | Outcome |
| --- | --- | --- | --- |
| Combined headless run | `4a15019bbbd316f1f6bb3b3544fa9ab15533645f` | `evidence/headless-current-qualification.md` | Five deliveries passed propagation and stale-installation repair, and 31 native cases passed. The qualification gate returned exit 3 for incomplete evidence. |
| Codex normal hook trust | `9dfdfbac2` | `evidence/headless-propagation-20261123.md` | Codex 0.167.0 reported five trusted hooks. The allowed write reached disk and the denied write left no file. |
| OpenCode release package and lifecycle | `39a47ac6d` | `evidence/opencode-standard-release-verification.md` | Packaged OpenCode 2.4.1 and the public lifecycle passed. |
| Cursor IDE scope transfer | `44cf8f2fae94ef6f25151255cad05ed28ac4006a` | `ticket.md` and `../XHMWSC-qualify-cursor-ide-on-isolated-desktop/ticket.md` | XHMWSC owns the IDE qualification and the combined seven-delivery demo. |

The combined headless run’s component report SHA-256 is
`546a23b805133ab8be3b992352226d2cc04f1d7ba369975d03b857e71225d864`.
Its propagation report SHA-256 is
`c8056f359599d3d27d3453e8579415d667eee19b6bc8c37301c0a18d2fbc1a55`.
Both hashes were checked against the retained reports during delivery preparation.
These results apply to the source and package revisions in their records.

## Integration with main

Main removed the cross-model review requirement in `da2778353`. The shared
architecture gate follows main’s current rule and still checks the plan and its
receipt. The archival original-author control exercised the old requirement.
The integration tests run the installed project Stop hook with fixture review
responses. They check current approval, a subsequent plan edit, and a review
that requested changes. Native qualification still requires a current run. The wiring grader remains an isolated
test and retains the existing model-pair check.

The headless Codex handoff fixture drives the native app server and installed
Stop hook with scripted model replies. It checks how the hook handles the
handoff settings. Spontaneous model behavior requires separate evidence.

The [archived historical RED disposition](https://github.com/ArcadeAI/safeword/blob/44cf8f2fae94ef6f25151255cad05ed28ac4006a/.project/tickets/2ENRH5-consistent-host-contract/evidence/ordinary-request-historical-red-disposition.md)
records the approved exception for the ordinary-request scenario alone. Its
historical RED receipt is missing. Current native verification remains required.
