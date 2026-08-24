import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { reconcile } from '../../src/reconcile.js';
import type { ProjectContext, SafewordSchema } from '../../src/schema.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { VERSION } from '../../src/version.js';

const templatesDirectory = nodePath.join(import.meta.dirname, '../../templates/workflows');
const routerPath = nodePath.join(templatesDirectory, 'pr-review.yml');
const publisherPath = nodePath.join(templatesDirectory, 'pr-review-publisher.yml');
const workerPath = nodePath.join(templatesDirectory, 'pr-review-worker.yml');
const installedWorkflowPaths = [
  '.github/workflows/safeword-pr-review.yml',
  '.github/workflows/safeword-pr-review-publisher.yml',
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
  it('normalizes a pinned Safeword version at the end of a workflow line', () => {
    const definition = SAFEWORD_SCHEMA.managedFiles[installedWorkflowPaths[0]];
    const normalize = definition?.normalizeForUnmodifiedComparison;
    expect(normalize?.('run: npx --yes safeword@0.77.0\nnext: step\n')).toBe(
      'run: npx --yes safeword@__SAFEWORD_VERSION__\nnext: step\n',
    );
  });

  it('ships a router, fork-safe publisher, and reusable worker with one per-PR boundary', () => {
    expect(existsSync(routerPath), 'missing PR review router template').toBe(true);
    expect(existsSync(publisherPath), 'missing trusted PR review publisher template').toBe(true);
    expect(existsSync(workerPath), 'missing reusable PR review worker template').toBe(true);

    const router = YAML.parse(readFileSync(routerPath, 'utf8')) as Record<string, unknown>;
    const publisher = YAML.parse(readFileSync(publisherPath, 'utf8')) as Record<string, unknown>;
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
          permissions: { contents: 'read', issues: 'write', 'pull-requests': 'write' },
          secrets: 'inherit',
          uses: './.github/workflows/safeword-pr-review-worker.yml',
          with: {
            inspect_requested: "${{ github.event.action != 'converted_to_draft' }}",
            write_requested: false,
          },
        },
        'scheduled-review': {
          permissions: { contents: 'read', issues: 'write', 'pull-requests': 'write' },
          secrets: 'inherit',
          uses: './.github/workflows/safeword-pr-review-worker.yml',
          with: { inspect_requested: true, write_requested: true },
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
            write_requested: { required: true, type: 'boolean' },
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
          if: "${{ always() && inputs.inspect_requested && (needs.invalidate.result == 'success' || needs.invalidate.result == 'skipped') }}",
          permissions: { contents: 'read', issues: 'read', 'pull-requests': 'read' },
        },
        publish: {
          permissions: { contents: 'read', issues: 'write', 'pull-requests': 'write' },
        },
      },
    });
    expect(publisher).toMatchObject({
      on: {
        workflow_run: { types: ['completed'], workflows: ['Safeword advisory PR review'] },
      },
      jobs: {
        'discover-event-result': {
          permissions: { actions: 'read', contents: 'read' },
        },
        'publish-event-result': {
          concurrency: {
            group: 'pr-review-${{ needs.discover-event-result.outputs.pull_number }}',
            'cancel-in-progress': false,
          },
          permissions: {
            actions: 'read',
            contents: 'read',
            issues: 'write',
            'pull-requests': 'write',
          },
        },
      },
    });

    const workerSource = readFileSync(workerPath, 'utf8');
    const publisherSource = readFileSync(publisherPath, 'utf8');
    expect(`${workerSource}\n${publisherSource}`).not.toMatch(
      /actions\/checkout|gh pr checkout|git fetch/,
    );
    expect(workerSource).toContain('{kind: "non_text", path: .filename}');
    expect(workerSource).toContain('{kind: "unreadable_text", path: .filename}');
    expect(workerSource).toContain('png|jpe?g|gif|webp');
    expect(workerSource).toContain('git/blobs/$blob_sha');
    expect(workerSource).toContain('.encoding == "base64"');
    expect(workerSource).toContain('.size == 0');
    expect(workerSource).toContain('set -euo pipefail');
    expect(workerSource).toContain('.user.login == "github-actions[bot]"');
    expect(workerSource).toContain(
      'repos/$GITHUB_REPOSITORY/contents/.safeword/config.json" --jq .content',
    );
    expect(workerSource).not.toContain('contents/.safeword/config.json?ref=');
    expect(workerSource).toContain('.status != "removed"');
    expect(workerSource).toContain("--paginate --jq '.check_runs[]' | jq -s .");
    expect(workerSource).toContain("--paginate --jq '.statuses[]' | jq -s .");
    expect(workerSource).toContain("--paginate --jq '.[]' | jq -s . > comments.json");
    expect(workerSource.indexOf('> comments.json')).toBeLessThan(
      workerSource.indexOf('> pull-files.json'),
    );
    expect(workerSource.indexOf('if [ "$reviewed_receipt_sha" = "$head_sha" ]')).toBeLessThan(
      workerSource.indexOf('> pull-files.json'),
    );
    expect(workerSource).toContain('fullContentBase64');
    expect(workerSource).toContain('jq --rawfile fullContentBase64 full-content.base64');
    expect(workerSource).toContain("| jq --join-output --exit-status '");
    expect(workerSource).not.toContain("| jq -er '");
    expect(workerSource).not.toContain('jq --arg fullContentBase64 "$full_content"');
    expect(workerSource).toContain('contextNotApplicable: true');
    expect(workerSource).toContain('contextUnavailable: true');

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
    expect(
      SAFEWORD_SCHEMA.managedFiles['.github/workflows/safeword-pr-review-publisher.yml'],
    ).toMatchObject({ template: 'workflows/pr-review-publisher.yml' });
  });

  it('keeps all workflows absent until PR review is explicitly enabled', () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-'));
    const context = { cwd: projectDirectory } as ProjectContext;
    const definitions = installedWorkflowPaths.map(path => SAFEWORD_SCHEMA.managedFiles[path]);

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

  it('installs exactly three workflows only for literal true and safely removes them when disabled', async () => {
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
      const previousReleaseCustomization = readFileSync(customizedPath, 'utf8')
        .replaceAll(`safeword@${VERSION}`, 'safeword@0.0.1')
        .concat('\n# customer-owned\n');
      writeFileSync(customizedPath, previousReleaseCustomization);

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

  it('removes unmodified workflows when disabled during a version upgrade', async () => {
    const projectDirectory = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-'));
    try {
      writePrReviewConfig(projectDirectory, true);
      await reconcile(workflowOnlySchema(), 'install', projectContext(projectDirectory));

      for (const path of installedWorkflowPaths) {
        const installedPath = nodePath.join(projectDirectory, path);
        const previousRelease = readFileSync(installedPath, 'utf8').replaceAll(
          `safeword@${VERSION}`,
          'safeword@0.0.1',
        );
        writeFileSync(installedPath, previousRelease);
      }

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
});
