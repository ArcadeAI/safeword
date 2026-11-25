import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import { finalizeWorkflowRevision } from '../../src/codex-plugin/resource-revision.js';
import { TESTING_CORE_LAYOUT } from '../../src/schema-layouts.js';
import { testingCoreBlock } from '../../src/testing/shared-core.js';
import { nativeWorkflowEnvironment } from '../helpers/codex-internal-workflows.js';
import { essentialOwner, markEssentialCore } from '../helpers/codex-workflow-essential.js';
import { runWorkflowGenerator } from '../helpers/codex-workflow-runtime.js';
import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';

// Real generator and bundled hook processes, not a native model receipt.
const repo = path.resolve(import.meta.dirname, '../../../..');
const fixture = { source: '', root: '', bundle: '', project: '' };
function hook(kind = 'resume', env: NodeJS.ProcessEnv = {}) {
  const result = spawnSync(
    path.join(repo, 'scripts/dev'),
    [
      'bun',
      '--no-env-file',
      path.join(fixture.bundle, 'runtime/cli.js'),
      'hook',
      'codex',
      'session-start',
      '--plugin-hook',
    ],
    {
      cwd: fixture.root,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...nativeWorkflowEnvironment(path.join(fixture.root, 'profile')), ...env },
      input: JSON.stringify({
        cwd: fixture.project,
        source: kind,
        hook_event_name: 'SessionStart',
        session_id: 'startup-unit',
      }),
    },
  );
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return result;
}
function startup(kind = 'resume', env: NodeJS.ProcessEnv = {}) {
  const result = hook(kind, env);
  const output = JSON.parse(result.stdout);
  expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
  return { context: output.hookSpecificOutput.additionalContext as string, stderr: result.stderr };
}
function rebuild() {
  const generated = runWorkflowGenerator(fixture.source, path.join(fixture.root, 'profile'), false);
  expect(generated.status, generated.output).toBe(0);
  rmSync(fixture.bundle, { recursive: true, force: true });
  cpSync(path.join(fixture.source, 'packages/cli/codex-plugin'), fixture.bundle, {
    recursive: true,
  });
}
function replace(file: string, content: string, run: () => void) {
  const original = readFileSync(file, 'utf8');
  try {
    writeFileSync(file, content);
    run();
  } finally {
    writeFileSync(file, original);
  }
}
function generatedHook(content: string, run: () => void) {
  replace(
    path.join(fixture.source, 'packages/cli/templates/hooks/session-codex-start.ts'),
    content,
    () => {
      rebuild();
      run();
    },
  );
}
function unavailable() {
  const result = startup();
  expect(result.context).toContain('workflow discovery unavailable');
  return result.context;
}
beforeAll(() => {
  fixture.source = createContractRepoFixture();
  fixture.root = path.dirname(fixture.source);
  fixture.project = path.join(fixture.root, 'project');
  mkdirSync(path.join(fixture.project, '.safeword'), { recursive: true });
  writeFileSync(path.join(fixture.project, '.safeword/SAFEWORD.md'), 'Owned startup fixture.');
  writeFileSync(
    path.join(fixture.project, '.safeword/config.json'),
    '{"paths":{"projectRoot":".project"}}',
  );
  const generated = runWorkflowGenerator(fixture.source, path.join(fixture.root, 'profile'), false);
  expect(generated.status, generated.output).toBe(0);
  fixture.bundle = path.join(fixture.root, 'installed');
  cpSync(path.join(fixture.source, 'packages/cli/codex-plugin'), fixture.bundle, {
    recursive: true,
  });
  cpSync(fixture.bundle, path.join(fixture.root, 'baseline'), { recursive: true });
}, 90_000);
beforeEach(() => {
  rmSync(fixture.bundle, { recursive: true, force: true });
  cpSync(path.join(fixture.root, 'baseline'), fixture.bundle, { recursive: true });
});
afterAll(() => {
  if (fixture.root) rmSync(fixture.root, { recursive: true, force: true });
});

it.each(['startup', 'resume'])(
  'delivers complete installed core once at actual bundled %s',
  kind => {
    const context = startup(kind).context;
    const installed = readFileSync(
      path.join(fixture.bundle, 'templates/guides/testing-guide.md'),
      'utf8',
    );
    expect(installed).toContain(testingCoreBlock());
    expect(context, 'STARTUP_ESSENTIAL_CORE_MISSING').toContain(testingCoreBlock());
    expect(context, 'SHARED_PARTITION_RULE_MISSING').toContain(
      'Before writing or reviewing tests, identify the distinct behavior partitions and choose a representative for each, including validation failures for individual inputs or input combinations. For bounded inputs, include a value strictly inside the valid range when one exists, boundary values, and out-of-range values, whether accepted or rejected. Check that the resulting tests cover those choices before reporting completion.',
    );
    expect(context).not.toContain('Cover distinct behavior partitions.');
    expect(context.split(testingCoreBlock())).toHaveLength(2);
    expect(Buffer.byteLength(context)).toBeLessThanOrEqual(8192);
    expect(context).toContain('Existing guards remain authoritative');
  },
);

it.each(TESTING_CORE_LAYOUT.templates)(
  'rejects stale installed core in %s even with a repaired tree digest',
  template => {
    const file = path.join(fixture.bundle, 'templates', template);
    const original = readFileSync(file, 'utf8');
    expect(original).toContain(testingCoreBlock());
    writeFileSync(file, original.replace('State the test-scope', 'OLD test-scope'));
    finalizeWorkflowRevision(fixture.bundle);
    expect(unavailable()).not.toContain(testingCoreBlock());
  },
);

it.each(['missing-block', 'duplicate-block', 'missing-file'])(
  'rejects %s with a valid revised index',
  fault => {
    const file = path.join(fixture.bundle, 'templates/guides/testing-guide.md');
    const original = readFileSync(file, 'utf8');
    if (fault === 'missing-file') rmSync(file);
    else
      writeFileSync(
        file,
        fault === 'missing-block'
          ? original.replace(testingCoreBlock(), '')
          : original + testingCoreBlock(),
      );
    finalizeWorkflowRevision(fixture.bundle);
    expect(unavailable()).not.toContain(testingCoreBlock());
  },
);

it.each(['missing', 'malformed', 'stale', 'unknown-version'])(
  'withholds core for %s resource index',
  fault => {
    const file = path.join(fixture.bundle, 'resources/workflow-index.json');
    const index = JSON.parse(readFileSync(file, 'utf8'));
    if (fault === 'missing') rmSync(file);
    else {
      if (fault === 'stale') index.resourceRevision.sha256 = '0'.repeat(64);
      else if (fault === 'unknown-version') index.resourceRevision.version = 999;
      writeFileSync(file, fault === 'malformed' ? '{' : JSON.stringify(index));
    }
    expect(unavailable()).not.toContain(testingCoreBlock());
  },
);

it.each(['index', 'index-parent', 'template', 'dangling-nested'])(
  'rejects %s symlinks including same-package targets',
  fault => {
    const relative =
      fault === 'template' ? 'templates/guides/testing-guide.md' : 'resources/workflow-index.json';
    const file = path.join(fixture.bundle, relative);
    if (fault === 'index-parent') {
      const target = path.join(fixture.bundle, 'index-carrier');
      renameSync(path.dirname(file), target);
      symlinkSync(target, path.dirname(file), 'dir');
    } else if (fault === 'dangling-nested')
      symlinkSync('missing-resource', path.join(fixture.bundle, 'templates/guides/broken.md'));
    else {
      const target = `${file}.real`;
      renameSync(file, target);
      symlinkSync(target, file);
    }
    expect(unavailable()).not.toContain(testingCoreBlock());
  },
);

it('delivers current owner A then B only after real canonical generation', () => {
  const file = essentialOwner(fixture.source);
  const original = readFileSync(file, 'utf8');
  try {
    const blocks = ['STARTUP_UNIT_A', 'STARTUP_UNIT_B'].map(marker => {
      const core = markEssentialCore(fixture.source, original, marker);
      rebuild();
      const context = startup().context;
      expect(context).toContain(core);
      return core;
    });
    expect(blocks[0]).not.toBe(blocks[1]);
    expect(startup().context).not.toContain(blocks[0]);
  } finally {
    writeFileSync(file, original);
  }
}, 90_000);

it('preserves disabled/manual policy and hooks while delivering shared knowledge', () => {
  const directory = path.join(fixture.source, 'packages/cli/templates/skills');
  const originals = new Map<string, string>();
  try {
    for (const name of readdirSync(directory)) {
      const file = path.join(directory, name, 'SKILL.md');
      const content = readFileSync(file, 'utf8');
      originals.set(file, content);
      const end = content.indexOf('\n---', 4);
      const metadata = parse(content.slice(4, end));
      metadata['disable-model-invocation'] = true;
      metadata['user-invocable'] = name === 'explain';
      writeFileSync(file, `---\n${stringify(metadata)}---${content.slice(end + 4)}`);
    }
    rebuild();
    const context = startup().context;
    expect(context).toContain(testingCoreBlock());
    expect(context).not.toContain('  Read:');
    const index = JSON.parse(
      readFileSync(path.join(fixture.bundle, 'resources/workflow-index.json'), 'utf8'),
    );
    expect(
      index.workflows.every(
        (value: { allowImplicitInvocation: boolean }) => !value.allowImplicitInvocation,
      ),
    ).toBe(true);
    expect(
      index.workflows.find((value: { name: string }) => value.name === 'explain').userInvocable,
    ).toBe(true);
    expect(readFileSync(path.join(fixture.bundle, 'hooks.json'), 'utf8')).toBe(
      readFileSync(path.join(fixture.root, 'baseline/hooks.json'), 'utf8'),
    );
  } finally {
    for (const [file, content] of originals) writeFileSync(file, content);
  }
}, 90_000);

it('bounds actual normal startup by UTF8 bytes at8192 and withholds overflow without clipping', () => {
  generatedHook(
    `process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:process.env.STARTUP_UNIT_PREFIX ?? ''}}));`,
    () => {
      const bytes = 8192 - Buffer.byteLength(startup().context);
      const prefix = 'é'.repeat(Math.floor(bytes / 2)) + 'x'.repeat(bytes % 2);
      expect(Buffer.byteLength(startup('resume', { STARTUP_UNIT_PREFIX: prefix }).context)).toBe(
        8192,
      );
      const overflow = startup('resume', { STARTUP_UNIT_PREFIX: `${prefix}x` });
      expect(overflow.context).toBe(`${prefix}x`);
      expect(overflow.stderr).toContain('startup context byte budget exceeded');
      expect(overflow.context).not.toContain(testingCoreBlock());
    },
  );
}, 90_000);

it.each([
  'not json',
  '{',
  '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":42}}',
  '{"hookSpecificOutput":{"hookEventName":"SessionStart"}}',
  '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":"prior"}}',
])(
  'preserves invalid previous response %s with explicit unavailable stderr',
  output => {
    generatedHook(`process.stdout.write(${JSON.stringify(output)});`, () => {
      const result = hook();
      expect(result.stdout).toBe(output);
      expect(result.stderr).toContain('workflow discovery unavailable');
      expect(result.stdout).not.toContain(testingCoreBlock());
    });
  },
  90_000,
);

it('withholds essential success after a failed packaged startup', () => {
  generatedHook(
    `process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'SessionStart',additionalContext:'prior'}})); process.exitCode = 1;`,
    () => {
      const context = startup().context;
      expect(context).toContain('startup failed');
      expect(context).not.toContain(testingCoreBlock());
    },
  );
}, 90_000);

it('uses the actual fallback for normal delivery and fails unavailable on oversized path population', () => {
  generatedHook('export {};', () => {
    const context = startup('startup').context;
    expect(context).toContain(testingCoreBlock());
    const index = JSON.parse(
      readFileSync(path.join(fixture.bundle, 'resources/workflow-index.json'), 'utf8'),
    );
    const eligible = index.workflows.filter(
      (value: { userInvocable: boolean; allowImplicitInvocation: boolean }) =>
        !value.userInvocable && value.allowImplicitInvocation,
    ).length;
    expect(eligible).toBeGreaterThan(0);
    const extra = Math.ceil((8193 - Buffer.byteLength(context)) / eligible);
    const original = fixture.bundle;
    const longRoot = path.join(
      fixture.root,
      ...Array.from({ length: Math.ceil(extra / 81) }, () => 'x'.repeat(80)),
      'installed',
    );
    try {
      cpSync(original, longRoot, { recursive: true });
      fixture.bundle = longRoot;
      const overflow = startup('resume');
      expect(overflow.stderr).toContain('startup context byte budget exceeded');
      expect(overflow.context).not.toContain(testingCoreBlock());
    } finally {
      fixture.bundle = original;
    }
  });
}, 90_000);
