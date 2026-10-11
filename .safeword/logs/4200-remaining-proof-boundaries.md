# Epic 4200: remaining proof boundary decision

## Investigation plan

1. Route eligibility: can the shipped catalogue and observed producer identities supply a failed first independent reviewer and a different eligible unattempted reviewer?
2. Evidence producers: do production planning/review entry points retrieve, quarantine and publish evidence, or do current tests only parse authored records?
3. Scope authority: which proof is explicitly deferred, and does that deferral permit epic completion?
4. Guidance authority: do OpenCode enforcement claims agree with the inherited advisory boundary?

## Verified findings

- KKP2R3 owns the two genuine weaker-model cases. They are retained as manual rejection scenarios, not passing acceptance.
- The packaged catalogue has only reciprocal not_weaker pairs between claude-opus-5 and gpt-6.1-sol. For a verified Claude author, the qualified independent producer is Codex. A repeated identical Codex route is not a different reviewer. OpenCode output parsing supplies no observed exact provider/model confirmation. Cursor author capability is explicitly unknown. Neither is a substitute for a second demonstrated eligible reviewer.
- The route loop records attempted failures and remaining unattempted routes; hostContinuationResult checks both independentExhausted and strongerExhausted. The previous budget-only fixture never attempted a first independent route and was correctly withdrawn. No new fabricated route fixture is accepted.
- planning-evidence-boundary.test.ts parses locally authored evidence records and reviewer output. Its positive packet deliberately retains the source's injected instruction/code text. Its no-execution assertion checks local packet preparation, not an actual planning agent, retrieval producer, or publisher.
- The twelve unbound R7 cases require actual planning/review output or installed handling of retrieved evidence. Substituting a hand-authored plan/result or stripping private fields in test setup would bypass the asserted boundary.
- impl-plan.md, Known deviations explicitly says R7 and epic acceptance stay unfinished until the host boundary is proved. execution-plan.md, retrieval-proof-deferral is pending_human and completion-evidence prohibits claiming epic completion while it is open.
- The user deferred OpenCode/cloud verification to MCWV4B. Parent 82T411 makes OpenCode advisory until native enforcement is proved. Current source SAFEWORD.md and bdd/SKILL.md nevertheless say OpenCode CLI/TUI planning approval is enforced. Scenario review c8761cef-813c-40ca-836b-8d76b202a7ed rejects this exact conflict.

## Options and tradeoffs

A. Keep the accepted completion rule and resume real host-boundary proof. Strongest evidence, but lifts the user's deferral and requires a bounded host investigation before implementation; no new retrieval framework is presumed necessary.

B. Move the twelve retrieval-producer cases and second-eligible-route proof to named follow-ons and explicitly narrow epic completion to the delivered local/authenticated boundaries. Smallest immediate scope, but those security/route claims remain unverified. This is a scope decision, not a passing test or authority to merge.

C. Bind them to existing packet/parser tests or duplicate the same reviewer route. Rejected: would count a narrower or fabricated boundary as acceptance.

Recommendation: B if the user still wants to avoid host/qualification expansion. Keep a concrete separate action to correct the two OpenCode template claims to advisory, consistent with the parent; do not amend the parent to assert unproved enforcement. Such correction must regenerate all five managed surfaces and retain the OpenCode follow-on.

Premortem: narrowing completion could be mistaken for full security verification. Keep explicit gaps in the ticket, PR and follow-on acceptance; never label deferred scenarios passed or hide historical failures.

No proposed scope change has been applied. No merge or promotion is authorized.

## Primary-method references

Cucumber step definitions connect scenarios to exercised code; mocked outputs cannot demonstrate the producer that made them:
https://cucumber.io/docs/cucumber/step-definitions/
https://cucumber.io/docs/cucumber/mocking-and-stubbing-with-cucumber/

OWASP treats retrieved content, tool results and sensitive outbound data as separate trust boundaries; local record validation does not establish their behavior:
https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html

## Approved scope and subsequent steering

On 2026-10-10 PDT, the user answered “do it” to the narrower completion scope.
FC33HK now owns the twelve retrieval/evidence producer cases; DRD65E owns the
second-eligible-reviewer proof. The original assertions remain in explicitly
manual/deferred scenarios. The user then reiterated that OpenCode is deferred;
its attempted assertion correction was withdrawn before any template or
production change. Two guidance cases join MCWV4B, totaling eighteen deferred
host/guidance examples. Known enforcement/advisory conflicts remain unverified.

The narrowed dry run has 142 bound skips and zero undefined cases. Skips are
not passes. Scenario review 4918f381-8577-40c6-af5b-707cfa7f3d6b approves the
scope partition, retaining four nonblocking proof/guidance warnings; later
formatting means it is historical evidence, not a current whole-head stamp.
A full 142-case Cucumber run is in progress. No new Astra or qualification run.

The OpenCode diagnostic's extra reporter steps are global Cucumber After hooks,
not extra behavior steps. Two unrelated global failure-cleanup hooks printed
empty fixture notices because they react to any failed scenario. The reviewer
accepted the actual CLI-install/assertion failure; these notices do not establish
an unrelated setup failure. Their source was traced and left outside this change.
