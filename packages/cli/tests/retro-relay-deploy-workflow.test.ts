/**
 * Deployment wiring guard: the private relay must have a narrow, safe, and
 * manually operable production deployment path.
 */

import { readFileSync } from 'node:fs';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const workflowPath = nodePath.resolve(
  import.meta.dirname,
  '../../../.github/workflows/deploy-retro-relay.yml',
);
const ciWorkflowPath = nodePath.resolve(import.meta.dirname, '../../../.github/workflows/ci.yml');
const collectorWorkflowPath = nodePath.resolve(
  import.meta.dirname,
  '../../../.github/workflows/deploy-retro-collector.yml',
);

describe('Retro Relay deployment workflow', () => {
  it('keeps an environment-protected manual recovery path', () => {
    const source = readFileSync(workflowPath, 'utf8');
    const workflow = parse(source) as {
      on: string;
      permissions: { contents: string };
      concurrency: { group: string; 'cancel-in-progress': boolean };
    };

    expect(workflow.on).toBe('workflow_dispatch');
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({
      group: 'retro-relay-production',
      'cancel-in-progress': false,
    });
    expect(source).toContain('environment: retro-relay-production');
    expect(source).toContain('actions/setup-node@v7');
    expect(source).toContain('RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}');
    expect(source).toContain('RAILWAY_PROJECT_ID: ${{ vars.RAILWAY_RETRO_RELAY_PROJECT_ID }}');
    expect(source).toContain('RAILWAY_ENVIRONMENT: ${{ vars.RAILWAY_RETRO_RELAY_ENVIRONMENT }}');
    expect(source).toContain('RAILWAY_SERVICE: ${{ vars.RAILWAY_RETRO_RELAY_SERVICE }}');
    expect(source).toContain('Missing RAILWAY_TOKEN environment secret');
    expect(source).toContain('railway up --ci');
    expect(source).toContain('--project "$RAILWAY_PROJECT_ID"');
    expect(source).toContain('--environment "$RAILWAY_ENVIRONMENT"');
    expect(source).toContain('--service "$RAILWAY_SERVICE"');
    expect(source).not.toContain('echo "$RAILWAY_TOKEN"');
  });

  it('deploys relevant main changes only after every CI gate passes', () => {
    const source = readFileSync(ciWorkflowPath, 'utf8');
    const workflow = parse(source) as {
      jobs: Record<string, { needs?: string[]; environment?: string; if?: string }>;
    };

    const deployment = workflow.jobs['deploy-retro-relay'];
    expect(deployment).toBeDefined();
    if (deployment === undefined) throw new Error('missing deploy-retro-relay job');
    expect(deployment.needs).toEqual([
      'dogfood-parity',
      'dependency-audit',
      'opencode-conformance',
      'test',
      'lint',
      'relay-inputs',
    ]);
    expect(deployment.environment).toBe('retro-relay-production');
    expect(deployment.if).toContain("github.ref == 'refs/heads/main'");
    expect(source).toContain('git diff --name-only "$BEFORE" "$SHA"');
    expect(source).toContain('packages/retro-relay/*');
    expect(source).toContain('RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}');
    expect(source).toContain('railway up --ci');
  });
});

describe('Public retro collector deployment workflow', () => {
  it('keeps a separate environment-protected manual deployment path', () => {
    const source = readFileSync(collectorWorkflowPath, 'utf8');
    const workflow = parse(source) as {
      on: string;
      permissions: { contents: string };
      concurrency: { group: string; 'cancel-in-progress': boolean };
    };

    expect(workflow.on).toBe('workflow_dispatch');
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency.group).toBe('retro-collector-production');
    expect(source).toContain('environment: retro-relay-production');
    expect(source).toContain('RAILWAY_SERVICE: ${{ vars.RAILWAY_RETRO_COLLECTOR_SERVICE }}');
    expect(source).toContain('railway up --ci');
  });

  it('deploys collector changes only after every CI gate passes', () => {
    const source = readFileSync(ciWorkflowPath, 'utf8');
    const workflow = parse(source) as {
      jobs: Record<string, { needs?: string[]; environment?: string; if?: string }>;
    };
    const deployment = workflow.jobs['deploy-retro-collector'];

    expect(deployment).toBeDefined();
    expect(deployment?.needs).toEqual([
      'dogfood-parity',
      'dependency-audit',
      'opencode-conformance',
      'test',
      'lint',
      'collector-inputs',
    ]);
    expect(deployment?.environment).toBe('retro-relay-production');
    expect(deployment?.if).toContain("github.ref == 'refs/heads/main'");
    expect(source).toContain('packages/retro-collector/*');
    expect(source).toContain('RAILWAY_RETRO_COLLECTOR_SERVICE');
  });
});
