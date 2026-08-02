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

describe('Retro Relay deployment workflow', () => {
  it('deploys relevant main changes with a serialized project-scoped Railway CLI path', () => {
    const source = readFileSync(workflowPath, 'utf8');
    const workflow = parse(source) as {
      on: { push: { branches: string[]; paths: string[] }; workflow_dispatch: null };
      permissions: { contents: string };
      concurrency: { group: string; 'cancel-in-progress': boolean };
    };

    expect(workflow.on.push.branches).toEqual(['main']);
    expect(workflow.on.push.paths).toEqual([
      'packages/retro-relay/**',
      'packages/cli/package.json',
      'packages/website/package.json',
      'package.json',
      'bun.lock',
      'tsconfig.json',
      '.dockerignore',
      'railway.json',
      '.github/workflows/deploy-retro-relay.yml',
    ]);
    expect(workflow.on.workflow_dispatch).toBeNull();
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({
      group: 'retro-relay-production',
      'cancel-in-progress': false,
    });
    expect(source).toContain('RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}');
    expect(source).toContain('RAILWAY_PROJECT_ID: ${{ vars.RAILWAY_RETRO_RELAY_PROJECT_ID }}');
    expect(source).toContain('RAILWAY_ENVIRONMENT: ${{ vars.RAILWAY_RETRO_RELAY_ENVIRONMENT }}');
    expect(source).toContain('RAILWAY_SERVICE: ${{ vars.RAILWAY_RETRO_RELAY_SERVICE }}');
    expect(source).toContain('Missing RAILWAY_TOKEN repository secret');
    expect(source).toContain('railway up --ci');
    expect(source).toContain('--project "$RAILWAY_PROJECT_ID"');
    expect(source).toContain('--environment "$RAILWAY_ENVIRONMENT"');
    expect(source).toContain('--service "$RAILWAY_SERVICE"');
    expect(source).not.toContain('echo "$RAILWAY_TOKEN"');
  });
});
