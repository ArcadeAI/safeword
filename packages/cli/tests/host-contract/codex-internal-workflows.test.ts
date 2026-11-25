import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse, stringify } from 'yaml';

import {
  assertCodexPluginCatalogue,
  codexSkillMetadataCharacters,
  generateCodexPluginAssets,
} from '../../src/codex-plugin/catalogue.js';
import { writePortableCoreCatalogue } from '../../src/host-contract/portable-core.js';
import { generateOwnedPathsModule } from '../../src/owned-paths.js';
import { SAFEWORD_SCHEMA } from '../../src/schema.js';
import { createContractRepoFixture } from '../helpers/contract-repo-fixture.js';

// Process/structural proof only. Native discovery, TUI, resumed reads and actual
// guard actions belong to the separately reviewed installed-host proof.
interface Workflow {
  name: string;
  description: string;
  internal: boolean;
  automatic: boolean;
}
interface WiringFixture {
  repo: string;
  root: string;
  canonical: string;
  bundle: string;
  project: string;
  foreign: string;
  version: string;
  probe: string;
  bodyMarker: string;
  guideMarker: string;
  nativeHooks: string;
  workflows: Workflow[];
  closure: { relative: string; marker: string }[];
}
const fixture: WiringFixture = {
  repo: '',
  root: '',
  canonical: '',
  bundle: '',
  project: '',
  foreign: '',
  version: '',
  probe: '',
  bodyMarker: '',
  guideMarker: '',
  nativeHooks: '',
  workflows: [],
  closure: [],
};
const sourceRoot = nodePath.resolve(import.meta.dirname, '../../../..');

function document(file: string) {
  const source = readFileSync(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/u.exec(source);
  assert.ok(match, `Fixture source lacks canonical frontmatter: ${file}`);
  return { metadata: parse(match[1] ?? '') as Record<string, unknown>, body: match[2] ?? '' };
}

function environment(): NodeJS.ProcessEnv {
  const env = {
    ...process.env,
    CODEX_HOME: nodePath.join(fixture.root, 'profiles/codex'),
    CLAUDE_CONFIG_DIR: nodePath.join(fixture.root, 'profiles/claude'),
    OPENCODE_CONFIG_DIR: nodePath.join(fixture.root, 'profiles/opencode'),
    SAFEWORD_REVIEW_KEY_ROOT: nodePath.join(fixture.root, 'review-keys'),
    SAFEWORD_AGENT_RUNTIME: 'codex',
    CLAUDE_PROJECT_DIR: '',
  };
  for (const key of [
    'SAFEWORD_PLUGIN_CLI',
    'CLAUDE_PLUGIN_ROOT',
    'CLAUDE_SESSION_ID',
    'CODEX_THREAD_ID',
    'SAFEWORD_SESSION_ID',
    'SAFEWORD_RUN_ID',
  ])
    Reflect.deleteProperty(env, key);
  return env;
}

function command(
  args: string[],
  cwd = fixture.foreign,
  input?: object,
  extraEnvironment?: NodeJS.ProcessEnv,
) {
  const result = spawnSync(
    nodePath.join(sourceRoot, 'scripts/dev'),
    ['bun', '--no-env-file', ...args],
    {
      cwd,
      env: { ...environment(), ...extraEnvironment },
      encoding: 'utf8',
      input: input === undefined ? undefined : JSON.stringify(input),
      timeout: 60_000,
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  expect(result.error, `WIRING_SETUP_UNAVAILABLE: ${result.stderr}`).toBeUndefined();
  expect(result.signal, `WIRING_SETUP_UNAVAILABLE: ${result.stderr}`).toBeNull();
  return result;
}

function generate(output: string) {
  const result = command(
    [
      'packages/cli/scripts/generate-codex-plugin.ts',
      '--version',
      fixture.version,
      '--output',
      output,
    ],
    fixture.repo,
  );
  expect(
    result.status,
    `WIRING_SETUP_UNAVAILABLE: generator failed\n${result.stdout}\n${result.stderr}`,
  ).toBe(0);
}

function requireProjection(): void {
  expect(
    existsSync(nodePath.join(fixture.bundle, 'resources/workflow-index.json')),
    'INTERNAL_REFERENCE_PROJECTION_MISSING: no generated workflow metadata',
  ).toBe(true);
  expect(
    existsSync(nodePath.join(fixture.bundle, 'internal/testing/SKILL.md')),
    'INTERNAL_REFERENCE_PROJECTION_MISSING: no internal testing resource',
  ).toBe(true);
}

function startup(source: 'startup' | 'resume') {
  const result = command(
    [
      nodePath.join(fixture.bundle, 'runtime/cli.js'),
      'hook',
      'codex',
      'session-start',
      '--plugin-hook',
    ],
    fixture.foreign,
    {
      cwd: fixture.project,
      hook_event_name: 'SessionStart',
      source,
      session_id: 'wiring-thread',
    },
  );
  expect(
    result.status,
    `WIRING_SETUP_UNAVAILABLE: bundled SessionStart failed\n${result.stderr}`,
  ).toBe(0);
  const output = JSON.parse(result.stdout) as {
    hookSpecificOutput: { hookEventName: string; additionalContext: string };
  };
  expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart');
  expect(output.hookSpecificOutput.additionalContext).toContain('Safeword session bootstrap:');
  return { result, output, context: output.hookSpecificOutput.additionalContext };
}

function assertStartupPopulation(context: string): void {
  for (const workflow of fixture.workflows) {
    if (workflow.internal && workflow.automatic) {
      expect(context, `INTERNAL_WORKFLOW_METADATA_MISSING: ${workflow.name}`).toContain(
        workflow.description,
      );
      const file = nodePath.join(fixture.bundle, 'internal', workflow.name, 'SKILL.md');
      expect(
        context.includes(file) || context.includes(realpathSync(file)),
        `Missing installed location for ${workflow.name}`,
      ).toBe(true);
    } else {
      expect(context, `INTERNAL_WORKFLOW_INELIGIBLE_DISCOVERY: ${workflow.name}`).not.toContain(
        workflow.description,
      );
    }
  }
  expect(context).not.toContain(fixture.bodyMarker);
}

function replaceFile(file: string, content: string | undefined, action: () => void): void {
  const original = readFileSync(file);
  try {
    if (content === undefined) rmSync(file);
    else writeFileSync(file, content);
    action();
  } finally {
    writeFileSync(file, original);
  }
}

function containedLink(asset: string, label: string): string {
  const text = readFileSync(asset, 'utf8');
  const destinations = text
    .split('](')
    .slice(1)
    .map(part => part.split(')', 1)[0] ?? '');
  const destination = destinations.find(value => value.includes(label));
  assert.ok(destination, `Missing installed ${label} link in ${asset}`);
  expect(nodePath.isAbsolute(destination)).toBe(false);
  const resolved = realpathSync(
    nodePath.resolve(nodePath.dirname(asset), destination.split(/[?#]/u, 1)[0] ?? ''),
  );
  expect(
    resolved.startsWith(`${realpathSync(fixture.bundle)}/`),
    `Escaping resource ${destination}`,
  ).toBe(true);
  return resolved;
}

function inventory(root: string): Record<string, string> {
  if (!existsSync(root)) return {};
  return Object.fromEntries(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => {
        const file = nodePath.join(entry.parentPath, entry.name);
        return [
          nodePath.relative(root, file),
          createHash('sha256').update(readFileSync(file)).digest('hex'),
        ];
      }),
  );
}

function markClosure(workflow: Workflow): void {
  const source = nodePath.join(fixture.canonical, workflow.name);
  const filenames = readdirSync(source).filter(filename => filename.endsWith('.md'));
  for (const filename of filenames) {
    const marker = `CLOSURE_ONLY_${randomUUID()}`;
    const file = nodePath.join(source, filename);
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n<!-- ${marker} -->\n`);
    if (workflow.internal)
      fixture.closure.push({
        relative:
          filename === 'SKILL.md'
            ? `internal/${workflow.name}/SKILL.md`
            : `internal/${workflow.name}/references/${filename}`,
        marker,
      });
  }
}

beforeAll(() => {
  const repo = realpathSync(createContractRepoFixture());
  const root = nodePath.dirname(repo);
  const packageFile = nodePath.join(repo, 'packages/cli/package.json');
  const version = (JSON.parse(readFileSync(packageFile, 'utf8')) as { version: string }).version;
  const nativeHooks = readFileSync(
    nodePath.join(repo, 'packages/cli/codex-plugin/hooks.json'),
    'utf8',
  );
  Object.assign(fixture, {
    repo,
    root,
    canonical: nodePath.join(repo, 'packages/cli/templates/skills'),
    bundle: nodePath.join(root, 'custom-marketplace/plugin'),
    project: nodePath.join(root, 'project'),
    foreign: nodePath.join(root, 'foreign-cwd'),
    version,
    probe: `invocation-probe-${randomUUID().slice(0, 8)}`,
    bodyMarker: `BODY_ONLY_${randomUUID()}`,
    guideMarker: `GUIDE_ONLY_${randomUUID()}`,
    nativeHooks,
    workflows: [],
    closure: [],
  });
  for (const directory of [fixture.project, fixture.foreign]) mkdirSync(directory);
  mkdirSync(nodePath.join(fixture.project, '.safeword'));
  writeFileSync(nodePath.join(fixture.project, '.safeword/SAFEWORD.md'), 'Owned wiring fixture.');
  writeFileSync(
    nodePath.join(fixture.project, '.safeword/config.json'),
    JSON.stringify({ paths: { projectRoot: '.project' } }),
  );
  const names = [
    'bdd',
    'audit',
    'explain',
    'testing',
    'debug',
    'self-review',
    'lint',
    'refactor',
    'review-spec',
  ];
  for (const [index, name] of names.entries()) {
    const file = nodePath.join(fixture.canonical, name, 'SKILL.md');
    const { metadata, body } = document(file);
    delete metadata['user-invocable'];
    delete metadata['disable-model-invocation'];
    const user = [undefined, false, true][Math.floor(index / 3)];
    const disabled = [undefined, false, true][index % 3];
    if (user !== undefined) metadata['user-invocable'] = user;
    if (disabled !== undefined) metadata['disable-model-invocation'] = disabled;
    metadata.description = `Canonical flag matrix ${name}: ${randomUUID()}`;
    writeFileSync(file, `---\n${stringify(metadata)}---\n${body}`);
  }
  mkdirSync(nodePath.join(fixture.canonical, fixture.probe));
  const description = `Full canonical description ${randomUUID()}. ${'Preserve this sentence without truncation. '.repeat(12)}Tail ${randomUUID()}`;
  const probeMetadata = { name: fixture.probe, description, 'user-invocable': false };
  writeFileSync(
    nodePath.join(fixture.canonical, fixture.probe, 'SKILL.md'),
    `---\n${stringify(probeMetadata)}---\n# Probe\n<!-- ${fixture.bodyMarker} -->\n`,
  );
  const testing = nodePath.join(fixture.canonical, 'testing');
  writeFileSync(nodePath.join(testing, 'FIRST.md'), '# First\n\n[Second](SECOND.md)\n');
  writeFileSync(
    nodePath.join(testing, 'SECOND.md'),
    '# Second\n\n[Guide](../../guides/testing-guide.md?fixture=1#contract)\n',
  );
  for (const relative of ['quality-review/SKILL.md', 'bdd/PLAN_EXECUTION.md']) {
    const file = nodePath.join(fixture.canonical, relative);
    writeFileSync(
      file,
      `${readFileSync(file, 'utf8')}\nBare fixture: \`testing/SKILL.md\`\nLink fixture: [testing](testing/SKILL.md)\nSlash fixture: /testing\nDollar fixture: $safeword:testing\n`,
    );
  }
  const testingFile = nodePath.join(testing, 'SKILL.md');
  writeFileSync(testingFile, `${readFileSync(testingFile, 'utf8')}\n[First](FIRST.md)\n`);
  fixture.workflows = readdirSync(fixture.canonical).map(name => {
    const { metadata } = document(nodePath.join(fixture.canonical, name, 'SKILL.md'));
    assert.equal(typeof metadata.description, 'string');
    return {
      name,
      description: metadata.description as string,
      internal: metadata['user-invocable'] === false,
      automatic: metadata['disable-model-invocation'] !== true,
    };
  });
  for (const workflow of fixture.workflows) markClosure(workflow);
  const guide = nodePath.join(fixture.repo, 'packages/cli/templates/guides/testing-guide.md');
  writeFileSync(guide, `${readFileSync(guide, 'utf8')}\n<!-- ${fixture.guideMarker} -->\n`);
  generate(fixture.bundle);
}, 120_000);

afterAll(() => {
  if (fixture.root) rmSync(fixture.root, { recursive: true, force: true });
});

describe('Codex internal workflow source wiring', { concurrent: false, shuffle: false }, () => {
  it('rejects a missing internal sibling through the real generated-delivery check', () => {
    // Execute the actual accepted feature, not a duplicate scenario body. The
    // child is Cucumber, never a nested Vitest or native model request.
    const repo = nodePath.resolve(import.meta.dirname, '../../../..');
    const evidence = mkdtempSync(nodePath.join(tmpdir(), 'safeword-wiring-evidence-'));
    const report = nodePath.join(evidence, 'cucumber.json');
    process.stdout.write(`Source-wiring evidence: ${evidence}\n`);
    const result = spawnSync(
      nodePath.join(sourceRoot, 'scripts/dev'),
      [
        'node',
        '--import',
        'tsx',
        nodePath.join(repo, 'node_modules/@cucumber/cucumber/bin/cucumber.js'),
        '--config',
        nodePath.relative(
          fixture.repo,
          nodePath.join(
            repo,
            'packages/cli/tests/fixtures/host-contract/cucumber.codex-internal-wiring.mjs',
          ),
        ),
        '--format',
        `json:${report}`,
      ],
      {
        cwd: fixture.repo,
        env: {
          ...environment(),
          SAFEWORD_WIRING_REPOSITORY: fixture.repo,
          SAFEWORD_WIRING_BUNDLE: fixture.bundle,
        },
        encoding: 'utf8',
        timeout: 200_000,
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    writeFileSync(nodePath.join(evidence, 'cucumber.stdout'), result.stdout ?? '');
    writeFileSync(nodePath.join(evidence, 'cucumber.stderr'), result.stderr ?? '');
    expect(result.error, 'WIRING_SETUP_UNAVAILABLE: Cucumber did not execute').toBeUndefined();
    expect(result.signal, 'WIRING_SETUP_UNAVAILABLE: Cucumber was signalled').toBeNull();
    type Step = { hidden?: boolean; result: { status: string; error_message?: string } };
    const features = JSON.parse(readFileSync(report, 'utf8')) as {
      elements: { name: string; steps: Step[] }[];
    }[];
    const cases = features.flatMap(feature => feature.elements);
    expect(cases, 'WIRING_SETUP_UNAVAILABLE: wrong source population').toHaveLength(1);
    const scenario = cases[0];
    assert.ok(scenario);
    expect(scenario.name).toBe(
      'Missing internal resources prevent a clean generated-delivery check',
    );
    const hooks = scenario.steps.filter(step => step.hidden);
    for (const hook of hooks) expect(hook.result.status).toBe('passed');
    const steps = scenario.steps.filter(step => !step.hidden);
    expect(steps).toHaveLength(3);
    expect(
      steps.slice(0, 2).map(step => step.result.status),
      'WIRING_SETUP_UNAVAILABLE: Given/When did not reach the real checker',
    ).toEqual(['passed', 'passed']);
    const assertion = steps[2];
    assert.ok(assertion);
    if (
      assertion.result.status === 'failed' &&
      assertion.result.error_message?.includes('INTERNAL_REFERENCE_PROJECTION_MISSING')
    ) {
      expect(result.status, 'WIRING_SETUP_UNAVAILABLE: Cucumber exit mismatch').toBe(1);
      throw new Error(`INTERNAL_REFERENCE_PROJECTION_MISSING: ${assertion.result.error_message}`);
    }
    expect(assertion.result.status, assertion.result.error_message).toBe('passed');
    expect(result.status, result.stderr).toBe(0);
  }, 220_000);

  it('accounts for the complete canonical population and preserves manual public controls', () => {
    requireProjection();
    expect(readFileSync(nodePath.join(fixture.bundle, 'hooks.json'), 'utf8')).toBe(
      fixture.nativeHooks,
    );
    const internal = fixture.workflows
      .filter(workflow => workflow.internal)
      .map(workflow => workflow.name)
      .toSorted((a, b) => a.localeCompare(b));
    const publicNames = fixture.workflows
      .filter(workflow => !workflow.internal)
      .map(workflow => workflow.name)
      .toSorted((a, b) => a.localeCompare(b));
    expect(
      readdirSync(nodePath.join(fixture.bundle, 'internal')).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(internal);
    expect(
      readdirSync(nodePath.join(fixture.bundle, 'skills')).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual(publicNames);
    expect(internal).toContain(fixture.probe);
    const manualPolicy = readFileSync(
      nodePath.join(fixture.bundle, 'skills/explain/agents/openai.yaml'),
      'utf8',
    );
    expect(parse(manualPolicy)).toEqual({ policy: { allow_implicit_invocation: false } });
    expect(existsSync(nodePath.join(fixture.bundle, 'skills/bdd/agents/openai.yaml'))).toBe(false);
    const indexSource = readFileSync(
      nodePath.join(fixture.bundle, 'resources/workflow-index.json'),
      'utf8',
    );
    const index = JSON.stringify(JSON.parse(indexSource));
    const internals = fixture.workflows.filter(value => value.internal);
    for (const workflow of internals) {
      expect(index).toContain(JSON.stringify(workflow.description));
      expect(index).toContain(`internal/${workflow.name}/SKILL.md`);
    }
    expect(index).not.toContain(fixture.bodyMarker);
    expect(index).not.toContain('CLOSURE_ONLY_');
    expect(() => {
      assertCodexPluginCatalogue(fixture.canonical, fixture.bundle, fixture.version);
    }).not.toThrow();
  });

  it('preserves every canonical internal asset and the complete raw CLI resource closure', () => {
    requireProjection();
    for (const resource of fixture.closure) {
      const file = nodePath.join(fixture.bundle, resource.relative);
      expect(realpathSync(file).startsWith(`${realpathSync(fixture.bundle)}/`)).toBe(true);
      expect(readFileSync(file, 'utf8')).toContain(resource.marker);
    }
    const canonicalTemplates = inventory(nodePath.join(fixture.repo, 'packages/cli/templates'));
    expect(inventory(nodePath.join(fixture.bundle, 'templates'))).toEqual(canonicalTemplates);
  });

  it.each(['startup', 'resume'] as const)(
    'delivers full eligible metadata through real bundled SessionStart for %s input',
    source => {
      requireProjection();
      const { context } = startup(source);
      expect(context).toContain(fixture.probe);
      assertStartupPopulation(context);
    },
  );

  it('publishes a current complete-resource revision at actual bundled startup', () => {
    const { context } = startup('resume');
    const index = JSON.parse(
      readFileSync(nodePath.join(fixture.bundle, 'resources/workflow-index.json'), 'utf8'),
    ) as { resourceRevision?: { version: number; sha256: string } };
    expect(index.resourceRevision, 'FRESHNESS_REVISION_MISSING: no content identity').toEqual({
      version: 1,
      sha256: expect.stringMatching(/^[a-f\d]{64}$/u),
    });
    expect(context).toContain(`Resource revision: ${index.resourceRevision?.sha256}`);
    expect(context).toContain('CURRENT installed');
    expect(context).toContain('earlier thread');
    assertStartupPopulation(context);
  });

  it('keeps revision guidance inside the unchanged generated metadata ceiling', () => {
    const file = nodePath.join(fixture.canonical, fixture.probe, 'SKILL.md');
    const { metadata, body } = document(file);
    const characters = codexSkillMetadataCharacters(
      generateCodexPluginAssets(fixture.canonical, fixture.version),
    );
    const description = `${metadata.description}${'x'.repeat(8000 - characters)}`;
    replaceFile(file, `---\n${stringify({ ...metadata, description })}---\n${body}`, () => {
      const result = command(
        [
          'packages/cli/scripts/generate-codex-plugin.ts',
          '--version',
          fixture.version,
          '--output',
          nodePath.join(fixture.root, 'over-budget'),
        ],
        fixture.repo,
      );
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/metadata[\s\S]*limit is 8000/u);
    });
  }, 90_000);

  it('preserves all-public discovery after packaging only regular files without empty directories', () => {
    const originals = new Map<string, string>();
    const originalBundle = fixture.bundle;
    try {
      for (const name of readdirSync(fixture.canonical)) {
        const file = nodePath.join(fixture.canonical, name, 'SKILL.md');
        if (!existsSync(file)) continue;
        originals.set(file, readFileSync(file, 'utf8'));
        const { metadata, body } = document(file);
        writeFileSync(
          file,
          `---\n${stringify({ ...metadata, 'user-invocable': true })}---\n${body}`,
        );
      }
      fixture.bundle = nodePath.join(fixture.root, 'all-public-package');
      generate(fixture.bundle);
      expect(readdirSync(nodePath.join(fixture.bundle, 'internal'))).toEqual([]);
      const fileOnly = nodePath.join(fixture.root, 'file-only-all-public-package');
      const regularFiles = Object.keys(inventory(fixture.bundle));
      for (const relative of regularFiles) {
        const target = nodePath.join(fileOnly, relative);
        mkdirSync(nodePath.dirname(target), { recursive: true });
        cpSync(nodePath.join(fixture.bundle, relative), target);
      }
      expect(inventory(fileOnly)).toEqual(inventory(fixture.bundle));
      expect(existsSync(nodePath.join(fileOnly, 'internal'))).toBe(false);
      fixture.bundle = fileOnly;
      const { context } = startup('resume');
      expect(context).toContain('Resource revision:');
      expect(context).not.toContain('workflow discovery unavailable');
    } finally {
      for (const [file, content] of originals) writeFileSync(file, content);
      fixture.bundle = originalBundle;
    }
  }, 90_000);

  it('preserves the actual packaged dispatcher response on the normal startup path', () => {
    requireProjection();
    const hooks = nodePath.join(fixture.root, 'baseline-hooks');
    cpSync(nodePath.join(fixture.bundle, 'templates/hooks'), hooks, { recursive: true });
    writeFileSync(
      nodePath.join(hooks, 'lib/owned-paths.ts'),
      generateOwnedPathsModule(SAFEWORD_SCHEMA),
    );
    const baseline = command(
      [nodePath.join(hooks, 'session-codex-start.ts')],
      fixture.foreign,
      { cwd: fixture.project, session_id: 'wiring-thread' },
      {
        CLAUDE_PROJECT_DIR: fixture.project,
        SAFEWORD_PLUGIN_CLI: nodePath.join(fixture.bundle, 'runtime/cli.js'),
        SAFEWORD_PACKAGED_CONTEXT_PATH: nodePath.join(fixture.bundle, 'resources/SAFEWORD.md'),
      },
    );
    expect(baseline.status, baseline.stderr).toBe(0);
    const original = JSON.parse(baseline.stdout) as {
      hookSpecificOutput: { additionalContext: string };
    };
    expect(original.hookSpecificOutput.additionalContext).toContain(
      'the packaged Safeword handbook',
    );
    const actual = startup('startup');
    expect(actual.context).toContain(original.hookSpecificOutput.additionalContext);
    expect(actual.result.stderr).toBe(baseline.stderr);
    expect({
      ...actual.output,
      hookSpecificOutput: { ...actual.output.hookSpecificOutput, additionalContext: '' },
    }).toEqual({
      ...original,
      hookSpecificOutput: { ...original.hookSpecificOutput, additionalContext: '' },
    });
    assertStartupPopulation(actual.context);
  });

  it('reads refreshed canonical metadata from the newly generated package on resume', () => {
    requireProjection();
    const source = nodePath.join(fixture.canonical, fixture.probe, 'SKILL.md');
    const original = readFileSync(source, 'utf8');
    const { metadata, body } = document(source);
    const previous = metadata.description;
    const current = `Refreshed canonical description ${randomUUID()}`;
    const oldBundle = fixture.bundle;
    try {
      writeFileSync(source, `---\n${stringify({ ...metadata, description: current })}---\n${body}`);
      const refreshed = nodePath.join(fixture.root, 'refreshed-package');
      generate(refreshed);
      fixture.bundle = refreshed;
      const { context } = startup('resume');
      expect(context).toContain(current);
      expect(context).not.toContain(previous);
      expect(context).toContain(
        realpathSync(nodePath.join(refreshed, 'internal', fixture.probe, 'SKILL.md')),
      );
    } finally {
      fixture.bundle = oldBundle;
      writeFileSync(source, original);
    }
  }, 90_000);

  it('supplies the same metadata through the valid existing fallback', () => {
    requireProjection();
    replaceFile(
      nodePath.join(fixture.repo, 'packages/cli/templates/hooks/session-codex-start.ts'),
      'export {};\n',
      () => {
        const original = fixture.bundle;
        try {
          const fallback = nodePath.join(fixture.root, 'fallback-package');
          generate(fallback);
          fixture.bundle = fallback;
          const { context } = startup('startup');
          expect(context).toContain(fixture.probe);
          expect(context).toContain('Resource revision:');
          assertStartupPopulation(context);
        } finally {
          fixture.bundle = original;
        }
      },
    );
  }, 90_000);

  it.each([
    'skills/testing/SKILL.md',
    'guides/testing-guide.md',
    'skills/testing/SECOND.md',
    'SAFEWORD.md',
  ])(
    'propagates content-only changes in canonical %s to the real startup revision',
    relative => {
      const old = fixture.bundle;
      const previous = /Resource revision: ([a-f\d]{64})/u.exec(startup('startup').context)?.[1];
      expect(previous).toBeDefined();
      const file = nodePath.join(fixture.repo, 'packages/cli/templates', relative);
      replaceFile(file, `${readFileSync(file, 'utf8')}\n<!-- content-only change -->\n`, () => {
        try {
          const current = nodePath.join(fixture.root, `content-${relative.replaceAll('/', '-')}`);
          generate(current);
          fixture.bundle = current;
          const context = startup('resume').context;
          expect(context).toMatch(/Resource revision: [a-f\d]{64}/u);
          expect(context).not.toContain(`Resource revision: ${previous}`);
          assertStartupPopulation(context);
        } finally {
          fixture.bundle = old;
        }
      });
    },
    90_000,
  );

  it.each([
    undefined,
    { version: 2, sha256: 'a'.repeat(64) },
    { version: 1, sha256: 42 },
    { version: 1, sha256: 'a'.repeat(64) },
  ])('rejects missing, malformed, unknown or stale installed revision %j', resourceRevision => {
    const file = nodePath.join(fixture.bundle, 'resources/workflow-index.json');
    const index = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    index.resourceRevision = resourceRevision;
    replaceFile(file, JSON.stringify(index), () => {
      expect(startup('resume').context).toContain('workflow discovery unavailable');
    });
  });

  it('resolves the existing public testing reference and every invocation form at each asset depth', () => {
    requireProjection();
    for (const relative of [
      'skills/quality-review/SKILL.md',
      'skills/bdd/references/PLAN_EXECUTION.md',
    ]) {
      const asset = nodePath.join(fixture.bundle, relative);
      const expected = nodePath.relative(
        nodePath.dirname(asset),
        nodePath.join(fixture.bundle, 'internal/testing/SKILL.md'),
      );
      const lines = readFileSync(asset, 'utf8').split('\n');
      for (const label of ['Bare fixture:', 'Link fixture:', 'Slash fixture:', 'Dollar fixture:']) {
        expect(
          lines.find(line => line.includes(label)),
          `Unresolved ${label} in ${relative}`,
        ).toContain(expected);
      }
      if (relative.includes('quality-review'))
        expect(lines.find(line => line.includes('Wiring Tests'))).toContain(expected);
    }
  });

  it('loads nested siblings, canonical guides and the executing package runtime from foreign CWD', () => {
    requireProjection();
    const first = containedLink(
      nodePath.join(fixture.bundle, 'internal/testing/SKILL.md'),
      'FIRST.md',
    );
    const second = containedLink(first, 'SECOND.md');
    const guide = containedLink(second, 'testing-guide.md');
    expect(readFileSync(second, 'utf8')).toContain(
      'templates/guides/testing-guide.md?fixture=1#contract',
    );
    expect(readFileSync(guide, 'utf8')).toContain(fixture.guideMarker);
    for (const relative of [
      'skills/quality-review/SKILL.md',
      'skills/bdd/references/PLAN_EXECUTION.md',
      'internal/self-review/SKILL.md',
    ]) {
      const asset = nodePath.join(fixture.bundle, relative);
      const runtime = containedLink(asset, 'runtime/cli.js');
      expect(runtime).toBe(realpathSync(nodePath.join(fixture.bundle, 'runtime/cli.js')));
      expect(readFileSync(asset, 'utf8')).not.toContain('/plugins/cache/safeword/safeword/');
      const result = command([runtime, '--version']);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain(fixture.version);
    }
    const finalReference = nodePath.join(fixture.bundle, 'skills/bdd/references/PLAN_EXECUTION.md');
    expect(document(finalReference).metadata.description).toEqual(expect.any(String));
    const identity = createHash('sha256').update(readFileSync(finalReference)).digest('hex');
    expect(readFileSync(nodePath.join(fixture.bundle, 'runtime/cli.js'), 'utf8')).toContain(
      identity,
    );
  });

  it.each(['missing', 'stale', 'extra', 'escape'] as const)(
    'rejects %s internal inventory rather than accepting clean delivery',
    kind => {
      requireProjection();
      const sibling = nodePath.join(fixture.bundle, 'internal/testing/references/FIRST.md');
      const original = readFileSync(sibling);
      const extra = nodePath.join(fixture.bundle, 'internal/testing/references/UNEXPECTED.md');
      const outside = nodePath.join(fixture.root, 'outside.md');
      try {
        switch (kind) {
          case 'missing': {
            rmSync(sibling);
            break;
          }
          case 'stale': {
            writeFileSync(sibling, 'wrong revision');
            break;
          }
          case 'extra': {
            writeFileSync(extra, 'unclassified resource');
            break;
          }
          case 'escape': {
            writeFileSync(outside, original);
            rmSync(sibling);
            symlinkSync(outside, sibling);

            break;
          }
          // No default
        }
        expect(() => {
          assertCodexPluginCatalogue(fixture.canonical, fixture.bundle, fixture.version);
        }).toThrow(kind === 'escape' ? /escapes its package/u : undefined);
      } finally {
        rmSync(extra, { force: true });
        rmSync(sibling, { force: true });
        writeFileSync(sibling, original);
      }
    },
  );

  it.each(['missing', 'malformed', 'wrong-shape'] as const)(
    'reports discovery unavailable with repair when metadata is %s',
    kind => {
      requireProjection();
      const value = { missing: undefined, malformed: '{invalid', 'wrong-shape': '[]' }[kind];
      replaceFile(nodePath.join(fixture.bundle, 'resources/workflow-index.json'), value, () => {
        const { result, context } = startup('startup');
        const diagnostic = `${context}\n${result.stderr}`;
        expect(diagnostic).toMatch(/workflow[\s\S]*unavailable|unavailable[\s\S]*workflow/iu);
        expect(diagnostic).toMatch(/repair|regenerate/iu);
        const internals = fixture.workflows.filter(item => item.internal);
        for (const workflow of internals) expect(context).not.toContain(workflow.description);
      });
    },
  );

  it.each(['missing', 'stale'] as const)(
    'includes %s workflow metadata in catalogue drift checks',
    kind => {
      requireProjection();
      const file = nodePath.join(fixture.bundle, 'resources/workflow-index.json');
      const original = readFileSync(file, 'utf8');
      replaceFile(file, kind === 'missing' ? undefined : `${original}\n`, () => {
        expect(() => {
          assertCodexPluginCatalogue(fixture.canonical, fixture.bundle, fixture.version);
        }).toThrow(/workflow-index\.json/u);
      });
    },
  );

  it.each([
    { field: 'user-invocable', value: 'false' },
    { field: 'disable-model-invocation', value: 0 },
  ])('rejects invalid canonical $field without silently applying defaults', ({ field, value }) => {
    const file = nodePath.join(fixture.canonical, fixture.probe, 'SKILL.md');
    const original = readFileSync(file, 'utf8');
    const { metadata, body } = document(file);
    replaceFile(file, `---\n${stringify({ ...metadata, [field]: value })}---\n${body}`, () => {
      const output = nodePath.join(fixture.root, `invalid-${field}`);
      const result = command(
        [
          'packages/cli/scripts/generate-codex-plugin.ts',
          '--version',
          fixture.version,
          '--output',
          output,
        ],
        fixture.repo,
      );
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain(field);
    });
    expect(readFileSync(file, 'utf8')).toBe(original);
  });

  it('refuses missing installed resources during startup without losing original context', () => {
    requireProjection();
    replaceFile(nodePath.join(fixture.bundle, 'internal/testing/SKILL.md'), undefined, () => {
      const { result, context } = startup('resume');
      expect(`${context}\n${result.stderr}`).toMatch(/unavailable/iu);
      expect(`${context}\n${result.stderr}`).toMatch(/repair|regenerate/iu);
      expect(context).not.toContain(
        fixture.workflows.find(item => item.name === 'testing')?.description,
      );
    });
  });

  it('keeps the portable projection independently registered with canonical flags', () => {
    const output = nodePath.join(fixture.root, 'portable');
    mkdirSync(output);
    writePortableCoreCatalogue(
      nodePath.join(fixture.repo, 'packages/cli/templates'),
      output,
      fixture.version,
    );
    for (const workflow of fixture.workflows) {
      const actual = document(nodePath.join(output, 'skills', workflow.name, 'SKILL.md')).metadata;
      const canonical = document(
        nodePath.join(fixture.canonical, workflow.name, 'SKILL.md'),
      ).metadata;
      for (const key of ['user-invocable', 'disable-model-invocation'])
        expect({ present: Object.hasOwn(actual, key), value: actual[key] }).toEqual({
          present: Object.hasOwn(canonical, key),
          value: canonical[key],
        });
    }
    expect(existsSync(nodePath.join(output, 'internal'))).toBe(false);
  });

  it('preserves a required continuation after a passive internal resource read', () => {
    requireProjection();
    mkdirSync(nodePath.join(fixture.project, '.project'), { recursive: true });
    const pending = nodePath.join(fixture.project, '.project/codex-stop-continuation.txt');
    const reason = `Required continuation ${randomUUID()}`;
    writeFileSync(pending, reason);
    const stop = () => {
      const result = command(
        [nodePath.join(fixture.bundle, 'runtime/cli.js'), 'hook', 'codex', 'stop', '--plugin-hook'],
        fixture.foreign,
        { cwd: fixture.project, session_id: 'wiring-continuation', stop_hook_active: false },
      );
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout) as Record<string, unknown>;
    };
    try {
      expect(stop()).toEqual({ decision: 'block', reason });
      expect(
        readFileSync(nodePath.join(fixture.bundle, 'internal/testing/SKILL.md'), 'utf8'),
      ).toContain('Writing Good Tests');
      expect(stop()).toEqual({ decision: 'block', reason });
    } finally {
      rmSync(pending, { force: true });
    }
    expect(stop()).toEqual({});
  });

  it('cannot turn a resource read into coding approval or a review receipt', () => {
    requireProjection();
    const ticket = nodePath.join(fixture.project, '.project/tickets/WIRING-native-wiring');
    mkdirSync(ticket, { recursive: true });
    writeFileSync(
      nodePath.join(ticket, 'ticket.md'),
      '---\nid: WIRING\nslug: native-wiring\ntype: feature\nphase: implement\nstatus: in_progress\nproduct_plan_contract: v1\n---\n# Unreviewed fixture\n',
    );
    const runtime = nodePath.join(fixture.bundle, 'runtime/cli.js');
    const authorize = () => {
      const result = command([
        runtime,
        'ticket',
        'coding-authorization',
        'WIRING',
        '--json',
        '--cwd',
        fixture.project,
      ]);
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(2);
      return (JSON.parse(result.stdout) as { data: Record<string, unknown> }).data;
    };
    expect(authorize()).toMatchObject({ coding_authorization: 'denied', grants_authority: false });
    const receipts = inventory(nodePath.join(fixture.project, '.safeword/state/reviews'));
    const internals = fixture.workflows.filter(item => item.internal);
    for (const workflow of internals)
      expect(
        readFileSync(nodePath.join(fixture.bundle, 'internal', workflow.name, 'SKILL.md'), 'utf8')
          .length,
      ).toBeGreaterThan(0);
    startup('resume');
    expect(authorize()).toMatchObject({ coding_authorization: 'denied', grants_authority: false });
    const stamp = command(
      [
        runtime,
        'project',
        'runtime',
        'write-review-stamp',
        '--',
        '--review-id',
        '00000000-0000-4000-8000-000000000000',
        '--phase',
        'plan-implementation',
      ],
      fixture.project,
    );
    expect(stamp.status).not.toBe(0);
    expect(inventory(nodePath.join(fixture.project, '.safeword/state/reviews'))).toEqual(receipts);
  });
});
