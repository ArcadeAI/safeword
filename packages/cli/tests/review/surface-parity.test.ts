import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';

import { Option } from 'commander';
import { describe, expect, it } from 'vitest';

import { GLOBAL_OPTION_DEFINITIONS } from '../../src/cli-protocol/execute.js';
import { VERSION } from '../../src/version.js';
import {
  reviewCandidates,
  reviewChildEnvironment,
  VALUED_GLOBAL_OPTIONS,
  VALUELESS_GLOBAL_OPTIONS,
} from '../../templates/hooks/run-review';

const templates = nodePath.resolve(import.meta.dirname, '../../templates');

function readTemplate(relativePath: string): string {
  return readFileSync(nodePath.join(templates, relativePath), 'utf8');
}

function markdownFiles(directory: string, prefix = ''): string[] {
  return filesUnder(directory, prefix).filter(path => path.endsWith('.md'));
}

function filesUnder(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = nodePath.join(prefix, entry.name);
    const absolutePath = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) return filesUnder(absolutePath, relativePath);
    return entry.isFile() ? [relativePath] : [];
  });
}

function executable(path: string, body: string): void {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

function containsReviewLaunch(content: string): boolean {
  return /(?:run-review\.ts|safeword(?:@\S+)?)\s+review\s+run\b/u.test(content);
}

// eslint-disable-next-line complexity -- one fixture intentionally exercises every resolver branch
function runResolver(
  route: 'plugin' | 'local' | 'source' | 'fallback',
  rejectPlugin = false,
  hangPlugin = false,
): string[] {
  const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-resolver-'));
  try {
    const bin = nodePath.join(fixture, 'bin');
    mkdirSync(bin);
    const log = nodePath.join(fixture, 'calls.log');
    executable(
      nodePath.join(bin, 'bun'),
      String.raw`${hangPlugin ? 'case "$1" in */plugin/runtime/cli.js) sleep 5;; esac\n' : ''}${rejectPlugin ? 'case "$1" in */plugin/runtime/cli.js) exit 1;; esac\n' : ''}printf 'bun:%s\n' "$*" >> "$CALL_LOG"`,
    );
    executable(nodePath.join(bin, 'bunx'), String.raw`printf 'bunx:%s\n' "$*" >> "$CALL_LOG"`);

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CALL_LOG: log,
      PATH: `${bin}:/usr/bin:/bin`,
      SAFEWORD_REVIEW_CLI_PROBE_TIMEOUT_MS: '2000',
    };
    delete env.CLAUDE_PLUGIN_ROOT;
    switch (route) {
      case 'plugin': {
        const pluginRoot = nodePath.join(fixture, 'plugin');
        mkdirSync(nodePath.join(pluginRoot, 'runtime'), { recursive: true });
        writeFileSync(nodePath.join(pluginRoot, 'runtime', 'cli.js'), '');
        env.CLAUDE_PLUGIN_ROOT = pluginRoot;
        if (rejectPlugin || hangPlugin) {
          mkdirSync(nodePath.join(fixture, '.safeword'), { recursive: true });
          writeFileSync(nodePath.join(fixture, '.safeword/version'), '0.74.7\n');
        }

        break;
      }
      case 'local': {
        mkdirSync(nodePath.join(fixture, 'node_modules/.bin'), { recursive: true });
        executable(
          nodePath.join(fixture, 'node_modules/.bin/safeword'),
          String.raw`printf 'local:%s\n' "$*" >> "$CALL_LOG"`,
        );

        break;
      }
      case 'source': {
        mkdirSync(nodePath.join(fixture, 'packages/cli/src'), { recursive: true });
        writeFileSync(nodePath.join(fixture, 'packages/cli/src/cli.ts'), '');
        writeFileSync(nodePath.join(fixture, 'packages/cli/package.json'), '{"name":"safeword"}');

        break;
      }
      case 'fallback': {
        mkdirSync(nodePath.join(fixture, '.safeword'), { recursive: true });
        writeFileSync(nodePath.join(fixture, '.safeword/version'), '0.74.7\n');
      }
    }

    execFileSync(
      process.execPath,
      [
        nodePath.join(templates, 'hooks/run-review.ts'),
        'review',
        'run',
        'quality-review',
        'target',
        '--agent-handoff',
        '--json',
      ],
      { cwd: fixture, env },
    );
    return readFileSync(log, 'utf8').trim().split('\n');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

describe('class-1 review surface parity', () => {
  it('keeps wrapper global-option parsing aligned with the CLI contract', () => {
    const valueless = new Set<string>();
    const valued = new Set<string>();
    for (const definition of GLOBAL_OPTION_DEFINITIONS) {
      const option = new Option(definition.flags);
      const destination = option.required || option.optional ? valued : valueless;
      if (option.short !== undefined) destination.add(option.short);
      if (option.long !== undefined) destination.add(option.long);
    }

    const lexical = (left: string, right: string): number => left.localeCompare(right);
    expect([...VALUELESS_GLOBAL_OPTIONS].toSorted(lexical)).toEqual(
      [...valueless].toSorted(lexical),
    );
    expect([...VALUED_GLOBAL_OPTIONS].toSorted(lexical)).toEqual([...valued].toSorted(lexical));
  });

  it('forwards managed progress before the selected CLI exits', async () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-stream-'));
    try {
      const localBin = nodePath.join(fixture, 'node_modules/.bin');
      const acknowledgement = nodePath.join(fixture, 'acknowledged');
      const probeEnvironment = nodePath.join(fixture, 'probe-environment.log');
      mkdirSync(localBin, { recursive: true });
      executable(
        nodePath.join(localBin, 'safeword'),
        `if [ "$*" = "review run --help" ]; then printf '%s\n' "\${SAFEWORD_REVIEW_PROGRESS-unset}" > "$PROBE_ENVIRONMENT"; exit 0; fi
if [ "$SAFEWORD_REVIEW_PROGRESS" != "1" ]; then exit 9; fi
printf 'PROGRESS\n' >&2
while [ ! -f "$ACKNOWLEDGEMENT" ]; do sleep 0.01; done
printf 'RESULT\n'
exit 2`,
      );

      const child = spawn(
        process.execPath,
        [
          nodePath.join(templates, 'hooks/run-review.ts'),
          'review',
          'run',
          'quality-review',
          'target',
          '--agent-handoff',
          '--json',
        ],
        {
          cwd: fixture,
          env: {
            ...process.env,
            ACKNOWLEDGEMENT: acknowledgement,
            PROBE_ENVIRONMENT: probeEnvironment,
            SAFEWORD_REVIEW_PROGRESS: 'hostile-inherited-value',
          },
          signal: AbortSignal.timeout(5000),
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stdout = '';
      let stdoutAtProgress: string | undefined;
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        if (stderr.includes('PROGRESS\n') && stdoutAtProgress === undefined) {
          stdoutAtProgress = stdout;
          writeFileSync(acknowledgement, 'ok\n');
        }
      });

      const status = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      expect(status).toBe(2);
      expect(stdoutAtProgress).toBe('');
      expect(readFileSync(probeEnvironment, 'utf8')).toBe('unset\n');
      expect(stderr).toBe('PROGRESS\n');
      expect(stdout).toBe('RESULT\n');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it.each([
    ['approved', 0, '{"schema_version":1,"state":"healthy"}'],
    ['action-required', 2, '{"schema_version":1,"state":"action_required"}'],
  ] as const)(
    'preserves an older CLI %s result and status without adding an argument',
    (_, status, output) => {
      const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-older-cli-'));
      try {
        const localBin = nodePath.join(fixture, 'node_modules/.bin');
        mkdirSync(localBin, { recursive: true });
        executable(
          nodePath.join(localBin, 'safeword'),
          `if [ "$*" = "review run --help" ]; then exit 0; fi
if [ "$*" != "review run quality-review target --agent-handoff --json" ]; then exit 64; fi
printf '%s\n' ${JSON.stringify(output)}
exit ${status}`,
        );

        const result = spawnSync(
          process.execPath,
          [
            nodePath.join(templates, 'hooks/run-review.ts'),
            'review',
            'run',
            'quality-review',
            'target',
            '--agent-handoff',
            '--json',
          ],
          { cwd: fixture, encoding: 'utf8' },
        );
        expect(result.status).toBe(status);
        expect(result.stdout).toBe(`${output}\n`);
        expect(result.stderr).toBe('');
      } finally {
        rmSync(fixture, { recursive: true, force: true });
      }
    },
  );

  it('scopes managed progress to the JSON review child despite inherited contamination', () => {
    const contaminated = {
      PATH: '/usr/bin',
      SAFEWORD_REVIEW_PROGRESS: 'inherited',
      Safeword_Review_Progress: 'windows-inherited',
    };

    expect(reviewChildEnvironment(contaminated, ['review', 'run', '--help'])).toEqual({
      PATH: '/usr/bin',
    });
    expect(
      reviewChildEnvironment(contaminated, [
        'review',
        'run',
        'quality-review',
        'target',
        '--agent-handoff',
        '--json',
      ]),
    ).toEqual({ PATH: '/usr/bin', SAFEWORD_REVIEW_PROGRESS: '1' });
    for (const arguments_ of [
      ['--json', 'review', 'run', 'quality-review', 'target'],
      ['--cwd', '/project', '--json', 'review', 'run', 'quality-review', 'target'],
      ['--cwd=/project', 'review', 'run', 'quality-review', 'target', '--json'],
    ]) {
      expect(reviewChildEnvironment(contaminated, arguments_)).toEqual({
        PATH: '/usr/bin',
        SAFEWORD_REVIEW_PROGRESS: '1',
      });
    }
    for (const arguments_ of [
      ['--cwd', 'review', 'run', '--json'],
      ['--cwd=review', 'run', '--json'],
      ['--cwd', '--json', 'review', 'run'],
      ['review', 'run', '--cwd', '--json'],
      ['review', 'run', '--cwd=--json'],
      ['status', '--json', 'review', 'run'],
    ]) {
      expect(reviewChildEnvironment(contaminated, arguments_)).toEqual({ PATH: '/usr/bin' });
    }
    expect(
      reviewChildEnvironment(contaminated, [
        'review',
        'run',
        'quality-review',
        'target',
        '--',
        '--json',
      ]),
    ).toEqual({ PATH: '/usr/bin' });
  });

  it.each([
    ['skills/quality-review/SKILL.md', 'quality-review'],
    ['skills/review-spec/SKILL.md', 'scenario-gate'],
    ['skills/bdd/PLAN_IMPLEMENTATION.md', 'plan-implementation'],
    ['skills/bdd/TDD.md', 'plan-implementation'],
  ])('%s enters the shared %s coordinator', (relativePath, kind) => {
    const content = readTemplate(relativePath);
    expect(content, relativePath).toContain(`run-review.ts review run ${kind}`);
    expect(
      content.split('\n').some(line => line.trimStart().startsWith('safeword review run ')),
      relativePath,
    ).toBe(false);
    expect(content, relativePath).toContain('bun .safeword/hooks/run-review.ts');
  });

  it.each(['skills/bdd/PLAN_IMPLEMENTATION.md', 'skills/bdd/TDD.md'])(
    '%s reviews only impl-plan.md as plan work',
    relativePath => {
      const command = readTemplate(relativePath)
        .split('\n')
        .find(line => line.includes('run-review.ts review run plan-implementation'));

      expect(command, relativePath).toMatch(/ --context .+ -- impl-plan\.md$/u);
    },
  );

  it.each([
    'skills/quality-review/SKILL.md',
    'skills/review-spec/SKILL.md',
    'skills/bdd/PLAN_IMPLEMENTATION.md',
    'skills/bdd/TDD.md',
  ])('%s processes a typed authentication handoff before review fallback', relativePath => {
    const content = readTemplate(relativePath).replaceAll(/\s+/gu, ' ');

    expect(content, relativePath).toContain('`REVIEW_AUTHENTICATION_REQUIRED`');
    expect(content, relativePath).toMatch(/execute its exact recovery command/iu);
    expect(content, relativePath).toMatch(/rerun the same coordinator command once/iu);
    expect(content, relativePath).toMatch(/do not.*finish-review/iu);
  });

  // A stamp claiming independence is a claim about a review the agent itself
  // ran; write-review-stamp.ts now requires the coordinator's review id as the
  // witness, so a skill that stamps without citing one cannot advance its gate.
  it.each([
    'skills/review-spec/SKILL.md',
    'skills/bdd/PLAN_IMPLEMENTATION.md',
    'skills/bdd/TDD.md',
  ])('%s cites the review id when it stamps a coordinator verdict', relativePath => {
    const content = readTemplate(relativePath).replaceAll(/\s+/gu, ' ');

    const stampCommands = content.match(/write-review-stamp\.ts[^`\n]*/gu) ?? [];
    for (const stamp of stampCommands) {
      expect(stamp, relativePath).toContain('--review-id');
    }
    expect(content, relativePath).toMatch(/--review-id/u);
  });

  // A Codex session skipped the coordinator entirely, reasoning that sending
  // local spec files to a Claude reviewer needed an external-disclosure
  // approval it did not have — then reported its own local pass as the review.
  // Nothing in the dispatch protocol said who authorized the route, and every
  // independence-disclosure rule keys off a returned typed result, so a review
  // that was never dispatched produced no result and therefore no disclosure.
  it.each([
    'skills/quality-review/SKILL.md',
    'skills/review-spec/SKILL.md',
    'skills/bdd/PLAN_IMPLEMENTATION.md',
    'skills/bdd/TDD.md',
  ])('%s authorizes the dispatch and forbids an undisclosed skip', relativePath => {
    const content = readTemplate(relativePath).replaceAll(/\s+/gu, ' ');

    expect(content, relativePath).toContain(
      '**The dispatch is authorized; skipping it is not your call.**',
    );
    expect(content, relativePath).toMatch(
      /local subprocess of a CLI the user installed and signed in to/u,
    );
    expect(content, relativePath).toContain('`crossAgentReview: off`');
    expect(content, relativePath).toMatch(/do not invent a disclosure-approval requirement/u);
    expect(content, relativePath).toMatch(
      /request the approval it needs, or report that block as the blocker/u,
    );
    expect(content, relativePath).toContain(
      '**A review you never dispatched is not coverage** — say so unprompted, before any finding',
    );
  });

  it('ships the dispatch-authorization contract on every generated review surface', () => {
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
    const generated = [
      {
        root: nodePath.join(repoRoot, 'plugin/skills'),
        files: [
          'quality-review/SKILL.md',
          'review-spec/SKILL.md',
          'bdd/PLAN_IMPLEMENTATION.md',
          'bdd/TDD.md',
        ],
      },
      {
        root: nodePath.join(repoRoot, 'packages/cli/codex-plugin/skills'),
        files: [
          'quality-review/SKILL.md',
          'review-spec/SKILL.md',
          'bdd/references/PLAN_IMPLEMENTATION.md',
          'bdd/references/TDD.md',
        ],
      },
    ];

    for (const { root, files } of generated) {
      for (const relativePath of files) {
        const content = readFileSync(nodePath.join(root, relativePath), 'utf8').replaceAll(
          /\s+/gu,
          ' ',
        );
        expect(content, `${root}/${relativePath}`).toContain(
          '**The dispatch is authorized; skipping it is not your call.**',
        );
        expect(content, `${root}/${relativePath}`).toContain(
          '**A review you never dispatched is not coverage**',
        );
      }
    }
  });

  it('keeps scenario-gate coordinator ownership in review-spec', () => {
    const bdd = readTemplate('skills/bdd/SKILL.md');
    expect(bdd).toContain('`review-spec` in Review mode');
    expect(bdd).toContain('This orchestrator owns only routing and the phase transition');
    expect(bdd).not.toContain('run-review.ts review run scenario-gate');
  });

  it('keeps generated required-review surfaces on one review entrypoint and Cursor unwired', () => {
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
    const generatedSurfaces = [
      {
        // Claude reaches the managed wrapper: its plugin ships run-review.ts
        // and `${CLAUDE_PLUGIN_ROOT}` resolves in a skill's own bash block.
        root: nodePath.join(repoRoot, 'plugin/skills'),
        reviewEntrypoint: 'run-review.ts ',
        requiredReviewFiles: [
          'quality-review/SKILL.md',
          'review-spec/SKILL.md',
          'bdd/PLAN_IMPLEMENTATION.md',
          'bdd/TDD.md',
        ],
      },
      {
        // Codex skills do not receive `PLUGIN_ROOT`, so they address the
        // bundled CLI through Codex's stable versioned plugin-cache layout, carrying
        // the managed-progress signal the wrapper would otherwise have set —
        // without it a multi-minute review runs silent.
        root: nodePath.join(repoRoot, 'packages/cli/codex-plugin/skills'),
        reviewEntrypoint: `SAFEWORD_REVIEW_PROGRESS=1 bun "\${CODEX_HOME:-$HOME/.codex}/plugins/cache/safeword/safeword/${VERSION}/runtime/cli.js" `,
        requiredReviewFiles: [
          'quality-review/SKILL.md',
          'review-spec/SKILL.md',
          'bdd/references/PLAN_IMPLEMENTATION.md',
          'bdd/references/TDD.md',
        ],
      },
    ];

    for (const { root, reviewEntrypoint, requiredReviewFiles } of generatedSurfaces) {
      expect(requiredReviewFiles, root).not.toHaveLength(0);
      for (const relativePath of requiredReviewFiles) {
        const content = readFileSync(nodePath.join(root, relativePath), 'utf8');
        expect(content, relativePath).toContain(`${reviewEntrypoint}review run`);
        expect(content, relativePath).toContain('--agent-handoff --json');
        for (const line of content.split('\n')) {
          if (line.includes('review run')) {
            expect(line, `${relativePath}: ${line}`).toContain(reviewEntrypoint);
          }
        }
      }
    }

    const cursorRoots = [
      nodePath.join(repoRoot, '.cursor/commands'),
      nodePath.join(repoRoot, '.cursor/rules'),
    ];
    for (const cursorRoot of cursorRoots) {
      const cursorFiles = filesUnder(cursorRoot);
      expect(cursorFiles, cursorRoot).not.toHaveLength(0);
      for (const relativePath of cursorFiles) {
        const content = readFileSync(nodePath.join(cursorRoot, relativePath), 'utf8');
        expect(containsReviewLaunch(content), relativePath).toBe(false);
      }
    }
  });

  it.each([
    ['plugin', 'bun:', '/runtime/cli.js review run quality-review target --agent-handoff --json'],
    ['local', 'local:', 'review run quality-review target --agent-handoff --json'],
    [
      'source',
      'bun:',
      'packages/cli/src/cli.ts review run quality-review target --agent-handoff --json',
    ],
    [
      'fallback',
      'bunx:',
      'safeword@0.74.7 review run quality-review target --agent-handoff --json',
    ],
  ] as const)('executes the %s resolver route', (route, prefix, invocation) => {
    const calls = runResolver(route);
    expect(calls.at(-1)?.startsWith(prefix)).toBe(true);
    expect(calls.at(-1)).toContain(invocation);
  });

  it('falls through when a higher-priority CLI lacks review support', () => {
    const calls = runResolver('plugin', true);
    expect(calls.at(-1)).toContain('safeword@0.74.7 review run quality-review');
  });

  it('falls through when a higher-priority CLI probe hangs', () => {
    const calls = runResolver('plugin', false, true);
    expect(calls.at(-1)).toContain('safeword@0.74.7 review run quality-review');
  });

  it('rejects an installed version that is not exact semver', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-version-'));
    try {
      mkdirSync(nodePath.join(fixture, '.safeword'));
      writeFileSync(nodePath.join(fixture, '.safeword/version'), 'npm:untrusted-package\n');
      expect(reviewCandidates(fixture, {})).not.toContainEqual([
        'bunx',
        ['safeword@npm:untrusted-package'],
      ]);
      expect(reviewCandidates(fixture, {})).toHaveLength(0);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('rejects leading zeroes in numeric semantic-version identifiers', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-version-'));
    try {
      mkdirSync(nodePath.join(fixture, '.safeword'));
      writeFileSync(nodePath.join(fixture, '.safeword/version'), '01.2.3\n');
      expect(reviewCandidates(fixture, {})).toHaveLength(0);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('rejects a lookalike source checkout that is not the Safeword package', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-source-'));
    try {
      mkdirSync(nodePath.join(fixture, 'packages/cli/src'), { recursive: true });
      writeFileSync(nodePath.join(fixture, 'packages/cli/src/cli.ts'), '');
      writeFileSync(nodePath.join(fixture, 'packages/cli/package.json'), '{"name":"other-cli"}');

      expect(reviewCandidates(fixture, {})).toHaveLength(0);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('keeps every tracked wrapper copy byte-identical to the source template', () => {
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
    const canonical = readFileSync(nodePath.join(templates, 'hooks/run-review.ts'), 'utf8');

    expect(readFileSync(nodePath.join(repoRoot, '.safeword/hooks/run-review.ts'), 'utf8')).toBe(
      canonical,
    );
    expect(
      readFileSync(nodePath.join(repoRoot, 'plugin/runtime/hooks/run-review.ts'), 'utf8'),
    ).toBe(canonical);
  });

  it('runs the real source checkout CLI', () => {
    const output = execFileSync(
      process.execPath,
      [nodePath.join(templates, 'hooks/run-review.ts'), 'review', 'run', '--help'],
      { cwd: nodePath.resolve(import.meta.dirname, '../../../..'), encoding: 'utf8' },
    );
    expect(output).toContain('Run an independent adversarial review');
  });

  it('runs the real bundled Claude plugin CLI', () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-plugin-'));
    try {
      const output = execFileSync(
        process.execPath,
        [nodePath.join(templates, 'hooks/run-review.ts'), 'review', 'run', '--help'],
        {
          cwd: fixture,
          encoding: 'utf8',
          env: {
            ...process.env,
            CLAUDE_PLUGIN_ROOT: nodePath.resolve(import.meta.dirname, '../../../../plugin'),
          },
        },
      );
      expect(output).toContain('Run an independent adversarial review');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('ships the bundled-plugin route in generated Claude skills', () => {
    const generated = readFileSync(
      nodePath.resolve(import.meta.dirname, '../../../../plugin/skills/quality-review/SKILL.md'),
      'utf8',
    );
    expect(generated).toContain('/runtime/hooks/run-review.ts');
  });

  it.each([
    'skills/audit/SKILL.md',
    'skills/verify/SKILL.md',
    'skills/tdd-review/SKILL.md',
    'skills/refactor/SKILL.md',
  ])('%s stays outside the class-1 coordinator', relativePath => {
    expect(containsReviewLaunch(readTemplate(relativePath)), relativePath).toBe(false);
  });

  it('wires every canonical coordinator caller to the same typed-exhaustion continuation', () => {
    const skills = nodePath.join(templates, 'skills');
    const callers = markdownFiles(skills).filter(relativePath =>
      readFileSync(nodePath.join(skills, relativePath), 'utf8').includes(
        'run-review.ts review run',
      ),
    );

    expect(callers.length).toBeGreaterThan(0);
    for (const relativePath of callers) {
      const content = readFileSync(nodePath.join(skills, relativePath), 'utf8');
      const normalized = content.replaceAll(/\s+/gu, ' ');
      expect(content, relativePath).toContain('--agent-handoff --json');
      expect(content, relativePath).toContain('REVIEW_ROUTES_EXHAUSTED');
      expect(content, relativePath).toContain('/finish-review');
      expect(normalized, relativePath).toMatch(/Only when[^.]{0,240}REVIEW_ROUTES_EXHAUSTED/u);
    }
  });
});
