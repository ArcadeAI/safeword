import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  currentProofCommit,
  type RetrospectiveProofRequest,
  runRetrospectiveProof,
} from '../../src/review/retrospective-proof.js';

const request: RetrospectiveProofRequest = {
  ticketId: 'CKWE2D',
  scenario: 'A nested project uses its committed generated marker',
  testFile: 'packages/cli/tests/cli-protocol/review-generated-targets.test.ts',
  testFullName:
    'generated review targets uses repository-relative paths for a project nested below the Git root',
  implementationPath: 'packages/cli/src/review/packet.ts',
  mutation: {
    before: 'const repoPaths = files.map(file => `${repoPrefix}${file.relative}`);',
    after: 'const repoPaths = files.map(file => file.relative);',
    expectedFailure: 'expected undefined to deeply equal',
    assertionLocation: 'review-generated-targets.test.ts:201',
  },
  supportFiles: ['packages/cli/src/review/scope.ts'],
};

describe('retrospective proof boundary', () => {
  it.runIf(process.platform !== 'win32')(
    'rejects project-controlled Git before inspecting proof history',
    () => {
      const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-proof-git-'));
      const root = realpathSync.native(temporary);
      const originalPath = process.env.PATH;
      const bin = path.join(root, 'node_modules', '.bin');
      const sentinel = path.join(root, 'executed');
      try {
        mkdirSync(bin, { recursive: true });
        const shim = path.join(bin, 'git');
        writeFileSync(shim, `#!/bin/sh\ntouch "${sentinel}"\n`);
        chmodSync(shim, 0o755);
        process.env.PATH = `${bin}${path.delimiter}${originalPath ?? ''}`;
        expect(() => currentProofCommit(root)).toThrow(
          'Git executable must be outside the project.',
        );
        expect(() => readFileSync(sentinel)).toThrow();
      } finally {
        if (originalPath === undefined) delete process.env.PATH;
        else process.env.PATH = originalPath;
        rmSync(root, { recursive: true, force: true });
      }
    },
  );

  it('rejects other tickets before Git inspection or test execution', () => {
    expect(() =>
      runRetrospectiveProof('/not/a/repository', { ...request, ticketId: 'OTHER1' }),
    ).toThrow('Only CKWE2D may use retrospective proof.');
  });

  it('rejects path traversal before Git inspection or test execution', () => {
    expect(() =>
      runRetrospectiveProof('/not/a/repository', {
        ...request,
        implementationPath: 'packages/cli/src/../secret.ts',
      }),
    ).toThrow('Retrospective proof paths must name CLI source and a CLI test.');
  });

  it('rejects a subdirectory as the source of a proof', () => {
    expect(() =>
      runRetrospectiveProof(path.resolve(import.meta.dirname, '../..'), request),
    ).toThrow('Retrospective proof requires the Git repository root.');
  });

  it.runIf(process.platform !== 'win32')(
    'rejects a committed implementation symlink before reading or mutating its external target',
    () => {
      const directory = mkdtempSync(path.join(tmpdir(), 'safeword-symlink-proof-'));
      const temporary = realpathSync.native(directory);
      const root = path.join(temporary, 'repository');
      const outside = path.join(temporary, 'outside.ts');
      try {
        mkdirSync(path.dirname(path.join(root, request.implementationPath)), { recursive: true });
        mkdirSync(path.dirname(path.join(root, request.testFile)), { recursive: true });
        writeFileSync(outside, outside);
        symlinkSync(outside, path.join(root, request.implementationPath));
        writeFileSync(path.join(root, request.testFile), '// selected test\n');
        execFileSync('git', ['init', '-q', root]);
        execFileSync('git', ['-C', root, 'add', '.']);
        execFileSync('git', [
          '-C',
          root,
          '-c',
          'user.name=Test',
          '-c',
          'user.email=test@example.com',
          'commit',
          '-qm',
          'fixture',
        ]);
        expect(() =>
          runRetrospectiveProof(root, {
            ...request,
            supportFiles: [request.testFile],
            mutation: { ...request.mutation, before: outside, after: 'changed' },
          }),
        ).toThrow('Proof input must be a regular file without symlink components');
        expect(readFileSync(outside, 'utf8')).toBe(outside);
      } finally {
        rmSync(temporary, { recursive: true, force: true });
      }
    },
  );

  it.runIf(process.platform !== 'win32')(
    'uses fresh passing and mutated reports rather than a committed report',
    () => {
      const temporary = mkdtempSync(path.join(tmpdir(), 'safeword-stale-proof-'));
      const root = realpathSync.native(temporary);
      const runnerDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-proof-runner-'));
      const originalPath = process.env.PATH;
      const originalEmitMutant = process.env.RETRO_FIXTURE_EMIT_MUTANT;
      try {
        const cli = path.join(root, 'packages/cli');
        const source = 'packages/cli/src/example.ts';
        const test = 'packages/cli/tests/example.test.ts';
        const report = 'retrospective-proof-report.json';
        mkdirSync(path.join(cli, 'src'), { recursive: true });
        mkdirSync(path.join(cli, 'tests'), { recursive: true });
        mkdirSync(path.join(root, 'node_modules'));
        mkdirSync(path.join(root, 'bin'));
        writeFileSync(path.join(root, source), 'export const behavior = true;\n');
        writeFileSync(path.join(root, test), '// selected test\n');
        writeFileSync(
          path.join(cli, report),
          JSON.stringify({
            numPassedTests: 0,
            numFailedTests: 1,
            testResults: [
              {
                assertionResults: [
                  {
                    fullName: 'selected test',
                    status: 'failed',
                    failureMessages: ['expected behavior at example.test.ts:1'],
                  },
                ],
              },
            ],
          }),
        );
        writeFileSync(path.join(root, 'generation.txt'), 'original\n');
        writeFileSync(path.join(root, 'package.json'), '{}\n');
        writeFileSync(path.join(root, 'bun.lock'), '{}\n');
        writeFileSync(path.join(cli, 'package.json'), '{}\n');
        const fakeBun = path.join(root, 'bin/bun');
        writeFileSync(
          fakeBun,
          `#!/bin/sh
if [ "$1" = install ]; then
  [ "$2" = --frozen-lockfile ] && [ "$3" = --ignore-scripts ] || exit 5
  mkdir -p node_modules packages/cli/node_modules
  exit 0
fi
if [ -n "$GIT_DIR" ]; then exit 3; fi
if [ -f ../../node_modules/proof-poison ]; then exit 6; fi
if ! grep -qx original ../../generation.txt; then exit 4; fi
if grep -q 'behavior = true' src/example.ts; then
  cat > ${report} <<'JSON'
{"numPassedTests":1,"numFailedTests":0,"testResults":[{"assertionResults":[{"fullName":"selected test","status":"passed"}]}]}
JSON
  exit 0
fi
if [ "$RETRO_FIXTURE_EMIT_MUTANT" = 1 ]; then
  cat > ${report} <<'JSON'
{"numPassedTests":0,"numFailedTests":1,"testResults":[{"assertionResults":[{"fullName":"selected test","status":"failed","failureMessages":["expected behavior at example.test.ts:1"]}]}]}
JSON
fi
exit 1
`,
          { mode: 0o755 },
        );
        execFileSync('git', ['init', '-q', root]);
        execFileSync('git', ['-C', root, 'add', '.']);
        execFileSync('git', [
          '-C',
          root,
          '-c',
          'user.name=Test',
          '-c',
          'user.email=test@example.com',
          'commit',
          '-qm',
          'fixture',
        ]);
        writeFileSync(
          path.join(root, 'node_modules/proof-poison'),
          'untracked checkout dependency\n',
        );
        process.env.PATH = `${path.join(root, 'bin')}${path.delimiter}${originalPath ?? ''}`;
        const proofRequest: RetrospectiveProofRequest = {
          ticketId: 'CKWE2D',
          scenario: 'selected scenario',
          testFile: test,
          testFullName: 'selected test',
          implementationPath: source,
          mutation: {
            before: 'behavior = true',
            after: 'behavior = false',
            expectedFailure: 'expected behavior',
            assertionLocation: 'example.test.ts:1',
          },
          supportFiles: [`packages/cli/${report}`],
        };
        process.env.RETRO_FIXTURE_EMIT_MUTANT = '1';
        expect(() => runRetrospectiveProof(root, proofRequest)).toThrow(
          'Bun executable must be outside the project',
        );
        writeFileSync(path.join(runnerDirectory, 'bun'), readFileSync(fakeBun), { mode: 0o755 });
        process.env.PATH = `${runnerDirectory}${path.delimiter}${originalPath ?? ''}`;
        delete process.env.RETRO_FIXTURE_EMIT_MUTANT;
        expect(() => runRetrospectiveProof(root, proofRequest)).toThrow('ENOENT');
        process.env.RETRO_FIXTURE_EMIT_MUTANT = '1';
        const observation = (() => {
          const previousGitDirectory = process.env.GIT_DIR;
          try {
            process.env.GIT_DIR = path.join(root, 'wrong-repository');
            return runRetrospectiveProof(root, proofRequest);
          } finally {
            if (previousGitDirectory === undefined) delete process.env.GIT_DIR;
            else process.env.GIT_DIR = previousGitDirectory;
          }
        })();
        const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
        expect(observation.commit).toBe(
          execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        );
        expect(observation.request).toEqual(proofRequest);
        expect(observation.argv[0]).toBe(realpathSync.native(path.join(runnerDirectory, 'bun')));
        expect(observation.sourceSha256).toBe(digest('export const behavior = true;\n'));
        expect(observation.mutantSha256).toBe(digest('export const behavior = false;\n'));
        expect(observation.mutatedSupportSha256[source]).toBe(observation.mutantSha256);
        expect(observation.supportSha256[source]).toBe(observation.sourceSha256);
        expect(observation.passing).toEqual({
          exitCode: 0,
          test: 'selected test',
          passedTests: 1,
          failedTests: 0,
        });
        expect(observation.mutated).toEqual({
          exitCode: 1,
          test: 'selected test',
          passedTests: 0,
          failedTests: 1,
          failure: 'expected behavior at example.test.ts:1',
        });
        expect(() =>
          runRetrospectiveProof(root, {
            ...proofRequest,
            mutation: { ...proofRequest.mutation, expectedFailure: 'different failure' },
          }),
        ).toThrow('The mutation did not fail at the declared scenario assertion');
        const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
        const pinned = execFileSync(realGit, ['-C', root, 'rev-parse', 'HEAD'], {
          encoding: 'utf8',
        }).trim();
        const moved = path.join(runnerDirectory, 'head-moved');
        writeFileSync(
          path.join(runnerDirectory, 'git'),
          String.raw`#!/bin/sh
if [ "$4" = archive ]; then
  "${realGit}" "$@" || exit 2
  if [ ! -f "${moved}" ]; then
    touch "${moved}"
    printf 'changed\n' > "${root}/generation.txt"
    "${realGit}" -C "${root}" add generation.txt
    "${realGit}" -C "${root}" -c user.name=Test -c user.email=test@example.com commit -qm moved >&2
  fi
  exit 0
fi
exec "${realGit}" "$@"
`,
          { mode: 0o755 },
        );
        const raced = runRetrospectiveProof(root, proofRequest);
        expect(raced.commit).toBe(pinned);
        expect(
          execFileSync(realGit, ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        ).not.toBe(pinned);
      } finally {
        process.env.PATH = originalPath;
        if (originalEmitMutant === undefined) delete process.env.RETRO_FIXTURE_EMIT_MUTANT;
        else process.env.RETRO_FIXTURE_EMIT_MUTANT = originalEmitMutant;
        rmSync(root, { recursive: true, force: true });
        rmSync(runnerDirectory, { recursive: true, force: true });
      }
    },
  );
});
