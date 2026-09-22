/**
 * One gate for every surface a `packages/cli/templates/**` (or mirror) edit
 * silently invalidates. Editing a single skill file used to leave FOUR
 * generated surfaces stale, each discovered only by its own 10-25 minute test
 * run (#4701). Running the existing `--check` modes together at pre-commit
 * turns that into seconds.
 *
 * Surfaces covered:
 *   1. Codex plugin              -> bun run generate:codex-plugin
 *   2. Claude plugin runtime     -> bun run generate:claude-plugin
 *   3. Claude historical catalogue + plugin release contract
 *                                -> bun run generate:claude-historical-catalogue
 *   4. Cursor wrappers           -> bun run generate:cursor-wrappers
 *
 * (Byte-identical template mirrors are already covered by parity-check.ts.)
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  CURSOR_COMMAND_WRAPPERS,
  CURSOR_RULE_WRAPPERS,
  renderCursorCommandWrapper,
  renderCursorRuleWrapper,
} from '../src/cursor-wrappers.js';

const execFileAsync = promisify(execFile);

const cliRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(cliRoot, '../..');

type Failure = { readonly surface: string; readonly fix: string; readonly detail: string };

/**
 * Bun prints a code frame and stack around the generator's own error. Keep the
 * sentence that names WHAT is stale and the `changed <file>` lines under it;
 * drop the rest so a committer reads four short verdicts, not four stack dumps.
 */
function significantLines(output: string): string {
  return output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('error:') || line.startsWith('changed '))
    .join('\n');
}

async function checkScript({
  surface,
  script,
  args = [],
  fix,
}: {
  readonly surface: string;
  readonly script: string;
  readonly args?: readonly string[];
  readonly fix: string;
}): Promise<Failure | undefined> {
  try {
    await execFileAsync('bun', [path.join('scripts', script), ...args], { cwd: cliRoot });
    return undefined;
  } catch (error) {
    const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };
    return { surface, fix, detail: significantLines(`${stdout}${stderr}`) };
  }
}

function wrapperDestinations(relativePath: string): string[] {
  const templateRelative = relativePath.startsWith('.cursor/commands/')
    ? relativePath.replace(/^\.cursor\/commands\//, 'commands/')
    : relativePath.replace(/^\.cursor\//, 'cursor/');

  return [path.join(repoRoot, relativePath), path.join(cliRoot, 'templates', templateRelative)];
}

function cursorWrapperExpectations(): readonly {
  readonly paths: string[];
  readonly content: string;
}[] {
  return [
    ...CURSOR_RULE_WRAPPERS.map(wrapper => ({
      paths: wrapperDestinations(`.cursor/rules/${wrapper.name}.mdc`),
      content: renderCursorRuleWrapper({ wrapper }),
    })),
    ...CURSOR_COMMAND_WRAPPERS.map(wrapper => ({
      paths: wrapperDestinations(`.cursor/commands/${wrapper.name}.md`),
      content: renderCursorCommandWrapper({ wrapper }),
    })),
  ];
}

function checkCursorWrappers(): Failure | undefined {
  const stale: string[] = [];

  for (const { paths, content } of cursorWrapperExpectations()) {
    for (const filePath of paths) {
      let onDisk: string | undefined;
      try {
        onDisk = readFileSync(filePath, 'utf8');
      } catch {
        onDisk = undefined;
      }

      if (onDisk !== content) {
        stale.push(path.relative(repoRoot, filePath));
      }
    }
  }

  if (stale.length === 0) {
    return undefined;
  }

  return {
    surface: 'Cursor wrappers',
    fix: 'bun run generate:cursor-wrappers',
    detail: ['stale or missing:', ...stale.map(entry => `  - ${entry}`)].join('\n'),
  };
}

/**
 * One ordering edge is load-bearing: the catalogue writes
 * src/claude-plugin/historical-catalogue.generated.ts, which is bundled into
 * both plugins' runtime/cli.js. Regenerate a plugin BEFORE the catalogue and it
 * comes out stale again, which reads like the fix did not work. The Cursor
 * wrappers are independent (the catalogue only fingerprints `.claude/**`
 * assets, and the plugin catalogue skips the cursor host directory); they run
 * first only for a stable, reproducible sequence.
 */
const GENERATORS_IN_ORDER = [
  'generate-cursor-wrappers.ts',
  'generate-claude-historical-catalogue.ts',
  'generate-claude-plugin.ts',
  'generate-codex-plugin.ts',
] as const;

if (process.argv.includes('--fix')) {
  for (const script of GENERATORS_IN_ORDER) {
    console.log(`→ ${script}`);
    await execFileAsync('bun', [path.join('scripts', script)], { cwd: cliRoot });
  }
  console.log('Regenerated all 4 surfaces. Stage the result.');
  process.exit(0);
}

const surfaceResults = await Promise.all([
  checkScript({
    surface: 'Codex plugin',
    script: 'generate-codex-plugin.ts',
    args: ['--check'],
    fix: 'bun run generate:codex-plugin',
  }),
  checkScript({
    surface: 'Claude plugin runtime',
    script: 'generate-claude-plugin.ts',
    args: ['--check'],
    fix: 'bun run generate:claude-plugin',
  }),
  checkScript({
    surface: 'Claude historical catalogue / plugin release contract',
    script: 'check-claude-plugin-release.ts',
    fix: 'bun run generate:claude-historical-catalogue',
  }),
  Promise.resolve(checkCursorWrappers()),
]);

const failures = surfaceResults.filter((failure): failure is Failure => failure !== undefined);

if (failures.length > 0) {
  console.error('Generated surfaces are stale after a template change:\n');
  for (const { surface, fix, detail } of failures) {
    console.error(`✗ ${surface}`);
    console.error(`  Fix: (cd packages/cli && ${fix})`);
    if (detail) {
      console.error(
        detail
          .split('\n')
          .map(line => `    ${line}`)
          .join('\n'),
      );
    }
    console.error('');
  }
  console.error(
    'Or regenerate everything in dependency order:\n  bun packages/cli/scripts/check-generated-surfaces.ts --fix\nThen re-stage the regenerated files and commit again.',
  );
  process.exit(1);
}

console.log('All 4 generated surfaces current.');
