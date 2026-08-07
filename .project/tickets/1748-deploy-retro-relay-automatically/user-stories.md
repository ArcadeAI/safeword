# User Stories: Deploy the retro relay automatically

## Story: Ship a reviewed relay change without a local deploy session

As a Safeword maintainer,
I want a relevant merge to `main` to deploy the Retro Relay through Railway,
so that deployment is repeatable and visible in GitHub Actions.

### Acceptance Criteria

#### 1748.SM1.AC1 — Relevant source and build inputs deploy the relay

Given a pull request changes the relay source, Dockerfile, build dependency
manifest, lockfile, or Railway configuration
When that pull request merges to `main`
Then one serialized Retro Relay deployment runs against the configured Railway
project, environment, and service.

#### 1748.SM1.AC2 — Unrelated changes do not deploy the relay

Given a push to `main` changes only unrelated documentation or website content
When GitHub Actions evaluates the push
Then the Retro Relay deployment workflow does not run.

#### 1748.SM1.AC3 — Maintainers can deploy deliberately and safely

Given the automatic path is unsuitable or a redeploy is needed
When a maintainer manually dispatches the workflow
Then it uses the same serialized, project-scoped Railway deployment path.

#### 1748.SM1.AC4 — Missing configuration does not produce a misleading deploy

Given the Railway token or target configuration is absent
When the workflow starts
Then it stops with an actionable error before invoking the Railway CLI.
