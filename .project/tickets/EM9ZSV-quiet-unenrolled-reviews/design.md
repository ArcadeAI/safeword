# Design: Point-of-need Safeword enrollment

**Guide**: `.safeword/guides/design-doc-guide.md`
**Template**: `.safeword/templates/design-doc-template.md`

**Related**: Feature Spec: `spec.md` | Test Definitions: `test-definitions.md`

## Architecture

Safeword will add one side-effect-free enrollment decision core in the CLI package. It receives a declared project-state dependency, checks only the enrollment marker, and returns a typed outcome: ready, choice required, or enrolled-but-incomplete. It never prompts, writes, installs, or resumes work.

Existing host boundaries adapt that outcome. Generated workflows call the boundary before their first declared state need. Profile-delivered Claude, Codex, and OpenCode hooks, plus installed Cursor hooks, classify tool targets against schema-derived Safeword-owned paths and stop undeclared access before it happens. A shared workflow coordinator presents the plain-language choice, obtains a bounded plan from the existing lifecycle planner, applies that exact plan only after builder approval, rechecks the initiating prerequisite, and permits one continuation.

```text
workflow or pre-tool hook
        |
        v
state-access catalogue -> enrollment decision core -> ready
        |                          |
        |                          +-> choice required -> canonical install plan
        |                                                   |
        +-> schema-derived owned paths                      v
                                             builder approval / decline
                                                           |
                                      prerequisite recheck + one continuation
```

## Components

### Component 1: Enrollment decision core

**What**: Classifies a declared state need without accessing project state beyond the enrollment marker.
**Where**: `packages/cli/src/enrollment/decision.ts`
**Interface**:

```typescript
type StateNecessity = 'required' | 'optional';

interface ProjectStateNeed {
  route: ProjectStateRouteId;
  host: AgentIntegration | 'safeword-cli';
  requirement: ProjectStateRequirement;
  necessity: StateNecessity;
}

type EnrollmentDecision =
  | { kind: 'ready' }
  | { kind: 'choice_required'; prompt: EnrollmentPrompt; install: InstallIntent }
  | { kind: 'setup_incomplete'; missing: readonly ProjectStateRequirement[] };

function decideEnrollment(cwd: string, need: ProjectStateNeed): EnrollmentDecision;
```

**Dependencies**: the existing marker resolver, lifecycle integration registry, and pure requirement predicates.
**Tests**: R1 marker-only access and lifecycle exemptions; R2 no-input/decline; R4 prerequisite outcomes; R5 namespace and enrolled behavior.

### Component 2: State-access catalogue and owned-path classifier

**What**: Declares every packaged state consumer and discovers file-tool accesses to schema-owned paths so parity checks can reject missing or unguarded routes.
**Where**: `packages/cli/src/enrollment/catalogue.ts`, `packages/cli/src/owned-paths.ts`
**Interface**:

```typescript
interface ProjectStateRoute {
  id: ProjectStateRouteId;
  requirement: ProjectStateRequirement;
  necessity: StateNecessity;
  statelessContinuation: boolean;
}

function projectStateRoutes(): readonly ProjectStateRoute[];
function classifySafewordOwnedTarget(cwd: string, target: string): OwnedTarget | undefined;
```

**Dependencies**: `SAFEWORD_SCHEMA`, configured namespace resolution, CLI catalogue, and generated workflow catalogue.
**Tests**: R1 positive parity plus unguarded and uncatalogued rejection fixtures; independent filesystem observation for read/write paths.

### Component 3: Canonical enrollment coordinator

**What**: Presents the choice, obtains and confirms the existing lifecycle plan, applies only that plan, rechecks required setup, and returns a continuation decision without persisting dismissal state.
**Where**: `packages/cli/src/enrollment/coordinator.ts`, `packages/cli/src/commands/project-enrollment.ts`, `packages/cli/src/cli-protocol/catalog.ts`
**Interface**:

```typescript
interface EnrollmentPorts {
  choose(prompt: EnrollmentPrompt): Promise<'accept' | 'decline' | 'unanswered'>;
  approve(plan: CliPlan): Promise<boolean>;
  install(planId: string, intent: InstallIntent): Promise<CliResult>;
}

type EnrollmentResolution =
  | { kind: 'continue_once'; installResult: CliResult }
  | { kind: 'stateless' }
  | { kind: 'stopped'; reason: EnrollmentStopReason };
```

**Dependencies**: the current lifecycle plan builder and installer, the standard-library readline prompt already used by tracker setup, and typed CLI result envelopes.
**Tests**: R2 plan membership/effect confinement and consent outcomes; R3 decline/stateless behavior; R4 concurrency, partial results, cancellation, and duplicate continuation.

### Component 4: Host adapters

**What**: Translate host events and generated workflow state needs into the shared contract while preserving native host trust and output shapes.
**Where**: `packages/cli/src/claude-plugin/runtime/dispatch.ts`, `packages/cli/src/commands/codex-hook.ts`, `packages/cli/src/opencode/plugin.ts`, `packages/cli/templates/hooks/cursor/`, and affected workflow templates.
**Interface**:

```typescript
interface EnrollmentHostAdapter {
  stateNeed(input: HostEvent): ProjectStateNeed | undefined;
  present(decision: EnrollmentDecision): Promise<EnrollmentResolution>;
  renderStop(resolution: EnrollmentResolution): HostHookOutput;
}
```

**Dependencies**: each host's current profile/project delivery, tool-event contract, and the shared packaged CLI.
**Tests**: installed-artifact wiring for Claude, Codex, OpenCode, and Cursor; a real command process for the CLI; the scripted real-Claude Killer Demo; and a positive builder-consent proof through every installed agent artifact, not only Claude and Codex.

## Data Model

The decision, plan, and resolution are ephemeral values carried by one initiating operation. Before consent, no repository or profile state is written. Decline and an abandoned prompt remain unrecorded. The approved lifecycle plan identity is the only authorization token; it is recomputed before apply to reject drift. Existing installer effects and recovery stay authoritative.

The operation envelope is host-owned rather than Safeword-persisted. The direct CLI and long-lived OpenCode plugin retain a consume-once continuation in process memory. Claude and Cursor adapters derive the same operation envelope from the stable session/conversation identity plus the host-owned transcript/event context already supplied to the hook; they never create a Safeword state file. The Codex packaged workflow carries the continuation in the current thread/turn context and uses the existing run-identity resolver only to correlate hook input, never to persist a dismissal. A fresh subprocess must reconstruct the prior choice from that host-owned envelope before it can ask again. If a host event lacks both a stable operation identity and current interaction context, required state fails closed with a manual retry; it does not guess consent or create state. The continuation is invalidated after the first success or failure, and a later user operation gets a new host-owned envelope.

## Component Interaction

1. A workflow declares a state need, or a host hook detects a tool target under a schema-owned path.
2. The catalogue resolves the requirement and necessity; lifecycle commands and stateless operations short-circuit.
3. The decision core reads only `.safeword/SAFEWORD.md`. Enrolled work proceeds; incomplete enrolled work gets setup recovery, not enrollment.
4. For an unenrolled repository, the host adapter presents the core's choice. Only a current builder-input event can select accept.
5. Acceptance previews the existing canonical lifecycle plan for the initiating host and requirement. Plan approval applies the same identity through the existing installer.
6. The coordinator rechecks the requirement. Sufficient setup consumes the continuation once; decline, cancellation, unmet setup, or handoff failure follows the route's declared stop/stateless outcome.

## User Flow

1. The builder asks Safeword to build a feature in a new repository.
2. BDD reaches its first ticket write. Before that write, Safeword asks whether to set up the repository and explains the bounded effect.
3. If the builder accepts, Safeword shows the canonical plan. Approval applies that plan, verifies ticketing state, and continues the same BDD operation once.
4. If the builder declines or leaves the choice unanswered, BDD stops before artifacts. A no-ticket review at an optional proof need instead returns its findings without proof logging.

## Key Decisions

### Decision 1: Pure core plus native adapters

**What**: Centralize policy and plan/apply semantics while keeping event translation in each existing host adapter.
**Why**: Claude, Codex, Cursor, and OpenCode expose different blocking and approval contracts. The existing integration registry explicitly preserves those native trust boundaries.
**Trade-off**: Adapter contract tests are required; a single universal hook implementation is not credible.

### Decision 2: Ephemeral continuation, durable plan identity

**What**: Persist neither decline nor resume state in Safeword-owned storage. Carry one consume-once continuation in the initiating host's operation envelope: process memory for CLI/OpenCode, host-owned transcript/event context for Claude/Cursor, and current thread/turn context for Codex. Use the existing content-addressed plan identity for mutation authority.
**Why**: This makes non-consent paths mutation-free and prevents stale plan application without creating a second transaction system.
**Trade-off**: A crashed host cannot auto-resume; it reports a safe manual retry instead.

### Decision 3: Catalogue plus independent path observation

**What**: Validate declared routes statically and prove actual host/file behavior with filesystem observation outside Safeword.
**Why**: A self-reported access log cannot detect a route that bypasses its own instrumentation.
**Trade-off**: Acceptance fixtures need isolated repositories and observer snapshots.

## Implementation Notes

**Constraints**:

- Pre-tool classification must stay fast and read only the marker plus the proposed tool target.
- Explicit install, plan, status, doctor, and uninstall never recurse into enrollment.
- The generated Codex and Claude plugin artifacts are regenerated from templates; generated files are never hand-edited.
- OpenCode remains profile-delivered and installs only shared project substrate.
- Cursor coverage applies through its installed project hooks/rules; this feature does not create a new Cursor profile distribution.

**Error Handling**:

- No interactive input returns a typed consent-required stop.
- Plan drift returns the latest plan without applying the stale one.
- Partial installation preserves the installer's result and reports only disclosed effects.
- Failed continuation never replays the initiating action.

**Gotchas**:

- Host hook output schemas differ; adapters must not reuse one host's output verbatim.
- Shell target extraction is necessarily bounded; catalogue parity and representative real-process tests remain the backstop.
- Existing 0.83.1 review status output cannot satisfy the current receipt verifier; tests must avoid conflating that compatibility bug with enrollment behavior.

**Open Questions**:

- None blocking. TDD may narrow the exact host event used for positive builder-consent provenance while retaining the saved behavior.

## References

- `ARCHITECTURE.md` — Registry-Driven Agent Integrations with Native Trust Boundaries; generated native Claude/Codex plugin decisions.
- [Claude Code hook decision control](https://code.claude.com/docs/en/hooks-guide)
- [Cursor hooks](https://cursor.com/docs/hooks)
- [OpenCode plugins](https://dev.opencode.ai/docs/plugins/)
- [OpenAI Codex configuration and hooks](https://github.com/openai/codex/blob/main/docs/config.md)
