# Work Log: Prevent advisory workflow drift before release

**Anchored to:** `.project/tickets/YC6JCC-prevent-advisory-workflow-drift/ticket.md`

---

## Session: 2026-08-06

- [03:48] Framed decision: choose a release proof that exercises GitHub's real
  permission, environment-secret, concurrency, fork-event, artifact, and issue
  comment semantics without requiring an unpublished Safeword package or
  executing pull-request code.
- [03:49] Options considered: (A) run the exact installed workflow only after
  npm publication; (B) generate a purpose-built disposable fixture from the
  canonical workflow structure and substitute bounded smoke probes for the
  unpublished CLI commands; (C) rely on static YAML/object tests only.
- [03:51] Research domains: reusable-workflow permission ceilings; environment
  secret timing and job scoping; `pull_request_target` fork safety; repository
  concurrency behavior; ordinary issue comments versus PR reviews/checks; CI
  schema validation; release artifact availability.
- [03:54] Current GitHub contracts: called workflows can only maintain or reduce
  caller token permissions; environment secrets are available only to jobs that
  reference the environment; `pull_request_target` runs trusted default-branch
  workflow code but becomes unsafe if fork code is fetched and executed;
  concurrency groups are repository-wide; ordinary PR timeline comments use
  the issue-comments API, distinct from review APIs.
- [03:56] Decision: use option B. Deterministic tests and actionlint bind the
  fixture shape to the canonical installed router/worker; the disposable public
  repository supplies the runtime proof. The smoke probe checks that only the
  inspection job sees the environment sentinel, its token cannot write, the
  publisher cannot see the sentinel, event and scheduled calls share the
  per-PR concurrency group, and only one marker-owned issue comment changes.
- [03:57] Rejected A because the implementation is not yet published and a
  post-publish-only gate cannot protect the package bytes it is meant to qualify.
  Rejected C because GitHub environment and concurrency semantics are runtime
  behavior, not fully represented by YAML object shape.
- [03:58] Premortem: the fixture drifts into a parallel implementation and goes
  green while the canonical workflow breaks. Mitigation: derive fixture YAML
  from the canonical templates, permit only explicit command/probe substitutions,
  and fail deterministic tests on any unaccounted structural difference.
- [04:08] GREEN: conditional managed files now opt into safe disable-time
  cleanup. Reconciliation removes exact Safeword workflow scaffolds while
  preserving project customizations. ESLint and TypeScript pass; the targeted
  workflow contract suite passes 4/4 tests.
- [04:11] Static compatibility gate: CI downloads actionlint v1.7.12 from its
  checksum-pinned release asset. The checker renders the two installed files
  through the schema, validates them as a pair, then requires a deliberately
  invalid permission fixture to fail. Local actionlint, ESLint, and TypeScript
  checks pass.
- [04:30] Fixture contract: the fork-event router is byte-identical to the
  canonical router; the manual sweep projects the canonical scheduled caller;
  the reusable worker differs only at the three unpublished CLI call sites.
  Static checks now actionlint both canonical and smoke workflows. Fixture tests
  pass 2/2; ESLint and TypeScript pass.
- [04:34] Disposable runner: create a uniquely named public base repository and
  personal fork; inject a random environment-only sentinel; open a fork PR;
  overlap event and scheduled-call probes; require serialization, two successful
  JSON handoffs, one current issue comment, and byte-identical before/after
  merge/review/check/status state; permanently delete both repositories unless
  the explicit debug keep flag is set. ESLint and TypeScript pass.
- [05:43] Runtime reconciliation: GitHub withheld the environment secret until
  reusable callers used `secrets: inherit`; fork-triggered jobs could not write
  even when their declared token scope requested it; and ordinary PR comments
  required `pull-requests: write` in addition to `issues: write`. Added a third,
  trusted `workflow_run` publisher with no checkout/model environment and a
  strict JSON-artifact discovery step. Worker event calls inspect read-only;
  scheduled calls retain direct publication; both final writers share the same
  per-PR concurrency group.
- [05:43] LIVE PASS: disposable base/fork PR 1 produced successful event run
  31116176245, trusted publisher run 31116192147, and scheduled-call projection
  31116229231. GitHub's concurrency API observed one active and one pending
  `pr-review-1` lease. Exactly one current marker comment remained; reviews,
  statuses, and mergeability were unchanged after publication; the model
  sentinel appeared only in inspection; both repositories were permanently
  deleted. The runner also gained bounded retries for read-only API 504s and one
  pinned-action infrastructure failure, while semantic failures remain fatal.
- [06:12] Final verification: workflow and smoke contracts pass 6/6, schema
  contracts pass 36/36, release contracts pass 4/4, and ESLint, TypeScript,
  Prettier, actionlint, and whitespace validation are clean. The release gate
  and evidence are ready for closure confirmation.

## Sources

- https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations
- https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency
- https://docs.github.com/en/rest/issues/comments
- https://docs.github.com/en/rest/pulls/reviews
- https://github.com/rhysd/actionlint/releases/tag/v1.7.12
