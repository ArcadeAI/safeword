import nodePath from 'node:path';

import YAML from 'yaml';

import { getTemplatesDirectory, readFile } from '../utils/fs.js';

interface Step extends Record<string, unknown> {
  env: Record<string, string>;
  name?: string;
  run?: string;
}

interface Job extends Record<string, unknown> {
  steps?: Step[];
  with?: Record<string, unknown>;
}

interface Workflow extends Record<string, unknown> {
  jobs: Record<string, Job>;
}

export interface PrReviewSmokeFixture {
  config: string;
  router: string;
  sweep: string;
  worker: string;
}

function namedStep(workflow: Workflow, job: string, name: string): Step {
  const step = workflow.jobs[job]?.steps?.find(candidate => candidate.name === name);
  if (step === undefined) throw new Error(`canonical workflow is missing ${job}/${name}`);
  return step;
}

export function createPrReviewSmokeFixture(version: string): PrReviewSmokeFixture {
  const templatesDirectory = getTemplatesDirectory();
  const routerSource = readFile(nodePath.join(templatesDirectory, 'workflows/pr-review.yml'));
  const workerSource = readFile(
    nodePath.join(templatesDirectory, 'workflows/pr-review-worker.yml'),
  );
  const worker = YAML.parse(workerSource.split('__SAFEWORD_VERSION__').join(version)) as Workflow;

  const invalidate = namedStep(worker, 'invalidate', 'Invalidate any obsolete advisory route');
  invalidate.env.OPENAI_API_KEY = '${{ secrets.OPENAI_API_KEY }}';
  invalidate.run = `
if [ -n "$OPENAI_API_KEY" ]; then
  echo '::error::model secret escaped into the write-capable invalidation job'
  exit 1
fi
`.trim();

  const inspect = namedStep(
    worker,
    'inspect',
    'Inspect bounded evidence without GitHub write authority',
  );
  inspect.env.SAFEWORD_SMOKE_HOLD_SECONDS =
    "${{ github.event_name == 'pull_request_target' && '45' || '0' }}";
  inspect.run = `
if [ -z "$OPENAI_API_KEY" ]; then
  echo '::error::inspection job did not receive its environment-scoped secret'
  exit 1
fi
if gh api --method POST "repos/$GITHUB_REPOSITORY/issues/$SAFEWORD_PR_NUMBER/comments" \
  -f body='write authority escaped into inspection' >/tmp/write-response 2>/tmp/write-error; then
  echo '::error::read-only inspection token unexpectedly wrote an issue comment'
  exit 1
fi
sleep "$SAFEWORD_SMOKE_HOLD_SECONDS"
jq -n '{secretScopedToInspection: true, inspectionWriteDenied: true}' > advisory-result.json
`.trim();

  const publish = namedStep(worker, 'publish', 'Publish one ordinary pull-request comment');
  publish.env.OPENAI_API_KEY = '${{ secrets.OPENAI_API_KEY }}';
  publish.run = `
if [ -n "$OPENAI_API_KEY" ]; then
  echo '::error::model secret escaped into the write-capable publication job'
  exit 1
fi
head_sha="$(gh api "repos/$GITHUB_REPOSITORY/pulls/$SAFEWORD_PR_NUMBER" --jq .head.sha)"
body="$(printf '<!-- safeword:pr-review-receipt:v1 -->\n## Safeword advisory PR review smoke\n\nReviewed revision: %s\nRoute: needs_human\n' "$head_sha")"
comment_id="$(gh api "repos/$GITHUB_REPOSITORY/issues/$SAFEWORD_PR_NUMBER/comments?per_page=100" \
  --paginate --jq '.[] | select(.user.type == "Bot" and (.body | startswith("<!-- safeword:pr-review-receipt:v1 -->"))) | .id' | head -1)"
if [ -z "$comment_id" ]; then
  gh api --method POST "repos/$GITHUB_REPOSITORY/issues/$SAFEWORD_PR_NUMBER/comments" -f body="$body" >/dev/null
else
  gh api --method PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$comment_id" -f body="$body" >/dev/null
fi
`.trim();

  const router = YAML.parse(routerSource) as Workflow;
  const scheduledReview = structuredClone(router.jobs['scheduled-review']);
  if (scheduledReview?.with === undefined) {
    throw new Error('canonical workflow is missing scheduled-review inputs');
  }
  delete scheduledReview.needs;
  delete scheduledReview.if;
  delete scheduledReview.strategy;
  scheduledReview.with.pull_number = '${{ inputs.pull_number }}';

  const sweep: Workflow = {
    name: 'Safeword advisory PR review smoke sweep',
    on: {
      workflow_dispatch: {
        inputs: {
          pull_number: {
            description: 'Disposable fixture pull request',
            required: true,
            type: 'number',
          },
        },
      },
    },
    permissions: {},
    jobs: { 'scheduled-review': scheduledReview },
  };

  return {
    config: `${JSON.stringify({ prReview: { enabled: true } }, undefined, 2)}\n`,
    router: routerSource.split('__SAFEWORD_VERSION__').join(version),
    sweep: YAML.stringify(sweep, { lineWidth: 0 }),
    worker: YAML.stringify(worker, { lineWidth: 0 }),
  };
}
