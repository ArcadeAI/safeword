/**
 * The pre-commit markdown pipeline must judge the bytes that get committed.
 *
 * `<!-- markdownlint-disable-next-line RULE -->` suppresses the next *physical*
 * line. Prettier puts a blank line after an HTML comment block, so it turns that
 * directive into a comment about a blank line — suppressing nothing.
 *
 * While lint-staged linted before formatting, markdownlint saw the adjacent
 * (working) form and passed, prettier then produced the inert one, and the
 * violation shipped. Nothing re-checked it: an unchanged file is never staged
 * again, so the hook could not see the violation on any later commit either
 * (#3740).
 *
 * These tests drive the REAL lint-staged commands in their configured order, so
 * they fail if the order is ever flipped back or markdownlint is dropped — not
 * by inspecting the config's shape, but by checking the property that matters:
 * an inert suppression cannot pass the hook.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = nodePath.resolve(import.meta.dirname, '../../..');
const CONFIG_URL = pathToFileURL(nodePath.join(REPO_ROOT, 'lint-staged.config.mjs')).href;

/** An h4 directly under an h2 — MD001 — suppressed with the fragile form. */
const INERT_SUPPRESSION = [
  '# Title',
  '',
  '## Section',
  '',
  '<!-- markdownlint-disable-next-line MD001 -->',
  '#### Deep heading',
  '',
  'Body.',
  '',
].join('\n');

/** The same violation suppressed with the block form, which prettier preserves. */
const BLOCK_SUPPRESSION = [
  '# Title',
  '',
  '## Section',
  '',
  '<!-- markdownlint-disable MD001 -->',
  '',
  '#### Deep heading',
  '',
  '<!-- markdownlint-enable MD001 -->',
  '',
  'Body.',
  '',
].join('\n');

interface PipelineResult {
  readonly blocked: boolean;
  readonly output: string;
}

/**
 * Asks the real lint-staged config what it would run for a staged markdown file.
 *
 * Loaded in a child Node process rather than imported: the config is untyped
 * `.mjs` outside this package, so importing it would need a declaration file and
 * a root `tsconfig.json` include — repo-wide type surface added for one test.
 * The child speaks the config's own module format and needs neither.
 */
function stagedMarkdownCommands(relativePath: string): string[] {
  const script = `
    const { default: config } = await import(${JSON.stringify(CONFIG_URL)});
    const rule = config['*.md'];
    if (typeof rule !== 'function') {
      throw new TypeError('lint-staged "*.md" rule must build its commands from the staged paths');
    }
    process.stdout.write(JSON.stringify(rule([${JSON.stringify(relativePath)}])));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`could not read the lint-staged config: ${result.stderr}`);
  }
  return JSON.parse(result.stdout) as string[];
}

/**
 * Runs the configured `*.md` commands in order, stopping at the first failure —
 * exactly how lint-staged sequences them, and therefore how the hook decides
 * whether the commit proceeds.
 */
function runStagedMarkdownPipeline(relativePath: string): PipelineResult {
  const commands = stagedMarkdownCommands(relativePath);
  expect(commands.length).toBeGreaterThan(0);

  let output = '';
  for (const command of commands) {
    const result = spawnSync(command, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      shell: true,
      env: {
        ...process.env,
        PATH: `${nodePath.join(REPO_ROOT, 'node_modules/.bin')}:${process.env.PATH ?? ''}`,
      },
    });
    output += `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.status !== 0) return { blocked: true, output };
  }
  return { blocked: false, output };
}

/**
 * Fixtures live inside the repository on purpose: markdownlint-cli2 discovers
 * `.markdownlint-cli2.jsonc` by walking up from the file, so a fixture in the
 * system temp directory would be linted with default rules and prove nothing.
 */
function pipelineFor(content: string): PipelineResult {
  const directory = mkdtempSync(nodePath.join(REPO_ROOT, '.markdown-gate-fixture-'));
  try {
    const absolutePath = nodePath.join(directory, 'fixture.md');
    writeFileSync(absolutePath, content, 'utf8');
    return runStagedMarkdownPipeline(nodePath.relative(REPO_ROOT, absolutePath));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('pre-commit markdown suppression gate', () => {
  it('blocks a commit whose suppression prettier renders inert', () => {
    const { blocked, output } = pipelineFor(INERT_SUPPRESSION);

    expect(blocked).toBe(true);
    expect(output).toContain('MD001');
  });

  it('allows the block form, which survives prettier', () => {
    expect(pipelineFor(BLOCK_SUPPRESSION).blocked).toBe(false);
  });
});
