# Test Definitions: Protect retro filing from malformed GitHub CLI credentials

**Scope:** Integration tests in `packages/cli/src/retro/github-rest.test.ts`, using the real resolver and REST transport while mocking only the `gh` subprocess boundary.

| ID | Behavior | Setup | Assertion |
| --- | --- | --- | --- |
| TD-1 | Reject unsafe `gh` output | Rejected `GITHUB_TOKEN`; mocked `gh` returns a value with a space | `resolveGitHubToken()` is undefined and `createRestTransport()` is undefined |
| TD-2 | Preserve real child environment | Supply a lookup-only environment; set a process-only marker; mocked `gh` returns a valid credential | Resolution succeeds and `gh` receives the process marker but no `GITHUB_TOKEN` |
| TD-3 | Preserve explicit `GH_TOKEN` | Rejected `GITHUB_TOKEN`; set `GH_TOKEN`; mocked `gh` returns a valid credential | `gh` child environment includes `GH_TOKEN` and excludes `GITHUB_TOKEN` |
| TD-4 | Isolate mocks between tests | Reset mocks in `afterEach` | Every subprocess-dependent test explicitly sets its own response |
| TD-5 | Accept one terminal line ending only | Mocked `gh` returns a valid credential followed by one LF or CRLF | Resolution succeeds; leading/trailing whitespace and repeated line endings remain rejected |
| TD-6 | Remove token keys case-insensitively | Lookup-only rejected token; process context has a differently cased `github_token` | The `gh` child environment excludes differently cased `GITHUB_TOKEN` keys |

## Completion

- [x] TD-1 — added RED→GREEN integration coverage at the resolver-to-transport boundary.
- [x] TD-2 — added RED→GREEN process-boundary coverage with a process-only marker.
- [x] TD-3 — retained and passed the #1602 child-environment regression.
- [x] TD-4 — added a regression proving no earlier mock response can leak.
- [x] TD-5 — added terminal LF/CRLF acceptance and malformed-whitespace rejection coverage.
- [x] TD-6 — added a case-insensitive Windows child-environment regression.

The test scope is integration because it validates the real resolver-to-transport behavior and mocks only the external subprocess boundary.
