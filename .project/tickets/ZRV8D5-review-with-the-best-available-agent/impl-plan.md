# Impl Plan: Keep review available with the best supported fallback

**Status:** implemented

## Approach

The riskiest assumption is that a foreground host will follow a one-shot
fallback handoff after `REVIEW_ROUTES_EXHAUSTED`. The cheapest honest proof is a
normal current-session Codex subagent invocation through the shipped workflow.
That smoke is point-in-time evidence only. The `finish-review` and
`surface-parity` suites are asset-contract checks: they prove the shipped
instructions and wiring, not that a host will execute the workflow. Hostile
input and cloud branches remain unproven manual checks in this session.

Build three slices:

1. **Canonical host workflow.** Add one non-user-invocable `finish-review`
   skill and one shared reviewer contract. The workflow receives the original
   typed coordinator result and the same accepted target files. Every result
   other than `REVIEW_ROUTES_EXHAUSTED` is returned unchanged. On exhaustion it
   attempts one fresh-context reviewer; unavailable, failed, or invalid output
   falls through to one main-thread fixed-rubric self-review. Invalid terminal
   output preserves the original exhaustion result unchanged. Under `require`,
   degraded findings remain additional feedback, the unsatisfied independence
   verdict is preserved, and remediation says to make an independent reviewer
   usable or explicitly choose `prefer`. Under `prefer`, `changes_requested`
   remains action required. Add asset-contract checks for these branches, the fixed
   output shape, one-attempt/no-recursion wording, assurance wording, and
   diagnostic/credential omission before adding the workflow.
2. **Host assets and complete entry-point wiring.** Add a named read-only
   `safeword-reviewer` for Claude/Cursor. Codex uses the same contract through a
   generic in-session subagent when the host exposes one; otherwise it
   self-reviews. Generate the Codex skill and Cursor wrapper from canonical
   sources, register every template in schema, and scan canonical skill
   templates for every `safeword review run` caller so each names
   `finish-review` after exhaustion. Generated-asset equality separately proves
   distribution parity. Add generation, schema, and entry-point parity tests
   before adding each distributed asset.
3. **Proof and guidance.** Run a normal live Codex subagent smoke check and
   record it as point-in-time evidence. Record hostile-packet and cloud branches
   as unproven manual checks in this session. Update the architecture/principle
   and customer docs with the best-effort boundary and cloud evidence limits.

Scenario proof:

| Scenarios | Primary proof | Supporting proof |
| --- | --- | --- |
| First opposite reviewer; alternate model; same-agent headless | Existing coordinator CLI integration suite | Class-1 entry-point contract keeps the coordinator first and unchanged |
| Claude Cloud fresh context; failed headless fall-through; invalid in-session output | `finish-review`/`surface-parity` asset-contract checks plus one point-in-time Codex smoke | Live cloud execution and failure branches are unproven manual checks locally |
| Delegation failure self-review; clean empty self-review; malformed terminal output | `finish-review` asset-contract checks | Host execution of these branches remains an unproven manual check |
| Fresh-context and self-review hostile-input cases | `finish-review` asset-contract checks | Hostile-input execution remains an unproven manual check; branch-controlled rubric limits are disclosed |
| Ambient-context disclosure cases | `finish-review` assurance asset-contract checks | Manual Claude execution skipped locally |
| Reviewer rejection, source change, required-policy, unrecognized failure | `finish-review` typed-result asset-contract checks | Existing coordinator result tests provide executable coordinator fixtures |
| Typed exhaustion enters host fallback | `surface-parity` handoff asset-contract check | One point-in-time Codex subagent smoke |
| Four distinct assurance explanations | `finish-review` asset-contract check and independent plain-language review | NTB/TBU walkthrough in `verify.md`, including empty self-review wording |
| `prefer`, independent `require`, degraded `require` | `finish-review` policy/remediation asset-contract checks; existing coordinator tests cover independent/headless outcomes | Host findings are additional degraded feedback and never stamped independent |
| Degraded `changes_requested` | `finish-review` verdict-wording asset-contract check | Host execution remains model-mediated and is not a deterministic fixture |

Surface proof:

| Surface | Proof |
| --- | --- |
| Claude Code | Schema installs `finish-review`, the reviewer contract, and named read-only agent |
| Claude Code Cloud | Same project-owned assets and official host contract; `skip:` live cloud unavailable in this session |
| OpenAI Codex | Generated plugin equality plus one point-in-time live in-session subagent smoke check |
| OpenAI Codex Cloud | Generated project/plugin skill; `skip:` live cloud unavailable in this session |
| Cursor | Schema installs the shared skill, generated rule, and named agent; tool denial is not structurally verified |
| Cursor Cloud Agents | Project-owned Cursor assets; `skip:` live cloud unavailable in this session |

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Ownership | Existing CLI coordinator owns all independent/headless routing and policy; one host skill owns only post-exhaustion acquisition | Duplicate fallback prose in every caller; add host-agent orchestration to the CLI | Duplication drifts; a child CLI process cannot invoke the foreground host's agent tool |
| Order | Opposite/default → opposite/alternate → author headless → host fresh context → main self-review | Put in-session before headless; self-review immediately | Separate-process routes have stronger packet/schema/timeout boundaries |
| Assurance | Preserve coordinator output; label host findings “host-reported fresh context” or “main-agent self-review,” both explicitly not independent | Treat any fresh context as independent | Same-agent review retains correlated blind spots and cannot satisfy `require` |
| Portability | Named Claude/Cursor reviewer plus generic Codex subagent when available; keep `allowed-tools: '*'` on the portable coordinator skill because host agent-tool names differ | Require an opposite CLI; host-specific duplicate prompts; pin one host's agent-tool name | Single-vendor cloud may expose only the current host; one reviewer contract minimizes drift and no shared tool name can invoke every host |
| Enforcement scope | Best-effort host continuation with structural asset/schema/parity checks | Transactional run records, finalizer protocol, universal completion receipt | Same-user state cannot force the foreground host to delegate; the added protocol created concurrency, retention, and recovery complexity without solving that boundary |
| Opt-out | Preserve the existing global `crossAgentReview: off` override; after a requested review returns typed exhaustion, always attempt the bounded fallback | Add another host-fallback off switch | Power-user opt-out prevents the coordinator from starting; `require` controls whether acquired degraded findings satisfy policy |
| Architecture guidance | Amend the host-owned coordinator boundary for agent workflows while keeping direct CLI exhaustion terminal | Leave “no safe route remains” absolute; move host orchestration into the CLI | The foreground host alone can invoke its session agent, while the CLI remains the authority for packet, process, and independence |

## Design alignment

| Principle | Consequence | Proof | Conflict |
| --- | --- | --- | --- |
| Optimize for the NTB without constraining the TBU | Plain language distinguishes every assurance level and names how to restore independent review | `packages/cli/tests/review/finish-review-contract.test.ts` asset-contract check | |
| 1. Structure enforces; instructions suggest | CLI routing/policy remain enforced; host continuation is explicitly best-effort and never mints independent evidence | `packages/cli/tests/review/finish-review-contract.test.ts` asset-contract check | explicit-conflict |
| 2. Fire at boundaries, not every turn | Handoff appears only after typed exhaustion at the existing review boundary | `packages/cli/tests/review/surface-parity.test.ts` asset-contract check | |
| 3. Add, never replace | New schema-owned assets reconcile without changing customer-authored agents or the coordinator contract | `packages/cli/tests/schema.test.ts` | |
| 5. Clarity before correctness | One short workflow and one reviewer contract own the new behavior | `packages/cli/tests/review/finish-review-contract.test.ts` asset-contract check | |

Architecture decisions honored: **Host-owned cross-agent adversarial review
coordinator** remains the only source of packet provenance, process isolation,
and independence policy. Its terminal guidance is amended only for foreground
agent workflows, where degraded feedback is additive to the original result.

## Known deviations

**1. Structure enforces; instructions suggest:** no portable child process can
invoke every foreground host's in-session agent tool or force the main model to
continue. The new rungs are therefore best-effort instructions. Tests prove the
assets are present, consistent, bounded in wording, and wired; live checks are
point-in-time evidence only. If the host ignores the handoff, the original loud
`REVIEW_ROUTES_EXHAUSTED` result remains the truthful outcome.

**Tool asymmetry:** Claude's named reviewer can be structurally read-only.
Current Codex generic subagents and Cursor agents do not share one verified
cross-host tool-denial contract; Cursor tool denial is not structurally verified,
so its no-write rule is instructional. The portable coordinator skill must keep
`allowed-tools: '*'` because host agent-tool names differ. Host findings remain
degraded, source changes stay visible in the worktree, and the result discloses
that host project instructions may have loaded.

**Input containment:** shipped templates omit failed-route diagnostics and
credentials and frame accepted targets as delimited, untrusted review material.
Because the foreground handoff is model-mediated, tests can prove the supplied
contract but cannot structurally prevent a host from adding other context. The
named reviewer exposes only its read tool and forbids paths outside the accepted
set, but it still reads the live worktree. Assurance therefore discloses both
that host-mandated project context may load and that source integrity was not
revalidated.
The repository-owned reviewer contract and agent definition are branch-controlled
control-plane instructions outside the accepted packet, so prompt-injection
resistance remains model-mediated. When either control-plane file is itself a
review target, that review cannot independently validate its own rubric.

**Cloud evidence:** this session cannot launch Claude Code Cloud, Codex Cloud,
or Cursor Cloud Agents. Asset/schema coverage proves delivery, not live cloud
execution; `verify.md` must preserve those explicit skips.

## Doc impact

- `README.md` and
  `packages/website/src/content/docs/reference/hooks-and-skills.mdx`: document
  the ordered host fallback and its best-effort status.
- `packages/website/src/content/docs/reference/configuration.mdx`: clarify that
  `prefer` can report degraded host findings while `require` remains blocked.
- `ARCHITECTURE.md`: supersede the “no safe route remains” terminal guidance
  for agent workflows without changing direct CLI behavior.
- `PRINCIPLES.md`: distinguish fresh-context same-agent review from independent
  cross-agent/model review.

## Assessment triggers

Revisit when a host exposes a supported programmatic subagent API, a universal
blockable completion event, or structurally restricted generic subagent tools;
when Codex plugins can bundle named agents; or when live cloud evidence shows
project-owned reviewer assets do not load. Those capabilities could promote the
best-effort handoff into a code-owned receipt without inventing a local protocol.
