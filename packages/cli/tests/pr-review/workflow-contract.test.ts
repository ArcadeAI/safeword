import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { reconcile } from '../../src/reconcile.js';
import type { ProjectContext, SafewordSchema } from '../../src/schema.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';

const templatesDirectory = nodePath.join(import.meta.dirname, '../../templates/workflows');
const routerPath = nodePath.join(templatesDirectory, 'pr-review.yml');
const workerPath = nodePath.join(templatesDirectory, 'pr-review-worker.yml');
const installedWorkflowPaths = [
  '.github/workflows/safeword-pr-review.yml',
  '.github/workflows/safeword-pr-review-worker.yml',
] as const;

const projectType = {
  astro: false,
  existingClippyConfig: undefined,
  existingCucumberHarness: undefined,
  existingEslintConfig: undefined,
  existingFormatter: false,
  existingGolangciConfig: undefined,
  existingImportLinterConfig: false,
  existingLinter: false,
  existingMypyConfig: false,
  existingPrettierConfig: false,
  existingRuffConfig: undefined,
  existingRustfmtConfig: undefined,
  existingSqlfluffConfig: undefined,
  hasJsSource: false,
  legacyEslint: false,
  nextjs: false,
  playwright: false,
  publishableLibrary: false,
  react: false,
  scaffoldBddLane: true,
  shell: false,
  tailwind: false,
  tanstackQuery: false,
  typescript: false,
  vitest: false,
};

function projectContext(cwd: string): ProjectContext {
  return {
    cwd,
    developmentDeps: {},
    isGitRepo: false,
    languages: { golang: false, javascript: true, python: false, rust: false, sql: false },
    productionDeps: {},
    projectType,
  };
}

function workflowOnlySchema(): SafewordSchema {
  const managedFiles = Object.fromEntries(
    installedWorkflowPaths.map(path => {
      const definition = SAFEWORD_SCHEMA.managedFiles[path];
      if (definition === undefined) throw new Error(`missing schema entry for ${path}`);
      return [path, definition];
    }),
  );

  return {
    ...SAFEWORD_SCHEMA,
    contracts: {},
    deprecatedDirs: [],
    deprecatedFiles: [],
    deprecatedPackages: [],
    jsonMerges: {},
    legacyTextPatches: {},
    managedFiles,
    ownedDirs: [],
    ownedFiles: {},
    packages: { base: [], conditional: {} },
    preservedDirs: [],
    sharedDirs: [],
    textPatches: {},
  };
}

function writePrReviewConfig(projectDirectory: string, enabled: unknown): void {
  mkdirSync(nodePath.join(projectDirectory, '.safeword'), { recursive: true });
  writeFileSync(
    nodePath.join(projectDirectory, '.safeword/config.json'),
    JSON.stringify({ prReview: { enabled } }),
  );
}

describe('advisory PR review workflow contract', () => {
  it('ships a router and a reusable worker with one per-PR privilege boundary', () => {
    expect(existsSync(routerPath), 'missing PR review router template').toBe(true);
    expect(existsSync(workerPath), 'missing reusable PR review worker template').toBe(true);

    const router = YAML.parse(readFileSync(routerPath, 'utf8')) as Record<string, unknown>;
    const worker = YAML.parse(readFileSync(workerPath, 'utf8')) as Record<string, unknown>;

    expect(router).toMatchObject({
      on: {
        pull_request_target: {
          types: ['opened', 'reopened', 'synchronize', 'ready_for_review', 'converted_to_draft'],
        },
        schedule: [{ cron: '*/5 * * * *' }],
      },
      jobs: {
        'event-review': {
          permissions: { contents: 'read', issues: 'write', 'pull-requests': 'read' },
          uses: './.github/workflows/safeword-pr-review-worker.yml',
          with: {
            inspect_requested: "${{ github.event.action != 'converted_to_draft' }}",
          },
        },
        'scheduled-review': {
          permissions: { contents: 'read', issues: 'write', 'pull-requests': 'read' },
          uses: './.github/workflows/safeword-pr-review-worker.yml',
          with: { inspect_requested: true },
        },
      },
    });
    expect(worker).toMatchObject({
      on: {
        workflow_call: {
          inputs: {
            pull_number: { required: true, type: 'number' },
            cancel_in_progress: { required: true, type: 'boolean' },
            inspect_requested: { required: true, type: 'boolean' },
          },
        },
      },
      concurrency: {
        group: 'pr-review-${{ inputs.pull_number }}',
        'cancel-in-progress': '${{ inputs.cancel_in_progress }}',
      },
      jobs: {
        inspect: {
          environment: { name: 'safeword-pr-review-model', deployment: false },
          if: '${{ inputs.inspect_requested }}',
          permissions: { contents: 'read', issues: 'read', 'pull-requests': 'read' },
        },
        publish: {
          permissions: { contents: 'read', issues: 'write', 'pull-requests': 'read' },
        },
      },
    });

    const workerSource = readFileSync(workerPath, 'utf8');
    expect(workerSource).not.toMatch(/actions\/checkout|gh pr checkout|git fetch/);
    expect(workerSource).toContain('{kind: "non_text", path: .filename}');
    expect(workerSource).toContain('{kind: "unreadable_text", path: .filename}');
    expect(workerSource).toContain('png|jpe?g|gif|webp');

    const workerJobs = worker.jobs as Record<string, Record<string, unknown>>;
    for (const jobName of ['invalidate', 'publish']) {
      const writeCapableJob = workerJobs[jobName];
      if (!writeCapableJob) throw new Error(`missing ${jobName} job`);
      expect(writeCapableJob.environment).toBeUndefined();
      expect(JSON.stringify(writeCapableJob)).not.toContain('safeword-pr-review-model');
      expect(JSON.stringify(writeCapableJob)).not.toContain('secrets.');
    }

    expect(
      SAFEWORD_SCHEMA.managedFiles['.github/workflows/safeword-pr-review-worker.yml'],
    ).toMatchObject({ template: 'workflows/pr-review-worker.yml' });
    expect(SAFEWORD_SCHEMA.managedFiles['.github/workflows/safeword-pr-review.yml']).toMatchObject({
      template: 'workflows/pr-review.yml',
    });
  });

  it('keeps both workflows absent until PR review is explicitly enabled', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-'));
    const context = { cwd: projectDirectory } as ProjectContext;
    const definitions = [
      SAFEWORD_SCHEMA.managedFiles['.github/workflows/safeword-pr-review.yml'],
      SAFEWORD_SCHEMA.managedFiles['.github/workflows/safeword-pr-review-worker.yml'],
    ];

    try {
      for (const definition of definitions) {
        expect(definition?.generator?.(context)).toBeUndefined();
      }

      mkdirSync(nodePath.join(projectDirectory, '.safeword'));
      writeFileSync(
        nodePath.join(projectDirectory, '.safeword/config.json'),
        JSON.stringify({ prReview: { enabled: true } }),
      );

      for (const definition of definitions) {
        expect(definition?.generator?.(context)).toContain('Safeword advisory PR review');
      }
    } finally {
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  });

  it('installs exactly two workflows only for literal true and removes unmodified files when disabled', async () => {
    const malformedEnabledValues: unknown[] = [undefined, false, 'true', 1, JSON.parse('null')];
    for (const enabled of malformedEnabledValues) {
      const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-'));
      try {
        if (enabled !== undefined) writePrReviewConfig(projectDirectory, enabled);
        const result = await reconcile(
          workflowOnlySchema(),
          'install',
          projectContext(projectDirectory),
        );
        expect(
          result.created.filter(path => installedWorkflowPaths.includes(path as never)),
        ).toEqual([]);
      } finally {
        rmSync(projectDirectory, { force: true, recursive: true });
      }
    }

    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-'));
    try {
      writePrReviewConfig(projectDirectory, true);
      const installed = await reconcile(
        workflowOnlySchema(),
        'install',
        projectContext(projectDirectory),
      );
      expect(
        installed.created.filter(path => installedWorkflowPaths.includes(path as never)),
      ).toEqual([...installedWorkflowPaths]);

      writePrReviewConfig(projectDirectory, false);
      const disabled = await reconcile(
        workflowOnlySchema(),
        'upgrade',
        projectContext(projectDirectory),
      );
      expect(disabled.removed).toEqual(expect.arrayContaining([...installedWorkflowPaths]));
      for (const path of installedWorkflowPaths) {
        expect(existsSync(nodePath.join(projectDirectory, path))).toBe(false);
      }
    } finally {
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  });

  it('preserves a customized workflow when PR review is disabled', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-'));
    try {
      writePrReviewConfig(projectDirectory, true);
      await reconcile(workflowOnlySchema(), 'install', projectContext(projectDirectory));
      const customizedPath = nodePath.join(projectDirectory, installedWorkflowPaths[0]);
      writeFileSync(customizedPath, `${readFileSync(customizedPath, 'utf8')}\n# customer-owned\n`);

      writePrReviewConfig(projectDirectory, false);
      const disabled = await reconcile(
        workflowOnlySchema(),
        'upgrade',
        projectContext(projectDirectory),
      );

      expect(existsSync(customizedPath)).toBe(true);
      expect(disabled.removed).toContain(installedWorkflowPaths[1]);
      expect(disabled.removed).not.toContain(installedWorkflowPaths[0]);
    } finally {
      rmSync(projectDirectory, { force: true, recursive: true });
    }
  });
});
