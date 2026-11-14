import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { grade, HELPER, INITIAL, sawPendingFeedback, type HookObservation } from './grade.ts';

const live = process.argv.includes('--live');
if (live && process.argv.includes('--probe')) throw new Error('Choose exactly one mode.');
const outputIndex = process.argv.indexOf('--out');
const outputPath = process.argv[outputIndex + 1];
if (
  outputIndex < 0 ||
  !outputPath ||
  !['--live', '--probe'].some(arg => process.argv.includes(arg))
) {
  throw new Error(
    'Use --probe or --live and --out <new artifact directory>. No model runs by default.',
  );
}
const out = path.resolve(outputPath);
if (existsSync(out)) throw new Error('Use a new output directory; never overwrite prior evidence.');
mkdirSync(out, { recursive: true });
const root = mkdtempSync(path.join(tmpdir(), 'safeword-edit-eval-'));
const repo = path.resolve(import.meta.dirname, '../..');
const hookRecord = path.join(out, 'hooks.jsonl');
const observer = path.join(import.meta.dirname, 'record-hook.ts');
const prompt =
  'Update greeting.mjs so greet(name) uses formatName from ./name.mjs and returns "Hello, " followed by the trimmed uppercase name. Add the import in one edit, then update the function in a separate edit.';

function write(name: string, contents: string) {
  const file = path.join(root, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents);
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

try {
  write('greeting.mjs', INITIAL);
  write('name.mjs', HELPER);
  write('package.json', '{"type":"module"}\n');
  const eslintLauncher = 'node_modules/.bin/eslint';
  write(
    eslintLauncher,
    `#!/bin/sh\nexec ${shellQuote(path.join(repo, 'node_modules/.bin/eslint'))} "$@"\n`,
  );
  chmodSync(path.join(root, eslintLauncher), 0o755);
  write(
    '.safeword/eslint.config.mjs',
    'export default [{ files: ["**/*.mjs"], rules: { "no-unused-vars": "error", "object-curly-spacing": ["error", "always"] } }];\n',
  );
  write(
    '.claude/settings.json',
    JSON.stringify({
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [
              {
                type: 'command',
                command: `${shellQuote(process.execPath)} ${shellQuote(observer)}`,
              },
            ],
          },
        ],
      },
    }),
  );
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CLAUDE_PROJECT_DIR: root,
    POST_EDIT_SMOKE_RECORD: hookRecord,
  };
  for (const key of [
    'CLAUDECODE',
    'CLAUDE_PLUGIN_ROOT',
    'SAFEWORD_PLUGIN_CLI',
    'SAFEWORD_PACKAGED_CONTEXT_PATH',
    'CODEX_THREAD_ID',
    'SAFEWORD_AGENT_RUNTIME',
  ])
    delete environment[key];

  if (!live) {
    write('greeting.mjs', `import { formatName } from './name.mjs';\n${INITIAL}`);
    const result = spawnSync(process.execPath, [observer], {
      cwd: root,
      env: environment,
      input: JSON.stringify({ tool_input: { file_path: path.join(root, 'greeting.mjs') } }),
      encoding: 'utf8',
      timeout: 20_000,
    });
    const records = readFileSync(hookRecord, 'utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line) as HookObservation);
    const record = records[0];
    const passed =
      result.status === 0 &&
      record !== undefined &&
      sawPendingFeedback(record) &&
      record?.before === record?.after &&
      record?.output.includes('object-curly-spacing');
    writeFileSync(
      path.join(out, 'probe.json'),
      JSON.stringify({ passed, status: result.status, stderr: result.stderr }, null, 2),
    );
    console.log(JSON.stringify({ probe: passed ? 'pass' : 'fail', artifacts: out }));
    process.exitCode = passed ? 0 : 1;
  } else {
    const args = [
      '-p',
      prompt,
      '--setting-sources',
      'project',
      '--tools',
      'Read,Edit,Write',
      '--allowedTools',
      'Read,Edit,Write',
      '--strict-mcp-config',
      '--mcp-config',
      '{"mcpServers":{}}',
      '--model',
      'claude-haiku-4-5-20251001',
      '--max-budget-usd',
      '0.10',
      '--max-turns',
      '8',
      '--no-session-persistence',
      '--output-format',
      'json',
    ];
    const version = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 10_000 });
    const result = spawnSync('claude', args, {
      cwd: root,
      env: environment,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    writeFileSync(path.join(out, 'agent.json'), result.stdout ?? '');
    writeFileSync(path.join(out, 'agent.stderr'), result.stderr ?? '');
    let response: {
      is_error?: boolean;
      subtype?: string;
      total_cost_usd?: number;
      num_turns?: number;
    } = {};
    try {
      const parsed: unknown = JSON.parse(result.stdout);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
        response = parsed;
    } catch {
      /* Malformed output is inconclusive, never success. */
    }
    let recordError: string | undefined;
    let hooks: HookObservation[] = [];
    try {
      hooks = existsSync(hookRecord)
        ? readFileSync(hookRecord, 'utf8')
            .trim()
            .split('\n')
            .filter(Boolean)
            .map(line => JSON.parse(line))
        : [];
      if (
        !hooks.every(
          record =>
            typeof record.before === 'string' &&
            typeof record.after === 'string' &&
            typeof record.output === 'string' &&
            (record.status === null || Number.isInteger(record.status)),
        )
      )
        throw new Error('Invalid hook record');
    } catch (error) {
      hooks = [];
      recordError = String(error);
    }
    const finalSource = readFileSync(path.join(root, 'greeting.mjs'), 'utf8');
    const check = spawnSync(
      process.execPath,
      [
        '--eval',
        `const {greet}=await import(${JSON.stringify(path.join(root, 'greeting.mjs'))});for(const [input,want] of [[" Alice ","Hello, ALICE"],["bOb","Hello, BOB"],["","Hello, "]]){if(greet(input)!==want)process.exit(1)}`,
      ],
      { cwd: root, encoding: 'utf8', timeout: 5000 },
    );
    const agentSucceeded =
      result.status === 0 && response.is_error === false && response.subtype === 'success';
    writeFileSync(
      path.join(out, 'task-check.json'),
      JSON.stringify(
        { status: check.status, stderr: check.stderr, error: check.error?.message },
        null,
        2,
      ),
    );
    const issues = grade({
      agentSucceeded,
      hooks,
      finalSource,
      helperUnchanged: readFileSync(path.join(root, 'name.mjs'), 'utf8') === HELPER,
      taskWorks: check.status === 0,
    });
    const exercised = hooks.some(sawPendingFeedback);
    const verdict =
      !agentSucceeded || !exercised ? 'inconclusive' : issues.length ? 'fail' : 'pass';
    writeFileSync(path.join(out, 'final.mjs'), finalSource);
    const report = {
      verdict,
      issues,
      observedAt: new Date().toISOString(),
      head: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).stdout.trim(),
      prompt,
      model: 'claude-haiku-4-5-20251001',
      cli: version.stdout.trim(),
      estimatedCostUsd: response.total_cost_usd ?? null,
      turns: response.num_turns ?? null,
      processStatus: result.status,
      processError: result.error?.message,
      recordError,
      hookSha256: createHash('sha256')
        .update(readFileSync(path.join(repo, 'packages/cli/templates/hooks/post-tool-lint.ts')))
        .digest('hex'),
      artifacts: out,
    };
    writeFileSync(path.join(out, 'result.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
    process.exitCode = verdict === 'pass' ? 0 : verdict === 'fail' ? 1 : 2;
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
