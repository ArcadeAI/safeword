# Cross-agent adversarial reviews

## Intake Brief

- **Requested by:** User directing Safe Word workflow behavior in this Codex desktop task.
- **Cost of inaction:** Class-1 review continues to rely on host-native or same-model fresh contexts, preserving correlated blind spots and making cross-model enforcement manual and inconsistent across Claude and Codex.
- **Reversibility:** Cross-cutting / one-way for workflow semantics because the policy changes every class-1 review surface; the implementation remains removable without migrating project data.

## Surfaces

Affected:

- Claude Code
- Claude Code Cloud
- OpenAI Codex
- OpenAI Codex Cloud
- Safeword CLI

Unaffected:

- Cursor — whether Cursor should prefer Codex, Claude, or retain its native reviewer is an engineering-scope question, not assumed during JTBD framing.
- Class-2 observation — deterministic tests, lint, types, parsers, and cheap judges do not review agent-authored judgment.
- Class-3 producer fan-out — research and refactor discovery intentionally optimize for angle diversity rather than no-weaker cross-agent review.

## Jobs To Be Done

### cross-agent-review.TBU1 — Get an adversarial review from outside the author agent

**Persona:** Technical Builder (TBU)

> When Claude or Codex authors work that needs a class-1 adversarial review, I want Safe Word to run that review in a fresh headless session of the other agent, so the review does not inherit the author's context or vendor-specific blind spots.

#### cross-agent-review.TBU1.R1 — Every class-1 review uses a fresh headless session of the opposite supported agent when that route is available

#### cross-agent-review.TBU1.R2 — A completed review records the actual reviewer agent and whether the review was cross-agent

#### cross-agent-review.TBU1.R3 — The external reviewer receives only the bounded review brief and its own vendor credentials, and cannot mutate the work it judges

### cross-agent-review.TBU2 — Keep review moving when the preferred agent is unavailable

**Persona:** Technical Builder (TBU)

> When the alternate headless agent is missing, unauthenticated, or fails in a desktop or cloud session, I want Safe Word to explain the failure and take the safest available fallback, so the workflow neither stalls mysteriously nor pretends a degraded review was fully independent.

#### cross-agent-review.TBU2.R1 — Unavailable, unauthenticated, and failed review routes are distinguished with their cause before fallback

#### cross-agent-review.TBU2.R2 — A fallback review is labeled with its actual independence level and never satisfies a cross-agent requirement by implication

#### cross-agent-review.TBU2.R3 — When no safe review route remains, the workflow stops with an actionable recovery path instead of silently passing or hanging

### cross-agent-review.NTB1 — Know whether an independent reviewer actually checked the work

**Persona:** Non-Technical Builder (NTB)

> When I rely on Safe Word to catch mistakes I cannot find by reading the code myself, I want it to use an independent agent automatically and tell me in plain language when that was not possible, so I know whether the safety check was fully independent and exactly what I should do next.

#### cross-agent-review.NTB1.R1 — Review outcomes lead with a plain-language statement of whether an independent agent checked the work

#### cross-agent-review.NTB1.R2 — Every degraded or blocked outcome gives one concrete next action without requiring the user to diagnose agent installation or authentication

### cross-agent-review.SWM1 — Apply one review policy across every class-1 surface

**Persona:** Safeword Maintainer (SWM)

> When I evolve Safe Word's quality-review, phase-review, and architecture-review workflows, I want them to share one cross-agent execution contract and reuse the proven headless-agent rails, so the surfaces cannot drift into different selection, safety, or failure behavior.

#### cross-agent-review.SWM1.R1 — Quality review, phase review, and architecture review use one shared selection, execution, fallback, and evidence contract

#### cross-agent-review.SWM1.R2 — The contract behaves consistently in desktop and cloud sessions for both Claude-authored and Codex-authored work

#### cross-agent-review.SWM1.R3 — Class-2 deterministic checks and class-3 producer fan-out retain their existing routing behavior

## Rave Moment

skip: internal reliability plumbing; the user-visible bar is trustworthy invisibility, not a promotable delight moment.

## Engineering Decision

Use one Safe Word CLI coordinator with vendor-specific Claude and Codex adapters. The coordinator receives a bounded review packet, selects the opposite agent from the author runtime, executes it synchronously in a neutral review workspace with read-only permissions, classifies failures, and returns structured reviewer provenance and fallback instructions.

- **Why this direction:** Claude supports noninteractive `-p` execution with explicit tool restrictions and structured output; Codex supports noninteractive `exec`, JSON events, ephemeral sessions, and a read-only sandbox. Safe Word already exercises both subprocess boundaries for retro extraction, so the feature can borrow their spawn, credential-reuse, and isolation primitives instead of adding a second authentication system. Unlike retro's out-of-band fail-open extraction, this is a new in-band, fail-closed, repo-reviewing execution path.
- **Provenance advantage:** the coordinator assigns the reviewer agent and explicit `--model` / `-m` selection, avoiding the model-identity opacity of host-native subagents. Tool-enabled Codex review output is validated by the coordinator's review-result contract; it does not rely on `--output-schema` to attest reviewer identity.
- **Rejected — host-native delegation only:** preserves today's easiest fallback but cannot deterministically select the opposite vendor across Claude and Codex hosts.
- **Rejected — direct Anthropic/OpenAI API calls:** duplicates credential discovery, model/provider configuration, and cloud-session authentication already owned by the installed CLIs.
- **Premortem:** vendor CLI flags or output envelopes drift and silently weaken review isolation; contain that risk in two adapters with argv/output contract tests and live smoke coverage.
- **Evidence:** [Claude Code CLI reference](https://code.claude.com/docs/en/cli-usage), [Claude Code authentication](https://code.claude.com/docs/en/authentication), [Codex noninteractive CLI and sandbox](https://github.com/openai/codex/blob/main/codex-rs/README.md), [Codex CLI sign-in](https://help.openai.com/en/articles/11381614-api-codex-cli-and-sign-in-with-chatgpt), and the installed Claude Code 2.1.170 / Codex CLI 0.141.0 help output checked during intake.

## Scope

- Add one shared class-1 review coordinator and reusable Claude/Codex headless adapters: a new synchronous, fail-closed review path that borrows the existing retro subprocess primitives without inheriting retro's fail-open semantics.
- Migrate the currently host-subagent-backed quality review, scenario/phase review, and implementation-plan/architecture review flows to the coordinator when opposite-agent execution applies.
- Select Codex for Claude-authored work and Claude for Codex-authored work when the opposite route is installed and authenticated.
- Build a bounded snapshot of the review inputs in a neutral temporary workspace and never launch the child from the source worktree. Deny write tools, apply the vendor's read-only mode, and allow only research/read capabilities required by the selected review rubric.
- Distinguish missing executable, missing/expired authentication, process failure/timeout, and invalid reviewer output without printing credentials or secret values.
- Reuse each CLI's existing profile, managed cloud credential, provider configuration, or supported environment credential; do not require an API key when an authenticated profile already works.
- Fall back to the existing fresh host-native reviewer when policy permits, while labeling the result as degraded. A degraded same-agent result cannot satisfy an enabled cross-agent enforcement gate.
- Extend review evidence to record author agent, reviewer agent, coordinator-assigned model, and independence level as optional backward-compatible stamp fields; keep existing content-bound stamp behavior and parsing for historical stamps.
- Stage activation behind a fail-safe rollout guard while parity is being proven, then make opposite-agent preference the default finished behavior; retain an explicit opt-out rather than leaving the feature permanently default-off.
- Keep Claude/Codex template, installed dogfood, Codex-plugin, hook, schema, and parity coverage synchronized.

## Out of Scope

- Cursor reviewer selection; Cursor keeps its current behavior until a separate policy defines which external vendor it should prefer.
- Installing Claude Code or Codex, provisioning API keys, copying secrets between agents, or managing Cloud Session secret stores.
- A new remote review service or direct vendor SDK integration.
- Changing the substance of the quality-review, review-spec, or architecture-review rubrics.
- Class-2 deterministic observation and class-3 producer/discovery fan-out.
- Making per-step `tdd-review` self-checks external; they do not currently run as independent subprocess reviews.

## Done When

- Claude-authored class-1 work invokes a fresh Codex review, and Codex-authored class-1 work invokes a fresh Claude review, across every in-scope review surface when the opposite route is available.
- The review packet is bounded and snapshotted outside the source worktree; layered tool denial, read-only vendor mode, and neutral working-directory isolation prevent the subprocess from modifying the judged work, and successful output is validated before it can earn review evidence.
- Missing installation, authentication failure, runtime failure/timeout, and malformed output each produce a distinct plain-language explanation and the safest concrete next action.
- A permitted fallback is visibly marked with its actual reviewer and independence level; it never passes a hard cross-agent gate as though the preferred review succeeded.
- Exhausting all safe routes blocks rather than hanging, silently passing, or minting misleading review evidence.
- Desktop and cloud simulations cover Claude and Codex author directions without requiring tests to expose real credentials.
- Existing BDD scenarios are reused for fresh-review enforcement, cross-model stamps, and safe headless execution; new scenarios cover only opposite-agent selection, fallback/exhaustion, NTB messaging, and agent-level provenance gaps.

## Open Questions

None. Cursor is explicitly out of scope. A same-agent fresh reviewer is an allowed degraded fallback only where current policy permits it and never satisfies a hard cross-agent requirement.
