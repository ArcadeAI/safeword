import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

import { publishReceipt, renderReceipt } from '../../src/pr-review/publish.js';
import { reconcile } from '../../src/reconcile.js';
import type { ProjectContext, SafewordSchema } from '../../src/schema.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { VERSION } from '../../src/version.js';

const templatesDirectory = nodePath.join(import.meta.dirname, '../../templates/workflows');
const routerPath = nodePath.join(templatesDirectory, 'pr-review.yml');
const dogfoodRouterPath = nodePath.join(
  import.meta.dirname,
  '../../../../.github/workflows/safeword-pr-review.yml',
);
const dogfoodWorkerPath = nodePath.join(
  import.meta.dirname,
  '../../../../.github/workflows/safeword-pr-review-worker.yml',
);
const dogfoodPublisherPath = nodePath.join(
  import.meta.dirname,
  '../../../../.github/workflows/safeword-pr-review-publisher.yml',
);
const dogfoodBundlePath = nodePath.join(import.meta.dirname, '../../../../plugin/runtime/cli.js');
const publisherPath = nodePath.join(templatesDirectory, 'pr-review-publisher.yml');
const workerPath = nodePath.join(templatesDirectory, 'pr-review-worker.yml');
const installedWorkflowPaths = [
  '.github/workflows/safeword-pr-review.yml',
  '.github/workflows/safeword-pr-review-publisher.yml',
  '.github/workflows/safeword-pr-review-worker.yml',
] as const;

describe('dogfood review policy', () => {
  it('uses trusted base attributes and runtime without checking out pull-request code', () => {
    const worker = readFileSync(dogfoodWorkerPath, 'utf8');
    const publisher = readFileSync(dogfoodPublisherPath, 'utf8');
    expect(`${worker}\n${publisher}`).not.toMatch(/actions\/checkout|gh pr checkout|git fetch/);
    expect(worker).toContain('contents/.gitattributes?ref=$GITHUB_SHA');
    expect(worker).toContain('jq length pull-files.json');
    expect(worker).toContain('jq -r .changed_files pull.json');
    expect(worker).toContain('expectedArtifactCount: $pr.changed_files');
    expect(worker).toContain('git/trees/$GITHUB_SHA?recursive=1');
    expect(worker).toContain("'check-attr', '-z', '--stdin', 'linguist-generated'");
    expect(worker).toContain('{kind: "generated", path: .filename}');
    expect(worker).toContain('contents/.safeword/config.json?ref=$GITHUB_SHA');
    expect(worker).toContain('if [ "$latest_head_sha" != "$head_sha" ]');
    const trustedRuntime = 'contents/plugin/runtime/cli.js?ref=$GITHUB_SHA';
    expect(worker.split(trustedRuntime)).toHaveLength(4);
    expect(publisher.split(trustedRuntime)).toHaveLength(2);
    const trustedPackage = 'contents/plugin/package.json?ref=$GITHUB_SHA';
    expect(worker.split(trustedPackage)).toHaveLength(4);
    expect(publisher.split(trustedPackage)).toHaveLength(2);
    expect(`${worker}\n${publisher}`).not.toContain('trusted-reviewer.js');
    expect(`${worker}\n${publisher}`).toContain('bun plugin/runtime/cli.js');
    expect(worker).not.toMatch(/contents\/plugin\/runtime\/cli\.js\?ref=(?!\$GITHUB_SHA)/u);
    expect(publisher).not.toMatch(/contents\/plugin\/runtime\/cli\.js\?ref=(?!\$GITHUB_SHA)/u);
    const trustedBunVersion = 'contents/package.json?ref=$GITHUB_SHA';
    expect(worker.split(trustedBunVersion)).toHaveLength(4);
    expect(publisher.split(trustedBunVersion)).toHaveLength(2);
  });

  it('runs the trusted bundle with its package metadata in the downloaded layout', () => {
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-trusted-reviewer-'));
    try {
      const plugin = nodePath.join(root, 'plugin');
      const runtime = nodePath.join(plugin, 'runtime');
      mkdirSync(runtime, { recursive: true });
      copyFileSync(dogfoodBundlePath, nodePath.join(runtime, 'cli.js'));
      copyFileSync(
        nodePath.join(import.meta.dirname, '../../../../plugin/package.json'),
        nodePath.join(plugin, 'package.json'),
      );
      const result = spawnSync('bun', [nodePath.join(runtime, 'cli.js'), '--version'], {
        cwd: root,
        encoding: 'utf8',
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trim()).toBe(VERSION);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('does not suppress a review for an incomplete or stale receipt on the same head', async () => {
    const sha = 'a'.repeat(40);
    type Receipt = { user: { login: string }; body: string };
    const receipt = async (state: 'complete' | 'stale' | 'incomplete'): Promise<[Receipt]> => {
      let body = '';
      await publishReceipt(
        {
          listComments: () => Promise.resolve([]),
          createComment: published => {
            body = published;
            return Promise.resolve();
          },
          updateComment: () => Promise.reject(new Error('unexpected receipt update')),
          deleteComment: () => Promise.reject(new Error('unexpected receipt deletion')),
        },
        renderReceipt({
          checks: [],
          findingCounts: { consequential: 0, nonConsequential: 0 },
          reviewedSha: sha,
          reviewers: [],
          route: 'needs_human',
          runState: state,
          skippedChecks: [],
          tokenUsage: {},
          unknowns: [],
        }),
      );
      return [{ user: { login: 'github-actions[bot]' }, body }];
    };
    for (const path of [dogfoodWorkerPath, workerPath]) {
      const worker = readFileSync(path, 'utf8');
      const filter = /reviewed_receipt_sha="\$\(jq -r '([\s\S]*?)' comments\.json\)"/u.exec(
        worker,
      )?.[1];
      expect(filter).toBeDefined();
      if (!filter) throw new Error(`missing reviewer receipt filter in ${path}`);
      const fullReceiptFilter =
        /reviewedReceiptSha: (\(\(\[\$owned\[\]\.body\][^\n]+),\n\s*artifacts:/u.exec(worker)?.[1];
      expect(fullReceiptFilter).toBeDefined();
      if (!fullReceiptFilter) throw new Error(`missing full reviewer receipt filter in ${path}`);

      for (const state of ['stale', 'incomplete'] as const) {
        const result = spawnSync('jq', ['-r', filter], {
          encoding: 'utf8',
          input: JSON.stringify(await receipt(state)),
        });
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout.trim()).toBe('');
      }
      const notReady = await receipt('stale');
      notReady[0].body = notReady[0].body.replace('Run state: stale', 'Run state: not_ready');
      expect(notReady[0].body).toContain('Run state: not_ready');
      const draft = spawnSync('jq', ['-r', filter], {
        encoding: 'utf8',
        input: JSON.stringify(notReady),
      });
      expect(draft.status, draft.stderr).toBe(0);
      expect(draft.stdout.trim()).toBe('');
      const complete = spawnSync('jq', ['-r', filter], {
        encoding: 'utf8',
        input: JSON.stringify(await receipt('complete')),
      });
      expect(complete.status, complete.stderr).toBe(0);
      expect(complete.stdout.trim()).toBe(sha);

      const currentReceipt = await receipt('complete');
      const current = spawnSync('jq', ['-r', filter], {
        encoding: 'utf8',
        input: JSON.stringify(currentReceipt),
      });
      expect(current.status, current.stderr).toBe(0);
      expect(current.stdout.trim()).toBe(sha);

      const fullComplete = spawnSync(
        'jq',
        [
          '-n',
          '--argjson',
          'owned',
          JSON.stringify(currentReceipt),
          `{reviewedReceiptSha: ${fullReceiptFilter}}`,
        ],
        { encoding: 'utf8' },
      );
      expect(fullComplete.status, fullComplete.stderr).toBe(0);
      expect(JSON.parse(fullComplete.stdout).reviewedReceiptSha).toBe(sha);

      const mixed = [...currentReceipt, ...(await receipt('incomplete'))];
      const early = spawnSync('jq', ['-r', filter], {
        encoding: 'utf8',
        input: JSON.stringify(mixed),
      });
      expect(early.status, early.stderr).toBe(0);
      expect(early.stdout.trim()).toBe('');

      const full = spawnSync(
        'jq',
        [
          '-n',
          '--argjson',
          'owned',
          JSON.stringify(mixed),
          `{reviewedReceiptSha: ${fullReceiptFilter}}`,
        ],
        { encoding: 'utf8' },
      );
      expect(full.status, full.stderr).toBe(0);
      expect(JSON.parse(full.stdout).reviewedReceiptSha).toBeNull();

      const misleading = await receipt('stale');
      misleading[0].body += `\nReview text follows:\n${currentReceipt[0].body}\n`;
      const misleadingEarly = spawnSync('jq', ['-r', filter], {
        encoding: 'utf8',
        input: JSON.stringify(misleading),
      });
      expect(misleadingEarly.status, misleadingEarly.stderr).toBe(0);
      expect(misleadingEarly.stdout.trim()).toBe('');

      const misleadingFull = spawnSync(
        'jq',
        [
          '-n',
          '--argjson',
          'owned',
          JSON.stringify(misleading),
          `{reviewedReceiptSha: ${fullReceiptFilter}}`,
        ],
        { encoding: 'utf8' },
      );
      expect(misleadingFull.status, misleadingFull.stderr).toBe(0);
      expect(JSON.parse(misleadingFull.stdout).reviewedReceiptSha).toBeNull();
    }
  });

  it('ignores a successful edited-event run without an advisory artifact', () => {
    const publisher = YAML.parse(readFileSync(dogfoodPublisherPath, 'utf8')) as {
      jobs: { 'discover-event-result': { steps: { id?: string; run?: string }[] } };
    };
    const script = publisher.jobs['discover-event-result'].steps.find(
      step => step.id === 'artifact',
    )?.run;
    expect(script).toBeDefined();

    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-artifacts-'));
    try {
      const output = nodePath.join(root, 'output');
      const runWith = (names: string) => {
        writeFileSync(output, '');
        const result = spawnSync(
          'bash',
          [
            '-e',
            '-o',
            'pipefail',
            '-c',
            `gh() { printf '%s\\n' "$SAFEWORD_ARTIFACT_NAMES"; }\n${script}`,
          ],
          {
            cwd: root,
            encoding: 'utf8',
            env: {
              ...process.env,
              GITHUB_OUTPUT: output,
              GITHUB_REPOSITORY: 'ArcadeAI/safeword',
              SAFEWORD_ARTIFACT_NAMES: names,
              SAFEWORD_RUN_ID: '1',
            },
          },
        );
        return { result, output: readFileSync(output, 'utf8') };
      };

      const empty = runWith('');
      expect(empty.result.status, empty.result.stderr).toBe(0);
      expect(empty.output).toBe('pull_number=\nhas_result=false\n');

      const one = runWith('safeword-pr-review-42');
      expect(one.result.status, one.result.stderr).toBe(0);
      expect(one.output).toBe('pull_number=42\nhas_result=true\n');

      const ambiguous = runWith('safeword-pr-review-1\nsafeword-pr-review-2');
      expect(ambiguous.result.status).not.toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('classifies generated paths using Git attributes and preserves authored exceptions', () => {
    const workflow = YAML.parse(readFileSync(dogfoodWorkerPath, 'utf8')) as {
      jobs: { inspect: { steps: { name?: string; run?: string }[] } };
    };
    const assembly = workflow.jobs.inspect.steps.find(
      step => step.name === 'Assemble exact-head evidence as JSON',
    )?.run;
    const classifier = assembly?.match(/node --input-type=module <<'NODE'\n([\s\S]*?)\nNODE/u)?.[1];
    expect(classifier).toBeDefined();
    const root = mkdtempSync(nodePath.join(tmpdir(), 'safeword-pr-review-attributes-'));
    try {
      const attributes = nodePath.join(root, 'trusted-attributes');
      mkdirSync(attributes);
      const initialized = spawnSync('git', ['init', '--quiet', attributes], { encoding: 'utf8' });
      expect(initialized.status, initialized.stderr).toBe(0);
      writeFileSync(
        nodePath.join(attributes, '.gitattributes'),
        'generated/** linguist-generated=true\nbare/** linguist-generated\nplugin/** linguist-generated=true\nplugin/README.md -linguist-generated\n',
      );
      writeFileSync(
        nodePath.join(root, 'pull-files.json'),
        JSON.stringify(
          ['generated/a.js', 'bare/b.js', 'plugin/README.md', 'src/authored.ts'].map(filename => ({
            filename,
          })),
        ),
      );
      const classified = spawnSync('node', ['--input-type=module'], {
        cwd: root,
        encoding: 'utf8',
        input: classifier,
      });
      expect(classified.status, classified.stderr).toBe(0);
      const generated = JSON.parse(
        readFileSync(nodePath.join(root, 'generated-paths.json'), 'utf8'),
      );
      expect(generated).toEqual(['generated/a.js', 'bare/b.js']);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});

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

    const dogfoodRouter = YAML.parse(readFileSync(dogfoodRouterPath, 'utf8')) as {
      jobs: Record<string, { steps: unknown[] }>;
    };
    expect(dogfoodRouter.jobs.readiness?.steps[0]).toEqual({
      uses: 'actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0',
    });
    expect(dogfoodRouter.jobs.readiness?.steps[1]).toEqual({
      uses: 'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6',
      with: { 'bun-version-file': 'package.json' },
    });
    expect(dogfoodRouter.jobs.readiness?.steps[2]).toMatchObject({
      run: 'bun plugin/runtime/cli.js --no-input --json review-pr readiness',
    });
    expect(existsSync(dogfoodBundlePath), 'missing dogfood bundled CLI').toBe(true);

    expect(router).toMatchObject({
      on: {
        pull_request_target: {
          // `edited` serves the deterministic readiness status, which is about
          // the body. The advisory reviewer excludes it below so a body edit
          // never spends a model call.
          types: [
            'opened',
            'reopened',
            'synchronize',
            'ready_for_review',
            'converted_to_draft',
            'edited',
          ],
        },
        schedule: [{ cron: '*/5 * * * *' }],
      },
      jobs: {
        readiness: {
          concurrency: {
            'cancel-in-progress': true,
            group: 'pr-readiness-${{ github.event.pull_request.number }}',
          },
          permissions: { contents: 'read', 'pull-requests': 'read', statuses: 'write' },
          steps: [
            {
              name: 'Report readiness evidence freshness',
              run: 'npx --yes safeword@__SAFEWORD_VERSION__ --no-input --json review-pr readiness',
            },
          ],
        },
        'event-review': {
          if: "github.event_name == 'pull_request_target' && github.event.action != 'edited'",
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
