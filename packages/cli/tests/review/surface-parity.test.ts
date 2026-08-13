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

import { describe, expect, it } from 'vitest';

import { reviewCandidates, reviewChildEnvironment } from '../../templates/hooks/run-review';

const templates = nodePath.resolve(import.meta.dirname, '../../templates');

function readTemplate(relativePath: string): string {
  return readFileSync(nodePath.join(templates, relativePath), 'utf8');
}

function markdownFiles(directory: string, prefix = ''): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relativePath = nodePath.join(prefix, entry.name);
    const absolutePath = nodePath.join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(absolutePath, relativePath);
    return entry.isFile() && entry.name.endsWith('.md') ? [relativePath] : [];
  });
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
  it('forwards managed progress before the selected CLI exits', async () => {
    const fixture = mkdtempSync(nodePath.join(tmpdir(), 'safeword-review-stream-'));
    try {
      const localBin = nodePath.join(fixture, 'node_modules/.bin');
      const acknowledgement = nodePath.join(fixture, 'acknowledged');
      mkdirSync(localBin, { recursive: true });
      executable(
        nodePath.join(localBin, 'safeword'),
        `if [ "$*" = "review run --help" ]; then exit 0; fi
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
          env: { ...process.env, ACKNOWLEDGEMENT: acknowledgement },
          signal: AbortSignal.timeout(5000),
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
        if (stderr.includes('PROGRESS\n')) {
          expect(stdout).toBe('');
          writeFileSync(acknowledgement, 'ok\n');
        }
      });

      const status = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject);
        child.once('close', resolve);
      });
      expect(status).toBe(2);
      expect(stderr).toBe('PROGRESS\n');
      expect(stdout).toBe('RESULT\n');
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it.each([
    ['approved', 0, '{"schema_version":1,"state":"healthy"}\n'],
    ['action-required', 2, '{"schema_version":1,"state":"action_required"}\n'],
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
printf '%s' ${JSON.stringify(output)}
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
        expect(result.stdout).toBe(output);
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
  });

  it.each([
    ['skills/quality-review/SKILL.md', 'quality-review'],
    ['skills/review-spec/SKILL.md', 'scenario-gate'],
    ['skills/bdd/SKILL.md', 'scenario-gate'],
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

  it('keeps generated required-review surfaces on the managed wrapper and Cursor unwired', () => {
    const repoRoot = nodePath.resolve(import.meta.dirname, '../../../..');
    const generatedRoots = [
      nodePath.join(repoRoot, 'plugin/skills'),
      nodePath.join(repoRoot, 'packages/cli/codex-plugin/skills'),
    ];

    for (const generatedRoot of generatedRoots) {
      const requiredReviewFiles = filesUnder(generatedRoot).filter(relativePath =>
        ['quality-review', 'review-spec', 'bdd', 'tdd-review'].some(skill =>
          relativePath.includes(skill),
        ),
      );
      expect(requiredReviewFiles.length, generatedRoot).toBeGreaterThan(0);
      const combined = requiredReviewFiles
        .map(relativePath => readFileSync(nodePath.join(generatedRoot, relativePath), 'utf8'))
        .join('\n');
      expect(combined, generatedRoot).toContain('run-review.ts review run');
      expect(combined, generatedRoot).toContain('--agent-handoff --json');
    }

    const cursorRoots = [
      nodePath.join(repoRoot, '.cursor/commands'),
      nodePath.join(repoRoot, '.cursor/rules'),
    ];
    for (const cursorRoot of cursorRoots) {
      for (const relativePath of filesUnder(cursorRoot)) {
        expect(
          readFileSync(nodePath.join(cursorRoot, relativePath), 'utf8'),
          relativePath,
        ).not.toContain('run-review.ts review run');
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
    expect(readTemplate(relativePath), relativePath).not.toContain('safeword review run');
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
