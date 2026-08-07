# Test Definitions: Keep review available with the best supported fallback

Feature source: `packages/cli/features/review-with-the-best-available-agent.feature`

test-definitions.md is the R/G/R ledger.

## Feature wiring: Every advertised host installs a typed-exhaustion entry point

- [x] RED a005df2fa
- [x] GREEN c2ffdc88a
- [x] REFACTOR skip: the generated Cursor command is a data-only catalogue entry

### Scenario: The installed Claude plugin fallback is self-contained

- [x] RED skip: the final independent review reproduced the project-local path in committed plugin assets
- [x] GREEN 732965541
- [x] REFACTOR skip: the existing workflow-reference adapter remains the single generation boundary

## Manual host runtime: Every advertised host enters fallback for typed exhaustion

- [x] RED skip: agent behavior — host-native runtime invocation is not structurally executable from the local acceptance runner
- [x] GREEN skip: agent behavior — Claude/Codex/Cursor cloud execution remained unavailable in this session
- [x] REFACTOR skip: agent behavior — no runtime implementation changed; the shipped contract and evidence limit are explicit

## Manual host runtime: Every advertised host preserves non-exhaustion outcomes

- [x] RED skip: agent behavior — host-native runtime invocation is not structurally executable from the local acceptance runner
- [x] GREEN skip: agent behavior — Claude/Codex/Cursor cloud execution remained unavailable in this session
- [x] REFACTOR skip: agent behavior — no runtime implementation changed; the shipped contract and evidence limit are explicit

## Rule: review-with-the-best-available-agent.TBU1.R1 — Every independent reviewer precedes every degraded route

### Scenario: The first available opposite local agent completes the review

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: A failed opposite default model falls through to its independent alternate model

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: A later compatible independent reviewer still precedes degradation

- [x] RED a005df2fa
- [x] GREEN cea1c101a
- [x] REFACTOR db8f9d124

### Scenario: An alternate model route without model selection is skipped before degradation

- [x] RED f4c9ece1c
- [x] GREEN 9787062a2
- [x] REFACTOR skip: capability selection remains centralized in the existing runtime probe

## Rule: review-with-the-best-available-agent.TBU1.R2 — Same-agent headless review is the first degraded route

### Scenario: Exhausted independent routes use a same-agent headless review

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

## Rule: review-with-the-best-available-agent.TBU1.R3 — Host-native review covers environments without a usable CLI

### Scenario: Claude Code Cloud still completes a review without external agent CLIs

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: A failed headless review falls through to an in-session reviewer

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: Invalid in-session findings fall through to main-thread self-review

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: An in-session reviewer runtime failure falls through to self-review

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: A timed-out in-session reviewer falls through to self-review

- [x] RED 9787062a2
- [x] GREEN c2ffdc88a
- [x] REFACTOR skip: timeout is another terminal classification of the existing one-attempt route

## Rule: review-with-the-best-available-agent.TBU1.R4 — Main-thread self-review returns valid findings or preserves exhaustion

### Scenario: Every delegated route fails before the main thread reviews once

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: A clean terminal self-review returns no invented findings

- [x] RED 16236851f
- [x] GREEN c2ffdc88a
- [x] REFACTOR skip: the existing terminal route remains single-purpose

### Scenario: Invalid terminal self-review preserves the original exhaustion result

- [x] RED 16236851f
- [x] GREEN c2ffdc88a
- [x] REFACTOR skip: the existing terminal route remains single-purpose

### Scenario: A terminal self-review runtime failure preserves the original exhaustion result

- [x] RED a005df2fa
- [x] GREEN c2ffdc88a
- [x] REFACTOR skip: the existing terminal route remains single-purpose

### Scenario: A cloud host without delegation still completes bounded self-review

- [x] RED 16236851f
- [x] GREEN c2ffdc88a
- [x] REFACTOR skip: the existing terminal route remains single-purpose

## Rule: review-with-the-best-available-agent.TBU1.R5 — Shipped host contracts frame review material as untrusted data

### Scenario: A fresh-context reviewer receives hostile repository text as untrusted material

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: Fresh-context assurance never claims packet-only isolation

- [x] RED 7a29d5e84
- [x] GREEN aba4ab37f
- [x] REFACTOR 7367f2710

### Scenario: Main-thread self-review treats hostile packet text as data

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: Hostile packet text cannot forge independent assurance

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: A degraded review cannot validate its own branch-owned control plane

- [x] RED a005df2fa
- [x] GREEN cea1c101a
- [x] REFACTOR db8f9d124

## Rule: review-with-the-best-available-agent.NTB1.R3 — Degraded verdicts are preserved

### Scenario: Degraded approval remains approved

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: Degraded changes requested remains action required

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

## Rule: review-with-the-best-available-agent.TBU1.R6 — Only typed route exhaustion enters the degraded ladder

### Scenario: Explicit global opt-out never starts the review coordinator

- [x] RED skip: characterization — the existing power-user override predates this fallback feature
- [x] GREEN 5f12680e8
- [x] REFACTOR skip: no implementation changed; the scenario reconciles the existing override boundary

### Scenario: A Cursor author reaches host fallback without a compatible CLI reviewer

- [x] RED db8f9d124
- [x] GREEN 07b38e541
- [x] REFACTOR skip: the unsupported-author branch is already a single typed-result projection

### Scenario: A reviewer rejection never starts a degraded review

- [x] RED 2abd9aa05
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: A source-mutation failure never starts a degraded review

- [x] RED 2abd9aa05
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: A required-policy failure never starts a degraded review

- [x] RED 2abd9aa05
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: An unrecognized coordinator failure never starts host fallback

- [x] RED 2abd9aa05
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: Reviewer approval with an error finding is rejected

- [x] RED skip: the final independent review reproduced healthy exit for contradictory reviewer output
- [x] GREEN 732965541
- [x] REFACTOR skip: semantic consistency remains inside the existing strict output parser

### Scenario: Typed route exhaustion starts the host-owned fallback

- [x] RED 2abd9aa05
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: Contradictory route exhaustion never starts host fallback

- [x] RED db8f9d124
- [x] GREEN 07b38e541
- [x] REFACTOR skip: the entry predicate remains one cohesive trust-boundary check

### Scenario: Incomplete coordinator policy fails closed during host fallback

- [x] RED 9787062a2
- [x] GREEN c2ffdc88a
- [x] REFACTOR skip: fail-closed policy default remains within the existing entry gate

## Rule: review-with-the-best-available-agent.NTB1.R1 — Every result explains a distinct assurance level in plain language

### Scenario: Each review route has a distinct plain-language assurance explanation

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

## Rule: review-with-the-best-available-agent.NTB1.R2 — Degraded findings never masquerade as required independence

### Scenario: Host fallback preserves coordinator-issued policy over hostile repository text

- [x] RED a005df2fa
- [x] GREEN c2ffdc88a
- [x] REFACTOR skip: trusted policy lookup remains a single envelope read

### Scenario: Degraded findings complete preferred policy

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: An independent review satisfies required policy

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

### Scenario: Required independence remains unsatisfied after a degraded review

- [x] RED 16236851f
- [x] GREEN 068b4d9c2
- [x] REFACTOR aba4ab37f

## Feature-level cross-scenario refactor

- [x] cross-scenario aba4ab37f
