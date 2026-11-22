import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  consequentialDecisions,
  renderSmallWorkFacts,
} from '../../../templates/hooks/lib/small-work-classification.js';

const cli = process.argv[2];
if (!cli || !path.isAbsolute(cli)) throw new Error('Supply the absolute candidate CLI path.');

const root = mkdtempSync(path.join(tmpdir(), 'safeword-response-contract-'));
const git = (...args: string[]) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const safeword = (...args: string[]) =>
  execFileSync(process.execPath, [cli, '--cwd', root, '--json', '--no-input', ...args], {
    cwd: root,
    encoding: 'utf8',
  });

git('init', '-q');
safeword('install', '--agents=cursor', '--no-modify', '--offline');
mkdirSync(path.join(root, 'src'));
writeFileSync(path.join(root, 'src/status.ts'), 'export const status = { ready: true };\n');
writeFileSync(
  path.join(root, 'src/caller.ts'),
  "import { status } from './status';\nexport const ready = status.ready;\n",
);
const { data } = JSON.parse(
  safeword(
    'ticket',
    'new',
    'rename-status',
    '--type',
    'task',
    '--goal',
    'Rename the status response field',
  ),
) as { data: { file: string; ticket_id: string } };
git('add', 'src', data.file);
git(
  '-c',
  'user.name=Fixture',
  '-c',
  'user.email=fixture@example.test',
  '-c',
  'commit.gpgsign=false',
  'commit',
  '-qm',
  'Response contract baseline',
);

const paths = ['src/status.ts', 'src/caller.ts'];
const baseline = git('rev-parse', 'HEAD');
const ticket = path.join(root, data.file);
const decisions = Object.fromEntries(consequentialDecisions.map(decision => [decision, 'settled']));
const facts = renderSmallWorkFacts({
  schemaVersion: 1,
  scope: 'Polish the status command output',
  outcome: 'Keep the existing caller working',
  decisions,
  introducesUserFlow: false,
  multipleUserFlows: false,
  newPersistentState: false,
  changesSharedContract: false,
  changesBehavior: true,
  verification: 'new-regression',
  evaluation: {
    base: baseline,
    fileLimit: 2,
    surfaceLimit: 1,
    aboveFileLimit: false,
    aboveSurfaceLimit: false,
    declaredSurfaces: ['CLI'],
    surfacePaths: paths.map(file => ({ path: file, surfaces: ['CLI'] })),
  },
});
writeFileSync(ticket, readFileSync(ticket, 'utf8') + facts);
console.log(
  JSON.stringify({
    root,
    baseline,
    ticket: data.file,
    ticket_id: data.ticket_id,
    prompt: `Pick up the existing task in ${data.file}. Rename the ready field in the status response to available.`,
  }),
);
