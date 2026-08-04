# Dimensions: Predictable Safeword CLI (K53GQ9)

Derived from the fourteen Rules in `spec.md`, GitHub issue #1574, and the
existing command, hook, and reconciliation surfaces.

| Dimension | Partitions |
| --- | --- |
| Invocation | bare `safeword` · canonical command · deprecated alias · hidden helper |
| Renderer | human interactive · human non-TTY · JSON |
| Effect class | observe · plan · mutate · destructive · hook |
| Project state | healthy · action required · failed · unconfigured · drifted |
| Interaction | TTY confirmed · TTY declined · `--no-input` · non-TTY |
| Effect channel | filesystem · packages · network · none |
| Result cardinality | no findings/actions · one · many |
| Option placement | before command · after command |
| Compatibility | canonical name · first legacy release · second legacy release |
| Execution outcome | applied · unchanged · partially failed with recovery |

## Boundaries

- Empty `next_actions` versus several machine actions; human output still
  prints zero or one.
- An observation with actionable drift exits 2, while an operational error
  exits 1.
- JSON stdout must remain parseable when warnings, deprecations, and failures
  occur; diagnostics cannot leak prose into stdout.
- A command declared read-only cannot create initialization state merely to
  calculate its result.
- A hidden helper remains invocable by installed hooks but absent from ordinary
  help and capabilities.
- `--no-input` cannot turn a destructive command into implicit consent.

## Split decision

Keep one feature. The typed contracts, command catalog, renderers, global
options, aliases, and safety assertions are one compatibility boundary:
shipping any independently would create a second temporary protocol and make
human/agent semantics diverge. Implementation is divided into ordered,
independently green slices in `impl-plan.md`.
