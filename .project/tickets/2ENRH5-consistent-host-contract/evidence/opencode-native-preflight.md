# OpenCode native boundary preparation

These are disposable setup experiments for the accepted PR 2 proof, not an
attested executable RED, shipped V2 integration or completed scenario evidence.
No production V2 policy adapter has been written.

## Decision: repeatable actual TUI execution

Figure-it-out frame: choose the smallest automated driver that executes the real
OpenCode TUI and exposes its native tool result. CLI evidence cannot satisfy a
TUI row. Domains investigated: actual terminal semantics, installed-host API
and configuration, fixture isolation, and dependency/maintenance cost.

Options: macOS `script`, a native Node PTY dependency, or Python's standard
`pty.spawn`. `script` rejected this piped driver with
`tcgetattr/ioctl: Operation not supported on socket`. A Node PTY module can
allocate a terminal but adds native build/dependency maintenance. Python's
existing standard-library driver worked using four lines and no new dependency.

Choose Python PTY for the Unix fixtures. Node remains the model-transport
fixture/controller; Python only forwards terminal bytes. Its macOS fork warning
concerns mixing higher-level system APIs, which this tiny child does not use.
Premortem: title generation could be mistaken for conversation completion.
Keep the title response distinct, require an actual tool-result request, then
observe the final TUI response before sending the normal exit keystrokes.

Sources fetched 2026-10-21:

- [Python PTY](https://docs.python.org/3/library/pty.html): controlling-terminal
  allocation and forwarding behavior, supported Unix platforms and macOS caveat.
- [Node TTY](https://nodejs.org/api/tty.html): streams wrap existing terminal file
  descriptors; a pipe is not a controlling terminal.
- [OpenCode plugin migration at the exact target](https://github.com/anomalyco/opencode/blob/v2.0.32/services/www/src/docs/content/build/plugins/migrate-v1.mdx):
  separate V2 Promise API and host-provided plugin modules.
- [OpenCode configuration migration at the exact target](https://github.com/anomalyco/opencode/blob/v2.0.32/services/www/src/docs/content/migrate-v1.mdx):
  V1 syntax compatibility, same config locations, bounded mixed fields.

## Observed setup boundaries

Owned cache: `/tmp/safeword-2enrh5-targets.aOFAud`.
All model requests go to a synthetic loopback OpenAI-compatible SSE server.
It emits a tool request and then a final response; it supplies no hook or policy
decision. Native host tool results and actual filesystem state determine the
outcome. No user authentication or real-model completion is needed for this
transport/guard boundary.

- Exact V2 2.0.32 CLI loaded a native observational plugin, emitted one actual
  `shell` before-event, and wrote the expected bytes. Final root:
  `opencode-v2-boundary-JjVj44`.
- Actual V2 TUI ran through the PTY, loaded that plugin, emitted the shell call,
  rendered completion and wrote the bytes. Root:
  `opencode-v2-tui-boundary-bpMeMh`.
- Exact V1 1.18.23 CLI used the current production Safeword installer and
  profile plugin. Its native bash tool result was
  `Safeword denied this OpenCode tool call.` and the synthetic ticket write
  remained absent. Root: `opencode-v1-boundary-lx7JBD`.
- Actual V1 TUI independently returned that same native denial in the next
  model request's tool result, rendered completion and left the sentinel absent.
  Root: `opencode-v1-tui-boundary-VoGHiF`.
- Adding a plural `plugins: []` field to the same V1 profile configuration did
  not disable the native V1 production guard. Root:
  `opencode-v1-boundary-aZBUOA`. Full V1/V2 coexistence remains unproved.

Important fixture findings: align child PWD/INIT_CWD with its actual cwd or V2
can select the parent repository; import `@opencode/plugin` by its public name
so V2 supplies its own SDK, rather than importing an installed SDK file; keep
title responses distinct from final responses. An early title-only TUI run
was discarded because no native tool attempt occurred.

The SDK was provisioned only in this disposable cache. Bun initially resolved
the cache's existing CLI range to 2.1.2 while adding the SDK; the CLI was then
explicitly pinned back to 2.0.32 and its package postinstall completed. Only the
verified 2.0.32 binary was used for the reported boundaries. No regular app,
profile, repository dependency or global installation was changed.

## Repeatable actor controls

The extracted actor and model/terminal driver reproduce the initial write
controls. V1 installs the current production integration in a fresh owned
profile. V2 starts with that delivery format, an explicit owned copy of the
configured native candidate package, and an independent observer. The observer
reads the native plugin registry during the actual tool call and requires the
candidate's exact local source to be active. Neither the observer nor the
bootstrap carrier supplies a policy decision or imports a V1 callback.

- V1 CLI allowed/denied and TUI allowed/denied all passed. Log:
  `/tmp/safeword-opencode-v1-actor-final-controls.log`.
- V2 CLI and TUI allowed writes passed. Both denied writes reached disk after
  native observer dispatch and yielded NATIVE_OPENCODE_V2_GUARD_MISSING. Log:
  `/tmp/safeword-opencode-v2-actor-controls.log`.
- Typecheck and targeted fixture lint pass. The first extracted CLI driver left
  stdin open and timed out before any model request. Closing unused CLI stdin
  restored the native controls; this was setup failure, not a feature RED.

Review a97981d4-0b81-41b8-9c11-89f987c3cbdb found that the original conditional
candidate registration could let an allowed row pass with no V2 delivery.
Removed that fallback: the candidate package is now mandatory, copied into the
owned fixture and checked byte-for-byte before/after, and its host-reported
active registration is a prerequisite. The bootstrap package is explicitly
marked, has no guard, and cannot certify either an allowed or denied contract
result. Its permitted write is checked only through assertAllowedControl as a
Given/setup contrast. Both actual runtimes still expose the missing guard when
their denied write reaches disk. Log:
`/tmp/safeword-opencode-bootstrap-controls.log`.

The bootstrap carrier follows PR 1's accepted loadable-empty-carrier technique;
it is not a production V2 implementation. The initial executable guard component
will select only the denied V2 source rows and run V1/allowed contrasts as setup
controls. It will remain incomplete on a passing component until the real
candidate, complete source population and other accepted obligations are proved.
The ordinary installer remains V1-only here; native customer enrollment and
activation stay in PR 4 as accepted. This fixture does not claim that lifecycle
boundary. Provider credentials and OPENCODE_* overrides are excluded from child
environment inheritance, and both primary and auxiliary models are pinned to
the loopback provider. An unexpected installer-written project config blocks
setup instead of being overwritten.

These direct actor controls do not yet satisfy the executable-RED gate. The
Cucumber source-row binding, complete initial group result classification and
independent attestation remain next. Final shared-profile lifecycle/coexistence,
full catalogue, worker constraints and registration-failure controls retain their
separate accepted obligations; no acceptance row is marked complete here.

Next: bind the actor to the eight initial source rows, retain V1 controls and
allowed contrasts, then earn an attested V2 missing-guard RED before adding
production V2 transport.
