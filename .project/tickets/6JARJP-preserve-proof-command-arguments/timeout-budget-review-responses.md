# Final timeout-budget review responses

Independent review d2f3caf0-a198-4e29-b5f8-9469007db083 approved the final
20-minute BDD / 40-minute native completion policy. Claude Opus reviewed Codex
in a separate headless process; the signed source-freshness check passed.

- **Aggregate deadline:** accepted as a limitation. This fixes the observed
  dogfood graph (one deduplicated BDD lane), not arbitrary workspace graphs.
  A shared deadline across resolution, all suites and retrospective work would
  require a separate runner change. No universal fail-closed deadline is claimed.
- **Process descendants:** accepted as existing behavior outside this surgical
  timeout repair. The misleading no-zombies comment was removed. The configured
  execSync timeout does not prove bounded process-tree termination.
- **Cursor edit budget:** accepted. Cursor's single Write binding cannot select
  a different host timeout by edited path. Existing failClosed remains true;
  ordinary edits still return without running the completion suites.
- **Manifest ordering and OpenCode literal:** retained as deliberate physical
  configuration pins. Reordering the first completion binding fails visibly;
  an intentional budget change requires updating the expected serialized value.
- **Timeout diagnostic test:** the real Node ETIMEDOUT object exercises the
  failure shape without waiting twenty minutes. Resolution remains real. This
  is distinct from the separately recorded complete source-adapter execution.

No blocking findings or required source changes remained. Installed-host
long-duration journeys were not performed; generated metadata and direct source
adapter execution are reported separately.
