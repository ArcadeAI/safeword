# Impl Plan: Migrate legacy Claude projects automatically

**Status:** implemented

## Approach

The riskiest assumption is boundary safety: the same aggregate hook can prove
the exact plugin, authorize irreversible contraction, and still preserve a
successful prompt when migration fails or is interrupted. Prove that seam first
with a generated-runtime integration test. Separately pin the headline latency
claim: benchmark the real largest supported historical fixture against the
2,000 ms outer budget used by the dispatcher and report the distribution in the
release-candidate evidence. The RC gate requires five cold disposable-project
runs (fresh project fixture and filesystem walk each time) with no run over
1,500 ms; if that threshold fails, do not release until the path is optimized or
the lifecycle design is reassessed. First-prompt contraction remains the
expected result while deterministic tests enforce safe deadline deferral. Keep
the budget configurable only in tests so production cannot silently stretch it.

Use one shared typed automatic-migration function as the implementation
boundary. The generated dispatcher imports it in-process, and the explicit CLI
repair action calls that same function; there is no migration subprocess or
duplicate cleanup implementation. "Sibling hooks" means the ordered commands inside Safeword's one
generated aggregate dispatcher, not hooks owned by Claude or another plugin.
The dispatcher already runs those commands sequentially and receives each exit
status. Only after every matching internal command returns zero does it emit the
merged response, write project-bound execution proof, and invoke the shared,
deadline-aware migration function. The function uses shared status,
ownership, and transaction modules; it is silent on clean success and returns
at most one plain-language advisory as hook context when attention remains.
Timeout, contention, and migration errors never turn a successful prompt into a
blocked prompt. A durable transaction lets the next prompt or explicit CLI
status/repair path finish safely.

Build in independently green slices:

0. **Prove the lifecycle seam first.** Own and finish the dispatcher seam here.
   Add the generated-runtime integration
   harness before the migration engine. Define the canonical marker path and
   schema in the shared contract module at this slice so later transaction code
   cannot substitute another marker. The seam accepts pure suppliers for plugin
   identity, catalogue digest, and watched-settings digest; slice 0 tests
   synthetic values and later slices supply real values without reopening it.
   The shared contract module owns all `plugin-mode-v2`, `attention-v1`, and
   `attempts-v1` schemas plus the pure fast-path/re-arm decision in this slice.
   An injected migration-function stub proves
   that the in-process marker check runs before any migration call, internal sibling
   failure prevents proof/action, successful PromptSubmit proof reaches the
   function, and the cooperative 2,000 ms deadline leaves the prompt successful for a
   later retry. This slice owns both marker fast path and timeout permanently.
   The dispatcher owns an append-only `.safeword/claude-plugin/attempts-v1/`
   coordination directory. An exclusively-created initial-session record grants
   that session three numbered launch slots shared by migration and recovery.
   Every later session has one normal launch plus one recovery-only launch when
   a durable transaction already exists.
   Each automatic call first claims its session/slot file with `open(..., 'wx')`,
   including calls that fail before mutation, so concurrent windows cannot lose
   an increment or exceed the cap. The cleanup transaction's own exclusive create
   selects the migration winner; no second launch lock can survive a crash and
   strand recovery. It also reads a durable
   `attention-v1.json` observation marker: unchanged stable conflicts suppress
   further child launches and duplicate advisories in the same session, while a
   watched-settings digest change or a new session permits re-evaluation. It
   offers the explicit repair command but never requires it for a later-session
   retry. This is
   the cheapest proof of the authorization and interruption assumptions.
1. **Historical ownership catalogue.** Generate and commit a deduplicated,
   path-specific digest catalogue from supported released Claude assets through
   0.72, including exact canonical structural fingerprints of every field in a
   released Safeword settings hook entry (event, matcher, type, command, and any
   future fields). A near-match third-party entry is unknown. Check the catalogue against real 0.68, 0.69, and
   0.72 fixtures and fail release validation with release/path/digest evidence.
2. **One exact classifier.** Replace current-template-only comparison and
   substring hook detection with a shared classifier consumed by status,
   cleanup, and setup delivery mode. Exact historical files and settings
   entries are owned; modified, third-party, and uncatalogued bytes are unknown
   and preserved. A mixed settings document is changed with source-range JSONC
   edits using `jsonc-parser`: remove only the exact owned array element while
   preserving untouched bytes, comments, whitespace, key order, values, and
   array order. An exact released
   settings file whose accepted hooks are its only content is deleted rather
   than rewritten to an empty object. Tests pin that every path outside the
   Claude-only inventory—including `.safeword`, Cursor, and Codex delivery—is
   excluded from the plan. Canonical containment and `lstat` checks reject every
   symlinked target or ancestor and every absolute/parent/path-escape candidate
   before a transaction is planned; tests prove the link and external target are
   unchanged and receive one concrete repair advisory.
3. **Forward-idempotent transaction.** Create the repository transaction with
   exclusive `wx` ownership. Record before and after digests/content before the
   first mutation. During recovery, apply the after image when a target matches
   before, accept it when it already matches after, and stop without mutation on
   any third image. Write the plugin-mode marker before retiring the completed
   transaction. Retain the `restore-backup` union as the compatibility default
   for the architecture-recorded Codex consumer and scope automatic Claude
   transactions to `complete-forward`. Remove it only if import,
   construction-site, and Codex recovery tests prove the architecture record is
   stale. Inject a
   filesystem refusal after transaction creation and prove the unchanged target,
   retained recovery evidence, successful hook result, and one retry action.
   The migration function receives a monotonic deadline and checks it before and
   after each atomic target. It walks targets deterministically, committing each
   after image before moving on, so every deadline either advances recovery or leaves the current
   target in a recognized before/after state. Stable non-migratable results write
   `attention-v1.json` bound to plugin identity, catalogue digest, watched Claude
   settings digest, classification, and advisory. Per-state/per-session advisory
   receipt files are exclusively created, preventing duplicate concurrent
   advisories. A partially or wholly unknown legacy inventory writes the new
   `plugin-mode-v2.json` schema with `state: "unresolved"`, the same catalogue
   digest, and unresolved paths: plugin delivery is authoritative, setup cannot
   recreate legacy files, and a later plugin with a new catalogue digest must
   re-evaluate those paths rather than taking the marker fast path. Clean and
   fresh convergence use the same required schema with `state: "clean"` and an
   empty unresolved list. The old v1 marker is accepted only as the known-clean
   compatibility shape and is lazily rewritten to v2. Marker/attention records
   cache the advisory; exclusive receipts let the dispatcher surface it once per
   session without launching the CLI or repeating noise on every prompt.
4. **Automatic plugin entrypoint.** Replace slice 0's stub with the real shared
   migration function; do not rebuild the dispatcher seam. Register the explicit
   repair command's catalogue entry with project-filesystem and marker mutation
   effects, include every in-process dependency in the generated plugin
   catalogue, and call the function only
   after successful exact `UserPromptSubmit` proof. Consume slice 0's in-process
   marker, attention, attempt-cap, and cooperative-deadline seam unchanged. Merge all remaining conflicts or recovery guidance into
   one non-blocking hook context message; failed sibling hooks write neither
   proof nor transaction. Unproven status emits reload as its sole action. Run
   the largest real historical fixture through this entrypoint as a measured
   benchmark; record whether it fits the 2,000 ms target without making variable
   CI wall-clock speed a correctness assertion.
5. **Scope and fresh-project convergence.** Preserve the project marketplace and
   enablement declarations. Resolve identical applicable project/user entries
   to the project-scoped effective installation while emitting one hook context
   block; retain `scope-overlap` for incompatible identities. A proven project
   with no legacy assets writes the marker directly instead of reporting
   coexistence.
6. **Host and release proof.** Exercise real historical fixtures, generated
   runtime wiring, induced process contention, crash recovery, and a disposable
   Claude profile/project. Verify the project declaration survives and Claude
   presents its supported trust/install flow to a new teammate. Run a mid-session
   plugin upgrade plus `/reload-plugins`, then prove the new dispatcher may
   authorize legacy contraction while independently recording whether Claude's
   loaded skill catalogue is coherent; hook proof authorizes plugin delivery but
   does not claim host catalogue coherence. Also observe a deliberately
   over-budget disposable hook to record whether Claude preserves the prompt
   when the host, rather than Safeword's cooperative deadline, terminates it.
   Update operator
   and migration docs, then run BDD, targeted and full tests, release contracts,
   lint, typecheck, audit, refactor review, verification, and quality review.

## Decisions

| Decision | Choice | Alternatives considered | Rejected because |
| --- | --- | --- | --- |
| Lifecycle boundary | Successful aggregate `UserPromptSubmit`, immediately after every internal dispatcher command succeeds and exact project-bound proof is written | SessionStart; setup/upgrade only; background detached job | PromptSubmit runs immediately after live `/reload-plugins`, can report one context advisory on the next interaction, and supplies repository identity. SessionStart may precede reload and remain under viable legacy authority for the session; setup misses directly opened repos; detached mutation loses a reliable recovery/reporting boundary. An in-process marker read prevents a child spawn on later prompts |
| Runtime boundary | Dispatcher and explicit repair command call one shared migration function in-process | Spawn bundled CLI; duplicate cleanup logic inside dispatcher | Shared import removes process startup and kill/lock failure modes without duplicating status, ownership, or transaction logic; generated catalogue closure proves the shipped dispatcher includes it |
| Hook cadence | In-process plugin-mode/attention fast paths plus a cooperative 2,000 ms deadline; at most three automatic calls shared by migration and recovery in the first session, then one normal launch and one transaction-recovery launch per later session; deterministic fake-clock tests and five cold disposable-fixture RC runs capped at 1,500 ms | Unlimited calls; subprocess timeout; never attempt automatically; hard shared-CI wall-clock threshold | The dedicated later-session recovery slot lets a durable transaction finish even after that session spent its normal launch, while the separate one-slot cap prevents a third-image conflict from retrying forever. Cold release-host evidence protects the prompt-one expectation without making shared-runner speed a flaky shared-CI gate |
| Ownership | Immutable path-specific released-byte catalogue plus structural settings-entry fingerprints | Current template only; path/name heuristics; `.includes('.safeword')` | Historical clean files otherwise look modified, while string heuristics can delete third-party commands |
| Partial contraction | Remove every recognized item, preserve and report every unknown item, then enter plugin mode | Abort all cleanup on one unknown item; delete the whole legacy tree | The user wants framework junk gone on first upgrade, but ownership must remain byte-provable |
| Recovery | Exclusive transaction; each target may be in recorded before or after state; a losing process polls briefly for the winner's marker | Require all-before; rollback; immediately report contention | Real crashes create mixed states; rollback would overwrite a valid forward state and has no reliable backup producer today. A small bounded wait lets ordinary races report the same completion; an over-budget winner produces one retry advisory and converges later |
| Scope overlap | Identical exact user/project entries resolve to one effective project installation; incompatible entries remain visible | Treat every overlap as an error; remove user scope | Live Claude uses one shared payload for identical entries; deleting user scope could remove protection from unrelated repositories |
| Teammate enrollment | Preserve committed project declaration and rely on Claude's documented trust/install prompt | Silently accept trust; vendor plugin bytes | Trust is a human security decision, while vendoring recreates upgrade churn |

Evidence: Claude's plugin documentation describes project and user installation,
project declarations, teammate installation after repository trust, plugin
reload, and automatic marketplace updates. Claude's settings documentation
defines project-over-user precedence, and its hooks documentation identifies
`UserPromptSubmit` as a context-producing event. Live Claude 2.1.170 trials
showed identical user/project entries sharing one install path; because the
documentation does not explicitly guarantee same-name replacement semantics,
that behavior stays in the release-candidate acceptance runbook.

## Design alignment

- Preserves schema/catalogue as the source of truth: the generated dispatcher,
  hidden action, historical catalogue, and runtime dependencies are checked as
  one release contract.
- Preserves reconciliation over copying: only exact owned artifacts contract;
  unknown project bytes remain authoritative.
- The dispatcher owns only bounded lifecycle coordination: read-only fast-path
  policy plus atomic launch/advisory receipts and a timeout. Classification and
  project-content mutation stay in typed CLI modules shared with explicit
  diagnostics.
- Keeps the default invisible and teammate-like: clean migration is silent;
  one concrete action is reported when Safeword cannot safely finish.
- Records the deliberate supersession of human-confirmed cleanup and blanket
  scope-overlap handling in `ARCHITECTURE.md`.

## Known deviations

- Supersedes ticket `0S31PG`'s explicit human confirmation after current,
  project-bound execution proof. The new transaction and historical ownership
  catalogue provide the safety boundary that confirmation previously supplied.
- Supersedes ticket `H87DZR`'s unconditional `scope-overlap` result only when all
  applicable entries have the exact same plugin identity and payload. Any
  incompatible overlap still fails closed without contraction.
- Automatic migration is bounded rather than guaranteed to finish during the
  first prompt. If the host deadline or a concurrent edit wins, the prompt
  continues and the durable next attempt converges or reports one action.
- The 1,500 ms RC benchmark is evidence from the release host, not a guarantee
  about every developer machine. Slower machines may safely converge on a later
  prompt or session within the fixed launch cap.
- Successful exact hook execution authorizes retiring project-local Claude
  delivery; it does not prove that a long-lived Claude session refreshed every
  cached skill description. The mid-session reload acceptance records that host
  behavior, and a new session remains the coherence fallback.
- A third-image recovery conflict cannot self-heal without deciding whose bytes
  win. Its cached once-per-session advisory must name the exact path and the
  explicit `safeword claude repair` action in plain language.
- If Claude changes same-name cross-scope resolution, Safeword falls back to the
  existing visible `scope-overlap` state; it never infers one effective
  installation from mismatched paths, identities, or payload digests.

## Documentation impact

Update the Claude migration and maintainer release documentation to explain:
automatic post-proof contraction, preserved-content advisories, project-scope
teammate enrollment, identical dual-scope behavior, recovery, and the real-host
release-candidate check. No release or publish occurs in this ticket session.

## Assessment triggers

- Claude documents or changes effective-scope resolution, project trust,
  teammate plugin installation, hook time budgets, or plugin reload semantics.
- Historical releases before the supported catalogue floor must migrate.
- A future asynchronous host API permits cancellation during one blocking
  filesystem primitive rather than only between atomic targets.
- Repository filesystems cannot provide exclusive create/atomic rename semantics.
