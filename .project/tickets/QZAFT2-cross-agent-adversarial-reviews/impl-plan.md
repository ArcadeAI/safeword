# Impl Plan: Catch agent blind spots with cross-agent reviews

**Status:** planned

## Approach

The riskiest assumption is that one synchronous coordinator result can replace the three host-native class-1 paths without weakening their existing gates. The cheapest proof is the first vertical slice: run the real public CLI catalogue and handler through the real route policy, packet builder, coordinator, typed result, and human renderer while faking only the external subprocess. It must select Codex for a Codex-capable Claude author fixture, validate assigned/actual provenance, and produce a stamp-compatible cross-agent result. If that wiring cannot stay small, stop before building the second adapter. The spike already proved host-boundary authentication can coexist with the neutral-workspace direction; slice 2 deliberately closes the remaining isolation-without-vendor-sandbox risk using a real temporary-file mutation test before runtime-adapter breadth is added.

Primary proof uses integration tests because this is a user-visible multi-module workflow. Pure selection, parsing, containment, and rendering matrices get supporting unit tests. Real vendor authentication is environment-dependent and belongs to an opt-in live smoke lane, never the deterministic suite.

### Scenario proof map

| Scenario group | Primary proof | Supporting proof / key assertion |
| --- | --- | --- |
| Each author agent selects the opposite headless reviewer | Public-command integration through real catalogue/handler/coordinator with only subprocess faked | Both Claude→Codex and Codex→Claude routes assert selected binary and assigned reviewer |
| A same-agent candidate cannot displace an available opposite reviewer | Coordinator integration with both candidates available | Assert exactly one opposite-agent dispatch and no same-agent dispatch |
| An author outside the Claude and Codex pairing keeps its existing route | Route-policy unit table | Cursor/unknown returns `existing_route` and zero subprocess requests |
| A validated opposite-agent result earns complete provenance | Command JSON + review-stamp round-trip integration | Assert author, assigned/actual reviewer, assigned model, dispatch id, and `cross-agent` independence |
| Reviewer identity faults earn no review evidence | Adapter parser unit table | Missing reviewer and contradictory reviewer/dispatch id produce distinct invalid-output classifications and no stamp |
| A reviewer write attempt cannot alter the judged work | Integration with real source files, neutral snapshot, and mutation-attempt fake child | Snapshot mutation is observed, source files remain byte-identical, and attempted mutation cannot earn passing evidence |
| An unrelated author-vendor credential never enters the reviewer boundary | Environment-construction unit table plus subprocess wiring assertion | Opposite-vendor secret sentinels are absent from env, packet, stdout, stderr, and diagnostics |
| Each preferred-route failure keeps its specific cause | Coordinator integration table at the subprocess boundary | Distinguish not-installed, not-authenticated, non-zero, timeout, and invalid output while preserving preferred cause after fallback |
| A permitted host-native fallback is recorded as degraded | Integration: preferred failure followed by same-agent pass | Actual reviewer is same agent and independence is `degraded` |
| A degraded fallback cannot satisfy hard cross-agent enforcement | Integration under `require` policy | Same-agent pass remains unsatisfying and yields restoration action without a cross-agent stamp |
| No safe review route blocks without hanging or minting evidence | Integration with both routes unavailable | Bounded completion, `action_required`, exactly one recovery action, and no stamp/effect |
| Every outcome leads with its independence status | Human-rendering integration table | First line distinguishes independent, degraded, and not-run outcomes |
| An opaque technical status is not accepted as the builder-facing result | Human-rendering integration | Plain independence line leads; exit/agent/auth classification remains supporting detail |
| The builder receives one actionable recovery step for each failure | Human/JSON result integration table | Exactly one recovery/next action and no package/env/credential-format diagnosis or secret value |
| Each class-1 surface enters the shared coordinator | Skill contract test over quality-review, review-spec, and plan-review templates plus evidence validation | Every surface invokes the same `review run` command and consumes its typed outcome; the evidence layer rejects a surface-private outcome |
| A class-1 surface that bypasses the coordinator fails parity validation | Negative parity fixture | Failure names the omitted surface; public wiring test prevents internal-seam-only coverage |
| Existing desktop or cloud authentication can run the opposite reviewer | Integration environment matrix plus opt-in bidirectional live smoke | Desktop profile and managed-credential fixtures select identical adapters without copied keys |
| A cloud session never invents or exposes a missing reviewer credential | Cloud-auth failure integration | Classified not-authenticated, one sign-in action, and no requested/printed/synthesized secret |
| An explicit opt-out retains the existing route without cross-agent evidence | Public-command integration under `off` policy | Zero opposite subprocesses, `existing_route`, no cross-agent stamp, and plain “not requested” outcome |
| An explicit opt-out cannot satisfy hard cross-agent enforcement | Public-command integration under `off` plus hard enforcement | Cross-agent gate remains unsatisfied, no stamp is minted, and the outcome stays “not requested” |
| Excluded reviewer classes do not enter the cross-agent coordinator | Existing deterministic/fan-out tests plus negative routing table | Class-2, class-3, internal TDD, and Cursor launch no opposite-agent process |

### Affected-surface proof

| Surface | Proof |
| --- | --- |
| Claude Code / Cloud | Canonical installed skill contract, Claude-author integration fixture, and optional Claude→Codex live smoke |
| OpenAI Codex / Cloud | Generated Codex-plugin skill contract, Codex-author integration fixture, and optional Codex→Claude live smoke |
| Safeword CLI | Catalogue fixture, JSON-schema/result test, human renderer test, and subprocess-boundary wiring test |

### Build order

1. **Vertical contract slice**: add closed review types, author detection, opposite-route policy, the minimal coordinator, `review run` catalogue/handler wiring, and symmetric Claude→Codex plus Codex→Claude subprocess-faked integrations. This proves the riskiest assumption in both author directions first.
2. **Packet/isolation slice**: add contained target resolution, bounded neutral snapshots, hashes, cleanup, and vendor-scoped environments; cover write attempts, traversal/symlinks, limits, and secret redaction with real temporary files.
3. **Runtime-adapter slice**: enumerate all executable candidates, capability-check stale/incompatible binaries, send stdin through Node `spawn`, enforce timeout/output caps, and strictly parse Claude JSON and Codex JSONL/output-schema results. Expand the slice-1 wiring paths across stale-candidate, authentication, deadline, and malformed-output boundaries.
4. **Failure/fallback/NTB slice**: implement the full failure matrix, `prefer`/`require`/`off` policy, same-agent fallback, exhaustion, and leading human messages with exactly one recovery action.
5. **Evidence slice**: extend review stamps with optional author/reviewer/independence fields, preserve historical parsing, and make hard cross-agent enforcement require validated distinct-agent provenance.
6. **Surface-parity slice**: route canonical quality-review, scenario review, and implementation-plan review instructions through `review run`; regenerate installed dogfood and Codex-plugin copies; add a parity test that names any bypassing surface. Leave class-2/class-3/TDD routes unchanged.
7. **Rollout/docs/live slice**: keep development guarded until deterministic parity and both live markers pass, then make absent config resolve to `prefer`; document `crossAgentReview` and review outcomes in the configuration and hooks/skills docs; run targeted tests, full verification, and the opt-in desktop smoke. Cloud uses deterministic managed-credential simulations unless a real cloud session is available.

The plan has seven coupled slices and four major components, below the plan-phase split threshold. Splitting would leave surface wiring, evidence, or failure policy temporarily inconsistent, so this remains one feature.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Process input | Explicit executable + structured argv + stdin [1][2][3] | Shell command; trailing prompt argument; direct SDK | Shell/trailing prompts failed under real version skew; SDK duplicates auth and provider configuration |
| Execution boundary | Host-owned coordinator plus neutral packet, tool denial, vendor read-only flags, and post-run hashes [1][4] | Trust nested read-only mode alone; launch from source worktree | The spike showed nested sandbox credential behavior differs; one control cannot prove isolation |
| Command surface | Public typed `review run` using schema-v1 `CliResult` [5] | Hidden hook helper; three skill-private subprocess recipes | Public typed wiring gives one observable contract and existing result/recovery semantics |
| Runtime discovery | Enumerate and capability-check every executable candidate | First `PATH` hit; fixed absolute paths; version string alone | The first PATH hit was stale; absolute paths are non-portable; capabilities survive vendor version formats |
| Authentication | Attempt through the selected CLI with reviewer-scoped environment; classify auth output | Require API keys; preflight-only auth status; copy secrets | Desktop profiles and cloud providers already own auth; status commands can disagree with managed proxies |
| Rollout policy | `prefer` default after proof, `require` hard enforcement, `off` escape hatch | Boolean flag; permanent default-off; silent automatic fallback | Three states preserve default value, enforcement, and honest degradation without ambiguity; `off` implements Scope's explicit opt-out requirement |
| Evidence | Optional backward-compatible author/reviewer/independence stamp fields | Replace stamp schema; trust reviewer prose only | Historical stamps must parse; assigned route and validated identity must be machine-readable |

[1]: `.project/tickets/QZAFT2-cross-agent-adversarial-reviews/spike.md`
[2]: https://docs.anthropic.com/en/docs/claude-code/cli-usage
[3]: https://github.com/openai/codex/blob/main/codex-rs/README.md
[4]: https://nodejs.org/api/child_process.html
[5]: `ARCHITECTURE.md` — “Typed CLI Execution and Discovery”

## Arch alignment

- **Schema as Single Source of Truth**: canonical skill/template edits remain registered and regenerate dogfood/plugin copies rather than drifting them manually.
- **Reconciliation Over Copy** and **Agent Parity**: setup convergence and parity tests carry the shared surface contract to Claude and Codex.
- **Typed CLI Execution and Discovery**: `review run` returns the existing schema-v1 result envelope with declared network behavior and stable recovery.
- **Continuous Quality Gates** and **Architecture Review Gate**: existing content-bound, session-bound review evidence remains authoritative and gains optional provenance rather than a parallel ledger.
- **Per-file host JavaScript toolchain ownership**: reuse the explicit-candidate/no-shell principle for agent executable resolution, while keeping agent discovery outside project-local `node_modules` ownership.

This feature warrants the new architecture entry **Host-owned cross-agent adversarial review coordinator** because it changes the project-wide class-1 review boundary and the meaning of independent review evidence.

## Known deviations

- Existing retro adapters use first-hit `PATH` lookup and trailing prompt arguments. The review path deliberately does not reuse those details because the spike invalidated them; it reuses only neutral cwd, synchronous waiting, output caps, and vendor isolation concepts.
- Codex's nested `read-only` label is not treated as sufficient filesystem evidence. Neutral packet containment and post-run hashes remain mandatory because nested sandbox behavior can vary by host.

## Doc impact

- Update `packages/website/src/content/docs/reference/configuration.mdx` with `crossAgentReview: prefer | require | off`, default behavior, desktop/cloud authentication, and the explicit opt-out.
- Update `packages/website/src/content/docs/reference/hooks-and-skills.mdx` so class-1 review surfaces describe opposite-agent selection, degraded fallback, and blocked outcomes.
- Update `README.md` only if its short workflow summary would otherwise make the new automatic behavior materially misleading; otherwise `skip: the README does not currently document review routing or review configuration details`.

These documentation edits are build-order task 7 and receive the same parity/default assertions as the CLI behavior.

## Assessment triggers

- Claude or Codex changes noninteractive flags, structured output, authentication discovery, or sandbox semantics.
- A host exposes a supported credential-brokering or external-review API that removes the desktop host-boundary limitation.
- Cursor enters the supported cross-agent pairing or a third reviewer vendor is added.
- Review packets exceed the chosen file/count/byte limits often enough to block legitimate work.
- Live smoke shows profile authentication cannot work without weakening judged-work isolation.
- A second consumer needs durable review receipts beyond the existing append-only stamp ledger.
