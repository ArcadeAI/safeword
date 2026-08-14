/**
 * Deployment wiring guard: the private relay must have a narrow, safe, and
 * manually operable production deployment path.
 */

import { describe, expect, it } from 'vitest';

import { readGitHubWorkflow, requiredJob, requiredStep } from './helpers/github-workflow.js';

describe('Retro Relay deployment workflow', () => {
  it('keeps an environment-protected manual recovery path', () => {
    const workflow = readGitHubWorkflow('deploy-retro-relay.yml');
    const deployment = requiredJob(workflow, 'deploy');
    const validationStep = requiredStep(deployment, 'Validate deployment configuration');
    const deployStep = requiredStep(deployment, 'Deploy through Railway');

    expect(workflow.on).toBe('workflow_dispatch');
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({
      group: 'retro-relay-production',
      'cancel-in-progress': false,
    });
    expect(deployment.environment).toBe('retro-relay-production');
    expect(deployment.steps?.some(step => step.uses === 'actions/setup-node@v7')).toBe(true);
    expect(validationStep.env).toMatchObject({
      RAILWAY_TOKEN: '${{ secrets.RAILWAY_TOKEN }}',
      RAILWAY_PROJECT_ID: '${{ vars.RAILWAY_RETRO_RELAY_PROJECT_ID }}',
      RAILWAY_ENVIRONMENT: '${{ vars.RAILWAY_RETRO_RELAY_ENVIRONMENT }}',
      RAILWAY_SERVICE: '${{ vars.RAILWAY_RETRO_RELAY_SERVICE }}',
    });
    expect(validationStep.run).toContain('Missing RAILWAY_TOKEN environment secret');
    expect(deployStep.env).toEqual(validationStep.env);
    expect(deployStep.run).toContain('railway up --ci');
    expect(deployStep.run).toContain('--project "$RAILWAY_PROJECT_ID"');
    expect(deployStep.run).toContain('--environment "$RAILWAY_ENVIRONMENT"');
    expect(deployStep.run).toContain('--service "$RAILWAY_SERVICE"');
    expect(deployStep.run).not.toContain('echo "$RAILWAY_TOKEN"');
  });

  it('deploys relevant main changes only after every CI gate passes', () => {
    const workflow = readGitHubWorkflow('ci.yml');
    const deployment = requiredJob(workflow, 'deploy-retro-relay');
    const inputs = requiredJob(workflow, 'relay-inputs');
    const detectStep = requiredStep(inputs, 'Detect relay deployment inputs');
    const deployStep = requiredStep(deployment, 'Deploy through Railway');
    expect(deployment.needs).toEqual([
      'dogfood-parity',
      'cli-contract',
      'dependency-audit',
      'test',
      'lint',
      'relay-inputs',
    ]);
    expect(deployment.environment).toBe('retro-relay-production');
    expect(deployment.if).toContain("github.ref == 'refs/heads/main'");
    expect(detectStep.run).toContain('git diff --name-only "$BEFORE" "$SHA"');
    expect(detectStep.run).toContain('packages/retro-relay/*');
    expect(deployStep.env?.RAILWAY_TOKEN).toBe('${{ secrets.RAILWAY_TOKEN }}');
    expect(deployStep.run).toContain('railway up --ci');
  });
});
