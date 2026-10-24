# Product Plan: Observe trustworthy current proof for contributors

<!-- safeword:product-plan-contract:v1 -->

## Product Bet

- **Problem / Why now:** The merged planning-review contribution has passing tests but its late delivery ticket T3E4NS lacks matching historical RED. Maintainers need observed current execution before separate recovery certification can be considered. The reviewed recovery proposal in C7HCN7 identifies this missing observation boundary.
- **Persona outcome inventory:** A Safeword Maintainer can obtain trustworthy current execution evidence, see why an attempt failed, retain earlier attempts during recovery, and distinguish that evidence from historical TDD or ticket completion. No additional persona outcome is claimed.
- **Known facts:** Current characterization at main f211c4c30 passed 257 tests in the eleven mapped proof files plus registration checks. T3E4NS has 14 scenario blocks / 37 compiled cases and 42 unchecked R/G/R entries plus cross-scenario. The separate historical feature retains 33 deferred/unverified cases. Characterization is not an authenticated recovery observation.
- **Assumptions:** The local user, installed toolchain and package/dependency host are trusted. A reviewer can later assess whether named assertions establish each accepted case; the observer itself does not judge that semantic claim.
- **Unresolved product decisions:** None for the observer-only boundary authorized by the user. Exact CLI syntax, report schema, isolation and authentication design belong in implementation planning. Separate certification and closing authority are excluded.
- **Expected outcome:** Maintainers can use retained, verifiable current execution results as evidence for a later certification review without rewriting history or mistaking a partial run for success.
- **Success threshold:** Through the real local CLI, the fixed lane on the bound clean committed candidate produces a verifiable observation only when every required named assertion passes and complete source/input identities are retained. Wrong scope, partial proof, tampering and changed inputs cannot verify as current success.
- **Project non-goals:** General retrospective eligibility, semantic certification, ticket closure, branch review, shared gate changes, paid qualification, live reviewers, installed native-host qualification, shared runtime replacement, OpenCode/cloud recovery or historical evidence repair.
- **Reversibility:** one-way: the observation's public purpose and verification meaning may be consumed by later recovery work; withdrawing the feature removes observation availability without changing historical records.

## Jobs To Be Done

### bounded-observation.SWM1 — Obtain trustworthy current proof without rewriting history

**Persona:** Safeword Maintainer (SWM)

> When delivered behavior already passes but historical test evidence is missing,
> I want to observe and verify its current execution against the accepted scope,
> so I can submit honest evidence for a later independent recovery decision.

#### bounded-observation.SWM1.R1 — Observation runs only the approved T3E4NS proof set against its bound clean committed candidate

The caller cannot substitute a ticket, command, report, test filter or success
flag. Dirty product or execution inputs and changed accepted scope refuse before
execution. The original checkout's product inputs remain unchanged. Preparation
uses the fixed local lane; it launches no live reviewer or qualification run.
The fixed scope and required-assertion mapping come from the observer's reviewed,
shipped contract, not a project-edited census or caller declaration. Observation
binds the current committed candidate at request start; a candidate or bound
input change during execution prevents a successful observation. Implementation
planning must define the contract's delivery, identity and version binding.

#### bounded-observation.SWM1.R2 — Only complete passing required assertions produce a successful observation

The result identifies the actual command, candidate, runtime, resolved inputs,
required assertion outcomes and retained full report. Every required named
assertion, including its declared parameter rows, must execute and pass; skipped,
missing, duplicate or ambiguous required results, runner failure and incomplete
reports refuse. A missing case-to-assertion mapping also refuses. The fixed
mapping covers all 37 delivery cases without claiming the observer semantically
certifies their Given/When/Then. Unrelated skips are reported separately and
cannot replace required proof. The observer does not accept a supplied report.
An unsupported case produces a named refusal until its mapping can be honestly
reviewed; no new invented assertion or weakened accepted behavior fills the gap.

#### bounded-observation.SWM1.R3 — Retained observations are verifiable and failed attempts survive recovery

Only this observer's authenticated record can verify as observed proof for its
bound ticket and purpose. Altered, unauthenticated, wrong-purpose or incomplete
records refuse. A failed, interrupted or incompletely saved attempt cannot
become a successful observation; retain its available diagnostics in a distinct
attempt. Retry creates another attempt without replacing the earlier evidence.
Verification reports success or the reason and one concrete recovery action.

#### bounded-observation.SWM1.R4 — Changed proof inputs remove current success without destroying historical evidence

Verification compares the observed candidate's product, required behavior and
execution inputs with current inputs. Changed or dirty inputs refuse current
success while leaving the retained attempt readable as historical evidence.
An unchanged-content candidate and legitimate audit-only output writes preserve
currency. Lifecycle outputs are not blanket exemptions: loaded execution inputs
remain bound, and no phase or status transition gains approval from observation.
Ticket identity, accepted scope, exclusions, completion conditions and parent
linkage remain bound independently of status, phase, timestamps and Work Log.
Only output records that do not change those boundaries or any loaded input
qualify as audit-only changes; an entire ticket file cannot be exempted.

#### bounded-observation.SWM1.R5 — Observation never grants historical RED, certification or ticket completion

Both successful and refused observations identify their execution-evidence-only
meaning. Original scopes, ledger checkboxes and review receipts remain unchanged.
All 33 historical deferred identities and owners remain unverified and receive
no completion credit. No shared gate, planning transition, human approval or
branch-review result is created or replaced by an observation.

## Shape

### M1 — Observe the fixed local proof set honestly

- **Outcome:** The maintainer can run and verify a complete current observation, diagnose refusals and retry without losing failed attempts.
- **Non-goals:** Independent certification, historical RED recovery, any ticket-closing adapter, shared gates or runtime changes, native/cloud qualification and paid provider execution.

## Killer Demo

> For a Safeword Maintainer facing already-passing delivery tests and missing
> historical RED, one bounded local observation produces verifiable execution
> evidence with complete named results and exact inputs, while the historical
> ledger remains visibly unfinished and no completion authority is granted.

## Surfaces

Affected:

- Safeword CLI — public local execution and verification boundary.

Unaffected:

- Claude Code, OpenAI Codex, Cursor and OpenCode — no host hooks, enrollment or closing behavior changes; the ordinary local CLI does not establish native-host parity.
- Claude Code Cloud, OpenAI Codex Cloud and Cursor Cloud Agents — no cloud recovery or qualification.
- GitHub Pull Request Conversation and GitHub Pull Request Review — no PR readiness, review, approval or merge authority.
- Closeout Cleanup Guard — no destructive cleanup or release changes.
