# Native command invocation and canonical resources

PR 2 native command component, bound to Scenario: Native delivery exposes the
contracted catalogue, exact OpenCode V2 2.0.32 CLI/TUI rows. This supplements the
existing skill-tool catalogue proof and does not complete the full outline,
required registration/status work, or customer admission.

The common canonical catalogue probe now accepts a workflow name, defaulting to
the unchanged explain probe used by other hosts. This command probe varies bdd,
an existing command target, through the production portable catalogue writer
and SDK generator. It reuses the same canonical workflow, guide and helper
markers and bundled-runtime readiness check. The setup artifact is deleted
before the actual command. Only fixture legacy resources are removed, preventing
an old project/profile copy from satisfying the new native binding.

The real CLI's run entrypoint sends ordinary prompt text; it does not execute
slash commands. Its public api entrypoint invokes session.command. The driver
starts an owned loopback native server on an ephemeral port with an ephemeral
test credential, creates an isolated session through the real CLI, invokes
session.command with name safeword-bdd and a distinct argument nonce, and reads
native plugin state after activation. Only the exact native CommandNotFoundError
for that name is an expected command rejection; unrelated setup errors are
unavailable. Successful invocation waits through the actual native session wait
API and reads native messages through the CLI. The driver kills only its owned
server at teardown. It never changes a shared profile/service or supplies a
permission decision.

The real TUI submits /safeword-bdd plus the nonce through its normal prompt path.
Its independent prompt observer must see that exact submission when no workflow
loads. Both paths require an active exact candidate and matching package bytes
before the product assertion. The selected workflow's canonical content must
reach the actual model context; the scripted model derives guide/helper commands
only from that received content and its native base directory. It supplies no
workflow body, resource path repair or canned helper output. GREEN requires the
argument nonce preserved, canonical guide content, actual helper marker and its
filesystem result identifying the candidate runtime/template.

The test terminal has an explicit 160-column geometry using Python's public
termios.tcsetwinsize on the real PTY. The former implicit 80-column terminal
clipped the end marker horizontally after a long slash-command input and caused
a false timeout. This changes test geometry only; it preserves native dispatch
and the normal Ctrl-C exit, never treating timeout as RED.

Final author run /tmp/safeword-opencode-command-red-final-author.log exits 2:
both runtimes reach NATIVE_OPENCODE_V2_COMMAND_MISSING after valid native setup
and actual command invocation. Lint and CLI typecheck pass. No native SDK command
registration has been implemented before independent RED review.

Primary sources verified against the pinned target:
[CLI api entrypoint](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/cli/src/commands/handlers/api.ts),
[native command invocation](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/core/src/session/command.ts),
[TUI command submission](https://github.com/anomalyco/opencode/blob/v2.0.32/packages/tui/src/component/prompt/index.tsx),
[SDK command transforms](https://github.com/anomalyco/opencode/blob/v2.0.32/services/www/src/docs/content/build/plugins/index.mdx),
[PTY geometry API](https://docs.python.org/3.12/library/termios.html#termios.tcsetwinsize).
