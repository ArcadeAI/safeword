import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import nodePath from 'node:path';

/** Authored text oracle; Git and the projection never generate its expected content. */
export const LARGE_LOCKFILE_TEXT = `${JSON.stringify(
  {
    workspaces: { 'packages/cli': { version: '1.1.0' } },
    packages: Object.fromEntries(
      Array.from({ length: 6000 }, (_, index) => [
        `dependency-${index}`,
        { version: '1.0.0', integrity: 'fixture-integrity' },
      ]),
    ),
  },
  undefined,
  2,
)}\n`;

export function largeLockfileFixture(
  root: string,
  attributes = 'generated/** linguist-generated=true\n',
) {
  const git = (...args: string[]): string => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`Git fixture failed: ${result.stderr}`);
    return result.stdout.trim();
  };
  const commit = (message: string, empty = false): void => {
    git(
      '-c',
      'commit.gpgsign=false',
      '-c',
      `core.hooksPath=${nodePath.join(root, '.git/no-hooks')}`,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.test',
      'commit',
      '-qm',
      message,
      ...(empty ? ['--allow-empty'] : []),
    );
  };
  const write = (text: string): void => {
    writeFileSync(nodePath.join(root, 'bun.lock'), text);
  };
  write(LARGE_LOCKFILE_TEXT);
  writeFileSync(nodePath.join(root, '.gitattributes'), attributes);
  git('init', '-q', '--initial-branch=main');
  git('add', '.gitattributes', 'bun.lock');
  commit('baseline');
  const baseline = git('rev-parse', 'HEAD');
  git('update-ref', 'refs/remotes/origin/main', baseline);
  git('checkout', '-qb', 'codex/lockfile-change');
  return { root, baseline, git, commit, write, before: LARGE_LOCKFILE_TEXT };
}
