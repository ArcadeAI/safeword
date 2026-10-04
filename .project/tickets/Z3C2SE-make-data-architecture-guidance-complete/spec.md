# Product Plan: Make the data architecture guide complete, conditional, and independently verifiable

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** A downstream eventing plan followed the current guide but still needed repeated review to surface ownership, scope binding, lifecycle, encryption, migration, version-sensitive behavior, and independent proof. The relational-first checklist is simultaneously incomplete for high-risk systems and irrelevant for simpler or non-relational systems.
- **Expected outcome:** A context-free author or reviewer identifies every applicable consequential data contract, records evidence that can falsify it, and omits storage-specific ceremony that the system does not need.
- **Success threshold:** One current content-bound context-free result for each of nine representative cases matches its deterministic expected/forbidden decision-ID and proof-fact-ID rubric with no extra decisions or claims, and a generated-manifest result fails when the guide's independent-proof module is ablated; every record binds model, prompt, response, and guide hash without claiming first-try or repeated-run reliability; the supported install/generation checks keep the canonical, `.safeword`, Claude-native, and embedded CLI template copies coherent, keep Codex free of a competing host-native copy, and resolve each generated planning link to its owned/shared guide path.
- **Project non-goals:** Prescribing a database or provider; requiring production credentials, secrets, customer data, full DDL, or raw query-plan dumps in architecture documents (the relational module records the bounded environment/query/threshold facts needed to validate a claim, not a dump); moving implementation ownership into architecture; duplicating issues #4200 or #4210.

## Jobs To Be Done

### data-architecture-guidance.TBU1 — Plan data changes without irrelevant ceremony

**Persona:** Technical Builder (TBU)

> When my agent authors or reviews a data-heavy change without prior context, I want it to capture the durable decisions that actually apply, so I can start implementation without discovering correctness gaps or filling irrelevant database sections.

#### data-architecture-guidance.TBU1.R1 — Consequential data contracts are recorded while reversible code-local choices remain in implementation planning

#### data-architecture-guidance.TBU1.R2 — Every plan answers the applicable universal questions and invokes only the conditional modules whose triggers fire

#### data-architecture-guidance.TBU1.R3 — Architecture, implementation plans, generated representations, ADRs, and linked evidence each retain a single explicit responsibility

### data-architecture-guidance.TBU2 — Trust claims about complete data coverage

**Persona:** Technical Builder (TBU)

> When a plan claims that data coverage, migration, encryption, retention, or erasure is complete, I want independent and discriminating proof, so I can detect omissions before they reach production.

#### data-architecture-guidance.TBU2.R1 — Every completeness claim names an oracle independent of the mechanism being checked

#### data-architecture-guidance.TBU2.R2 — Conditional proof includes the environment, boundaries, controls, and revalidation conditions needed to falsify the claim

#### data-architecture-guidance.TBU2.R3 — Proof uses synthetic or read-only evidence and never requires secrets, plaintext customer data, or production credentials

### data-architecture-guidance.SWM1 — Ship one trustworthy guide across supported hosts

**Persona:** Safeword Maintainer (SWM)

> When I revise data guidance, I want each host route changed by this issue to resolve the same canonical contract through its existing delivery model, so I can prevent stale copies and drift within the shipped scope.

#### data-architecture-guidance.SWM1.R1 — Post-install/generated guide paths equal an independent hand-maintained inventory exactly; seeded missing-copy, Codex-managed extra-copy, Claude body-drift, and non-path-substitution negatives fail; host path differences are separately maintained literal substitutions; and every planning reference resolves

## Shape

### M1 — Conditional, independently verifiable data guidance

- **Outcome:** Authors and reviewers apply one compact core plus triggered modules and obtain falsifiable, implementation-ready data decisions across simple and high-risk systems.
- **Non-goals:** General implementation-plan completeness, organization-wide architecture placement, or a storage-vendor handbook.

## Killer Demo

> For a Technical Builder starting with a context-free agent and one of nine representative planning cases, applying the guide produces exactly the applicable durable decisions and catches a seeded self-validating omission, visibly proven by hash-bound cold-start rubrics without production credentials or irrelevant storage detail.

## Surfaces

Affected:

- Claude Code
- OpenAI Codex
- Cursor
- Safeword CLI

Unaffected:

- OpenCode — issue #4560 does not add or change an OpenCode guide or planning reference.
- Claude Code Cloud — it consumes the same generated Claude plugin resource as local Claude Code.
- Claude Code on the Web — it consumes the Claude Code Cloud plugin resource rather than a distinct guide copy.
- OpenAI Codex Cloud — repository guide content is unchanged by the cloud execution location.
- Cursor Cloud Agents — repository guide content is unchanged by the cloud execution location.
