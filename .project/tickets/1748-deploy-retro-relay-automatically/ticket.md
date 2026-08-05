---
id: 1748
slug: deploy-retro-relay-automatically
type: feature
phase: done
status: done
created: 2026-08-01T00:00:00Z
last_modified: 2026-08-02T00:10:00Z
external_issues: [https://github.com/ArcadeAI/safeword/issues/1748]
external_prs: [https://github.com/ArcadeAI/safeword/pull/1522]
---

# Deploy the retro relay automatically after main changes

**Goal:** Deploy the private Retro Relay to its existing Railway service when a
relevant change merges to `main`.

**Why:** Maintainers should have a repeatable, auditable production deployment
path instead of relying on a locally authenticated Railway CLI session.

## Scope

- Add a narrowly triggered GitHub Actions workflow with a manual dispatch path.
- Authenticate Railway with a project-scoped repository secret.
- Target the existing project, environment, and service through repository
  configuration rather than committed identifiers.
- Serialize deployments and fail before invoking Railway when required
  configuration is absent.
- Protect the contract with a structural workflow test.

## Out of Scope

- Provisioning Railway resources, secrets, domains, or volumes.
- Enabling client traffic to the relay.
- Multi-replica deployment or a new hosted topology.

## Done When

- A relevant push to `main` deploys the relay exactly once.
- An unrelated push does not deploy it.
- A maintainer can manually run the same workflow.
- The workflow has read-only GitHub permissions, does not log credentials, and
  fails clearly if deployment configuration is missing.
- Focused and repository verification pass.

## Work Log

- 2026-08-01 Started: GitHub issue #1748 created; behavior and test contracts
  precede workflow implementation.
- 2026-08-01 RED: `retro-relay-deploy-workflow.test.ts` failed because
  `.github/workflows/deploy-retro-relay.yml` did not exist.
- 2026-08-01 GREEN: added a narrow Railway CLI workflow, structural guard, and
  administrator setup documentation. Configured the three non-secret GitHub
  repository variables from the verified existing Railway topology; the
  project-scoped `RAILWAY_TOKEN` secret remains an explicit administrator gate.
- 2026-08-02 Verified: focused contract, full relay suite, full repository test
  suite, lint, typecheck, build, audit, and whitespace validation passed.
