import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  consequentialDecisions,
  renderSmallWorkFacts,
} from '../../templates/hooks/lib/small-work-classification.js';

// Run with SAFEWORD_RUN_SMALL_WORK_LIVE=1 and signed-in local host CLIs.
const enabled = process.env.SAFEWORD_RUN_SMALL_WORK_LIVE === '1';
const cli = path.resolve(import.meta.dirname, '../../dist/cli.js');
const timeout = 180_000;
const codexPlugin = path.resolve(import.meta.dirname, '../../codex-plugin');
const claudeSettings = path.resolve(import.meta.dirname, '../../../../.claude/settings.json');
const lifecycleEvents = ['PreToolUse', 'PostToolUse'] as const;
const responseSchema = JSON.stringify({
  type: 'object',
  properties: {
    readyValues: { type: 'array', items: { type: 'boolean' } },
    questions: { type: 'array', items: { type: 'string' } },
    review: { type: 'string', enum: ['prepared', 'held'] },
  },
  required: ['readyValues', 'questions', 'review'],
  additionalProperties: false,
});

interface Followup {
  readyValues: boolean[];
  questions: string[];
  review: string;
}

function configureHooks(host: 'claude' | 'codex', project: string): void {
  const directory = path.join(project, host === 'claude' ? '.claude' : '.codex');
  mkdirSync(directory, { recursive: true });
  const source = host === 'claude' ? claudeSettings : path.join(codexPlugin, 'hooks.json');
  const payload = readFileSync(source, 'utf8').replaceAll('${PLUGIN_ROOT}', () => codexPlugin);
  const installed = JSON.parse(payload) as { hooks: Record<string, unknown> };
  const hooks = Object.fromEntries(lifecycleEvents.map(event => [event, installed.hooks[event]]));
  const file = host === 'claude' ? 'settings.json' : 'hooks.json';
  writeFileSync(path.join(directory, file), JSON.stringify({ hooks }));
}

function run(command: string, args: string[], cwd: string, env?: NodeJS.ProcessEnv): string {
  const result = spawnSync(command, args, {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    timeout,
    maxBuffer: 8 * 1024 * 1024,
  });
  expect(result.status, result.error?.message ?? result.stderr).toBe(0);
  return result.stdout;
}

function askHost(host: 'claude' | 'codex', project: string, prompt: string): Followup {
  if (host === 'claude') {
    const output = run(
      'claude',
      [
        '-p',
        '--output-format',
        'json',
        '--json-schema',
        responseSchema,
        '--setting-sources',
        'project',
        '--strict-mcp-config',
        '--permission-mode',
        'acceptEdits',
        '--allowedTools',
        'Read,Edit,Write',
        '--max-turns',
        '9',
        prompt,
      ],
      project,
      {
        CLAUDE_CONFIG_DIR: process.env.SAFEWORD_LIVE_CLAUDE_CONFIG_DIR || undefined,
        SAFEWORD_PLUGIN_CLI: cli,
      },
    );
    return (JSON.parse(output) as { structured_output: Followup }).structured_output;
  }

  const profile = mkdtempSync(path.join(tmpdir(), 'safeword-small-work-codex-'));
  try {
    const source = process.env.SMOKE_CODEX_AUTH_HOME ?? path.join(homedir(), '.codex');
    cpSync(path.join(source, 'auth.json'), path.join(profile, 'auth.json'));
    writeFileSync(
      path.join(profile, 'config.toml'),
      `[features]\nhooks = true\n[projects.${JSON.stringify(project)}]\ntrust_level = "trusted"\n`,
    );
    const schemaPath = path.join(profile, 'response-schema.json');
    writeFileSync(schemaPath, responseSchema);
    // Only the fixture's two reviewed, repository-owned hook commands are enabled.
    const output = run(
      process.env.SMOKE_CODEX_BIN ?? 'codex',
      [
        '--no-daemon',
        'exec',
        '--json',
        '--ephemeral',
        '--dangerously-bypass-hook-trust',
        '-s',
        'workspace-write',
        '--output-schema',
        schemaPath,
        '-C',
        project,
        prompt,
      ],
      project,
      { CODEX_HOME: profile },
    );
    const events = output
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    const messages = events.filter(
      event => event.type === 'item.completed' && event.item?.type === 'agent_message',
    );
    return JSON.parse(messages.at(-1)?.item.text ?? '') as Followup;
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
}

describe.runIf(enabled)('live small-work behavior follow-up', () => {
  it.each([
    ['claude', 'settled'],
    ['claude', 'open'],
    ['codex', 'settled'],
    ['codex', 'open'],
  ] as const)(
    '%s follows saved %s design decisions',
    (host, state) => {
      const project = mkdtempSync(path.join(tmpdir(), 'safeword-small-work-followup-'));
      try {
        run('git', ['init', '-q'], project);
        run('bun', [cli, 'install', '--agents=cursor', '--no-modify', '--offline'], project);
        const created = run(
          'bun',
          [
            cli,
            '--json',
            'ticket',
            'new',
            'status-design',
            '--type=task',
            '--goal=Preserve readiness behavior',
          ],
          project,
        );
        const ticket = (JSON.parse(created) as { data: { file: string } }).data.file;
        const ticketPath = path.join(project, ticket);
        const notes =
          state === 'settled'
            ? 'An unavailable service returns JSON boolean ready: false.'
            : 'Open choice: an unreachable service could return ready: false or an explicit unreachable error.';
        const original = readFileSync(ticketPath, 'utf8');
        expect(original).toMatch(/^type: task$/m);
        expect(original).toMatch(/^phase: intake$/m);
        const facts = renderSmallWorkFacts({
          schemaVersion: 1,
          scope: 'Resolve the response contract',
          outcome: 'Preserve the published readiness behavior',
          decisions: Object.fromEntries(consequentialDecisions.map(key => [key, 'settled'])),
          introducesUserFlow: false,
          multipleUserFlows: false,
          newPersistentState: false,
          changesSharedContract: true,
          changesBehavior: true,
          verification: 'new-regression',
        });
        const evidence = path.join(path.dirname(ticketPath), 'caller-observation.md');
        writeFileSync(
          evidence,
          '# Caller observation\n\nThe monitoring client reads the published JSON boolean ready.\n',
        );
        const investigation = `## Investigation\n\n[Caller observation](./caller-observation.md). An available service returns JSON boolean ready: true. ${notes}`;
        writeFileSync(
          ticketPath,
          `${original}\n${investigation}\n\nNative checkpoint: before.\n${facts}`,
        );
        writeFileSync(
          path.join(project, '.safeword/config.json'),
          JSON.stringify({
            selfReport: { capture: false, surface: false, file: false },
          }),
        );
        configureHooks(host, project);
        run(
          'git',
          [
            '-c',
            'user.name=Fixture',
            '-c',
            'user.email=fixture@example.test',
            '-c',
            'commit.gpgsign=false',
            'commit',
            '--allow-empty',
            '-qm',
            'baseline',
          ],
          project,
        );
        const prompt = [
          `Read .safeword/SAFEWORD.md, .safeword/skills/bdd/SCENARIOS.md, and ${ticket}.`,
          `Use the ${host === 'claude' ? 'native Edit' : 'native apply_patch'} tool to replace only the line “Native checkpoint: before.” with “Native checkpoint: first.” in that ticket.`,
          'Continue from the phase Safeword leaves. Save your scenario preparation in dimensions.md alongside the ticket. Do not edit production source or change phase yourself.',
          'Stop before invoking any reviewer. Return JSON with the keys readyValues (drafted boolean expectations), questions (verbatim owner questions), and review (your proposed review disposition as prepared or held).',
        ].join(' ');
        const result = askHost(host, project, prompt);
        if (state === 'settled') {
          expect(result.readyValues).toHaveLength(2);
          expect(result.readyValues).toEqual(expect.arrayContaining([true, false]));
          expect(result.questions).toEqual([]);
          expect(result.review).toBe('prepared');
        } else {
          expect(result.readyValues).toEqual([true]);
          expect(result.questions).toHaveLength(1);
          expect(result.questions[0]).toMatch(/unreachable|cannot reach|can't reach/i);
          expect(result.questions[0]).toMatch(/false/i);
          expect(result.questions[0]).toMatch(/error/i);
          expect(result.review).toBe('held');
        }
        const promoted = readFileSync(ticketPath, 'utf8');
        expect(promoted).toMatch(/^type: feature$/m);
        expect(promoted).toMatch(/^phase: define-behavior$/m);
        expect(promoted).toMatch(/^small_work_pending_phase: plan-implementation$/m);
        expect(promoted).toContain(investigation);
        expect(promoted).toContain('Native checkpoint: first.');
        expect(readFileSync(evidence, 'utf8')).toContain('monitoring client reads');
        const draft = readFileSync(path.join(path.dirname(ticketPath), 'dimensions.md'), 'utf8');
        expect(draft).toMatch(/\bready\b[^\n]{1,64}\btrue\b/i);
        if (state === 'settled') expect(draft).toMatch(/\bready\b[^\n]{1,64}\bfalse\b/i);
      } finally {
        rmSync(project, { recursive: true, force: true });
      }
    },
    220_000,
  );
});
