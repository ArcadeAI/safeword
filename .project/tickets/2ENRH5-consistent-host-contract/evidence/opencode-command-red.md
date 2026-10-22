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
The idle barrier is also called successfully on the new idle session as a
Given prerequisite, so a missing wait API cannot first appear as a GREEN-side
harness failure. The final barrier-check run still exits 2 at the intended
missing command in both runtimes, log /tmp/safeword-opencode-command-barrier-check.log.

The real TUI submits /safeword-bdd plus the nonce through its normal prompt path.
Its independent prompt observer must see that exact submission when no workflow
loads. Both paths require an active exact candidate and matching package bytes
before the product assertion. The selected workflow's canonical content must
reach the actual user-role model context; the scripted model derives guide/helper commands
only from that received content and its native base directory. It supplies no
workflow body, resource path repair or canned helper output. GREEN requires the
argument nonce preserved, canonical guide content, actual helper marker and its
filesystem result identifying the candidate runtime/template.
After review c38d3d95-b001-4da2-b152-2836205012a9, GREEN also requires native
command resolution: CLI's actual command call must not have been rejected, and
TUI's native prompt observer must see the expanded argument rather than the raw
slash text. Merely injecting workflow instructions into a system message or
passing an unknown slash command as ordinary text cannot pass. The following
independent execution must attest these strengthened, formatted sources before
production command registration begins.

The prototype exposed a harness-only readback mismatch: the SDK facade calls
message.list, while the exact CLI OpenAPI operation is session.message.list.
The driver now proves that operation on the initial idle session too, and GREEN
requires workflow, guide, helper and argument markers in the actual native CLI
message projection as well as native model/tool/filesystem observations. The
uncommitted production prototype was preserved separately and fully restored to
the no-command baseline before this fresh executable RED review. Its author
rerun again exits 2 for both missing native commands:
/tmp/safeword-opencode-command-restored-red.log. No failed readback was treated
as product RED or GREEN.

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

The combined native regression exposed a startup-prompt race: TUI `--prompt`
can submit before its frontend command catalogue is populated. The driver now
starts the command TUI interactively, waits for the real input placeholder,
types an independent observer-only readiness command without executing it,
and waits until that command's unique description is rendered in native
autocomplete. It then erases that text, pastes the actual tested command and
argument, waits for its argument to render, and presses Enter. The readiness
command cannot supply workflow content, permissions or the tested command.
There are no timing sleeps or product outcome substitutions. The same driver
passes the working prototype (ready-green-2.log); production command sources
were restored again before the fresh missing-command run and review.
