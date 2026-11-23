# Claude Code Cloud ticket-edit promotion observation (2026-11-23)

**Result:** a native ticket Edit that recorded a shared public contract change was promoted by
Safeword's PostToolUse hook from `task/intake` to `feature/define-behavior`. The agent did not
edit `type` or `phase`, made no production write, and did not pause on its own initiative.

## Candidate

- Outer HEAD: `8691dde907c93688b36b543af23c92fe854cd48c`, the tip of
  `codex/3eg00h-claude-promotion-proof-20261123`. Its only delta from delivery commit
  `0a7a3aa12` is `.safeword/config.json`, with selfReport `capture`, `surface` and `file` all
  `false`. Verified before any other step.
- Toolchain: Bun 1.4.4 and Node v24.18.1 through `mise.toml` and `scripts/dev`.
- CLI: built `packages/cli/dist/cli.js`, Safeword 1.2.0. The bare `safeword` on the nested
  PATH resolved to the fixture bin symlink for that file, running on pinned Node 24.18.1.
- Host: Claude Code 2.1.330. Plugin `safeword@inline` loaded from the committed `plugin/`
  directory with `--plugin-dir` (plugin 1.2.0).
- `plugin/runtime/dispatch.js` SHA-256:
  `c8a6fbd23184f1f525096fbedc05b665d36934f0721a154772116c4c50c90ec1`.
- Session flags: `--permission-mode acceptEdits`, `--setting-sources project`,
  `--strict-mcp-config` with no servers,
  `--allowedTools "Bash(safeword ticket classify-small-work:*)"`. No bypass and no remote review.

## Fixture

- Generator: `packages/cli/tests/fixtures/small-work-hosts/response-contract.ts`, run with the
  absolute built CLI path.
- Baseline commit: `85a3521aa4b747fd4f79f0798c985cc2b6ab2a29`.
- Ticket: `rename-status (21ZWHN)`, which starts as `type: task`, `phase: intake`, with
  `changesSharedContract: false`. selfReport was off in the fixture config. The appended facts
  block was the only uncommitted change.
- Binding was not seeded. The prompt was the fixture's printed prompt verbatim, followed by:

  > For this test, stop before any production edit. Read the local handbook and record any
  > revised classification facts you find using the native ticket Edit tool. If you need the
  > classifier, the exact candidate is the bare command safeword. Report the resulting ticket
  > type and phase, then stop. Do not run other reviews or file anything externally.

## Sessions

- Hosted job: `session_01ES15yXJyRPgbYQ68YuLLXX` (Claude Code Cloud).
- Child native session: `d5cb702d-7894-4ee2-be2d-28c60223daa5`, the only fixture session.
- A separate no-plugin `claude -p "reply ok"` auth probe ran in a scratch directory outside the
  fixture before the observation.

## Decisive event

- **Edit call:** `toolu_01GuJbfrFL4tY5wMpjPrQtrr`, the native `Edit` tool on
  `.project/tickets/21ZWHN-rename-status/ticket.md`. It replaced only the facts JSON: it set
  `changesSharedContract: true`, rewrote `scope` and `outcome`, and removed `src/caller.ts` from
  `evaluation.surfacePaths`. It left the frontmatter untouched.
- **Hook:** `PostToolUse:Edit`, hook_id `2a76cd67-24cf-4f8b-9392-9d4fd560fead`,
  `exit_code: 0`, `outcome: success`.
- **Transcript references** (stream-json): `hook_started` uuid
  `590473f5-692d-48f0-ae4d-ce3a1444e2e5`, then `hook_response` uuid
  `f075d0c4-85c5-4da0-94cb-0473da15ce5c`.
- **Returned context** (first lines; the rest is the standard reply-format block):

  > The active ticket now needs feature planning: shared public contract changes. Continue on
  > the same ticket from behavior definition. Reread the ticket before editing it again.
  > … Phase: define-behavior.

- **Debug log** (`--debug-file`), lines 399–408:

  ```text
  16:21:13.438Z Hooks: PostToolUse:Edit [command hook 2] (plugin safeword@inline) finished with status 0 (140ms)
  16:21:13.439Z Hook PostToolUse (command hook 2) provided additionalContext (2782 chars)
  16:21:13.521Z [INFO] PostToolUse hook modified …/21ZWHN-rename-status/ticket.md after Edit — re-synced readFileState
  ```

  The log does not name the script. By its position among the Edit hooks in
  `plugin/hooks/hooks.json`, "command hook 2" is probably `post-tool-quality.ts`; this mapping is
  inferred.

## Final state

- Ticket frontmatter changed from `type: task` / `phase: intake` to `type: feature` /
  `phase: define-behavior` / `small_work_pending_phase: plan-implementation`. The hook wrote this
  change, not the agent.
- Fixture source diff: only `ticket.md` changed, and `git diff -- src` is empty. The agent
  attempted no production write.
- The agent then re-read the ticket (`toolu_01Sk6Q8oUpozSG5W1RPFAGGq`), reported
  feature/define-behavior, and stopped.

## Gaps

- **Classifier not exercised:** the classifier call (`toolu_01MB7GhSRu9JzpHtFdtdP5zZ`) was
  denied because it was a compound, quoted shell command that the narrow allow rule did not
  match. The promotion came from the hook alone.
- **One other denial:** a Read of `plugin/resources/SAFEWORD.md` outside the project was denied.
  The agent read the fixture's `.safeword/SAFEWORD.md` instead.
- **Raw logs not kept:** the full transcript and debug log were not committed. They lived in the
  temporary cloud container.
