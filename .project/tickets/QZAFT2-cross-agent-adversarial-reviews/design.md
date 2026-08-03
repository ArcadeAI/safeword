# Design: Cross-agent adversarial reviews

**Guide**: `.safeword/guides/design-doc-guide.md`
**Related**: [Feature spec](./spec.md) | [Test definitions](./test-definitions.md) | [Spike](./spike.md)

## Architecture

Add one host-owned review coordinator behind a typed `safeword review run` command. It receives a review kind and bounded target paths, derives the author runtime from Safe Word's shared run identity, snapshots only approved inputs into a neutral temporary directory, selects the opposite vendor, and executes a vendor adapter synchronously. The coordinator validates the result before it reports reviewer provenance or permits a review stamp.

Selection and failure policy stay pure. Filesystem/process work lives behind injected boundaries so unit tests cover the matrix cheaply, while a CLI wiring test uses the real catalogue, handler, coordinator, packet builder, and renderer with only the subprocess boundary replaced. The three class-1 skill surfaces invoke this command; class-2 and class-3 routes remain untouched.

```text
quality-review / review-spec / plan review
                    |
             safeword review run
                    |
      author identity -> route policy
                    |
       bounded neutral review packet
                    |
        Claude adapter | Codex adapter
                    |
     validated result + honest fallback
                    |
       typed CLI output + review stamp
```

## Components

### Component 1: Review contract and route policy

**What**: Own the closed agent/surface/failure/independence vocabulary and deterministically choose preferred, fallback, or existing routes.
**Where**: `packages/cli/src/review/contract.ts`, `packages/cli/src/review/policy.ts`
**Dependencies**: Shared `run-identity` runtime names and parsed `.safeword/config.json`.
**Tests**: Opposite selection, non-Claude/Codex retention, failure preservation, permitted degradation, hard enforcement, exhaustion, and excluded work.

```typescript
type ReviewAgent = 'claude' | 'codex';
type ReviewKind = 'quality-review' | 'scenario-gate' | 'plan-implementation';
type ReviewPolicy = 'prefer' | 'require' | 'off';
type Independence = 'cross-agent' | 'degraded' | 'none';

interface ReviewRoute {
  author: ReviewAgent;
  preferred: ReviewAgent;
  fallback?: ReviewAgent;
  requiredIndependence: ReviewPolicy;
}
```

### Component 2: Bounded packet and isolation boundary

**What**: Resolve contained regular files, enforce file/count/byte caps, create a neutral snapshot with logical relative names, construct the vendor-scoped child environment, and hash judged inputs before and after review.
**Where**: `packages/cli/src/review/packet.ts`, `packages/cli/src/review/environment.ts`
**Dependencies**: Node filesystem/temp APIs; no shell.
**Tests**: Real temporary files for containment, symlink rejection, caps, neutral cwd, opposite-vendor secret removal, source-integrity failure, and cleanup.

```typescript
interface ReviewPacket {
  dispatchId: string;
  kind: ReviewKind;
  logicalFiles: readonly { path: string; content: string; sha256: string }[];
  rubric: string;
}
```

### Component 3: Headless runtime adapters

**What**: Enumerate executable candidates from every `PATH` entry, capability-check candidates, construct structured argv, send the packet through stdin, enforce deadlines/output caps, and parse one common result contract.
**Where**: `packages/cli/src/review/runtime.ts`, `packages/cli/src/review/claude.ts`, `packages/cli/src/review/codex.ts`
**Dependencies**: Node `child_process.spawn`; installed Claude/Codex CLIs and their existing authentication.
**Tests**: Candidate fallback past a stale executable, exact argv/stdin, profile/cloud environment simulations, non-zero/timeout/auth/malformed classifications, contradictory identity, and exact completion.

```typescript
interface ReviewerOutput {
  schema_version: 1;
  dispatch_id: string;
  reviewer_agent: ReviewAgent;
  verdict: 'approve' | 'request_changes';
  summary: string;
  findings: readonly ReviewFinding[];
}
```

### Component 4: Coordinator, CLI, evidence, and surface wiring

**What**: Run the route sequence, preserve the preferred failure across fallback, render one plain-language independence statement and at most one recovery action, expose the typed CLI result, extend stamps with optional agent provenance, and route every class-1 skill through the command.
**Where**: `packages/cli/src/review/coordinator.ts`, `packages/cli/src/cli-protocol/{catalog.ts,public-handlers.ts}`, review stamp helpers, and canonical skill templates.
**Dependencies**: Components 1–3, typed CLI result envelope, review ledger, schema/parity generation.
**Tests**: Public-command wiring with only subprocesses faked; human/JSON rendering; backward-compatible stamp parsing; canonical/dogfood/Codex-plugin parity; non-class-1 negative assertions.

## Data Model

```typescript
type ReviewFailure =
  | 'not_installed'
  | 'not_authenticated'
  | 'process_failed'
  | 'timed_out'
  | 'invalid_output'
  | 'source_changed';

interface ReviewOutcome {
  status: 'approved' | 'changes_requested' | 'blocked' | 'existing_route';
  author_agent: 'claude' | 'codex' | 'cursor' | 'unknown';
  assigned_reviewer?: ReviewAgent;
  actual_reviewer?: ReviewAgent;
  assigned_model?: string;
  independence: Independence;
  preferred_failure?: ReviewFailure;
  next_action?: { command: string; description: string };
  reviewer_output?: ReviewerOutput;
}
```

New fields appended to review-stamp lines are optional and tokenized: `author-agent:`, `reviewer-agent:`, `independence:`, and the existing `model:`. Historical stamps without them continue to parse. A hard cross-agent gate accepts only `independence:cross-agent` with distinct supported agents; a skip remains explicit and cannot impersonate a review.

## Component Interaction

1. A class-1 skill invokes `safeword review run <kind> <targets...> --json --no-input`.
2. The CLI derives the author runtime. Unknown/Cursor authors return `existing_route` without starting a subprocess.
3. The packet builder validates and snapshots the targets and the canonical rubric outside the source worktree.
4. Policy selects Codex for Claude or Claude for Codex. The adapter resolves a compatible binary, strips unrelated vendor credentials, and receives the prompt over stdin.
5. The coordinator validates dispatch/reviewer identity and source integrity. On failure it either runs the permitted same-agent fallback or blocks.
6. Human output leads with independence status; JSON carries the full typed outcome. A passing review may be stamped with the coordinator-assigned provenance.

## User Flow

1. A builder asks Safe Word to review work or reaches a class-1 phase gate.
2. Safe Word automatically starts the opposite installed agent.
3. On success, the builder sees that an independent agent checked the work and the workflow continues with content-bound evidence.
4. If the opposite route fails, the builder sees the specific cause, whether a degraded check ran, and one recommended command such as signing in to the named reviewer and retrying.
5. If policy requires cross-agent review and no valid route remains, the workflow blocks without minting evidence.

## Key Decisions

### Decision 1: Structured argv with stdin, not shell commands or trailing prompts

**What**: Spawn explicit executable paths with argument arrays and pipe the review packet to stdin.
**Why**: The live spike proved both directions and exposed stale `PATH` selection plus variadic Claude flags consuming trailing prompts. Node's supported `spawn(command, args, options)` boundary supplies stdin, timeout, cwd, env, and separate stdout/stderr without a shell.
**Trade-off**: The adapters own more compatibility checks than a one-line shell command. [Node child process](https://nodejs.org/api/child_process.html), [Claude CLI](https://docs.anthropic.com/en/docs/claude-code/cli-usage), [Codex CLI](https://github.com/openai/codex/blob/main/codex-rs/README.md)

### Decision 2: Host-owned coordinator with layered isolation

**What**: Run orchestration at the host boundary when available, while the reviewer sees only a bounded neutral packet and no write/shell tools.
**Why**: The spike showed a nested Codex sandbox could start Claude but could not access Claude's desktop profile; host execution could. Separate packet containment, tool denial, vendor read-only flags, and post-run hashes avoid treating a sandbox label as the only control.
**Trade-off**: A host that exposes neither reviewer credentials nor a supported host execution boundary must degrade or block loudly rather than forcing a hidden escape.

### Decision 3: Public typed `review run` command

**What**: Add an observable, network-declared command to the existing CLI protocol instead of a surface-private hook helper.
**Why**: All class-1 surfaces need the same selection, execution, failure, and presentation contract; the existing schema-v1 result envelope already maps healthy/action-required/failed states and supports one recovery action.
**Trade-off**: The command becomes a maintained compatibility surface, but it is directly testable and discoverable rather than duplicated prose.

### Decision 4: Default prefer, explicit require/off

**What**: `crossAgentReview` accepts `prefer`, `require`, or `off`; absence resolves to `prefer` in the finished feature. Development flips the default only after parity and live smoke pass.
**Why**: `prefer` provides automatic independence with an honest safe fallback, `require` supports hard gates, and `off` is the requested escape hatch.
**Trade-off**: Three states require explicit result semantics; a boolean could not distinguish fallback from enforcement.

## Implementation Notes

**Constraints**:

- No direct vendor SDK or new runtime dependency.
- No reviewer process starts from the source worktree.
- Prompts, stdout, stderr, files, and deadlines are capped.
- Credential values never enter packets, results, or diagnostics.
- The coordinator never weakens a parent sandbox to recover authentication.

**Error Handling**:

- Missing/incompatible executables, authentication denial, non-zero exit, timeout, invalid output, and source mutation have stable internal codes.
- A fallback preserves the preferred-route failure in supporting detail.
- Human output has one leading independence sentence and at most one recommended recovery action.

**Gotchas**:

- Enumerate all executable candidates instead of trusting the first `PATH` match.
- Claude and Codex output envelopes differ; normalize only after strict vendor parsing.
- Keep stdout and stderr separate so warnings cannot corrupt JSONL parsing.
- Desktop profile access can disappear inside a nested sandbox; cloud credentials must remain vendor-scoped.

**Open Questions**:

- [x] None blocking. Exact model defaults remain adapter constants with capability tests and configuration seams.

## References

- [Spike evidence](./spike.md)
- [Safeword architecture](../../../ARCHITECTURE.md)
- [Node `child_process`](https://nodejs.org/api/child_process.html)
- [Node filesystem](https://nodejs.org/api/fs.html)
- [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
- [Codex noninteractive CLI](https://github.com/openai/codex/blob/main/codex-rs/README.md)
