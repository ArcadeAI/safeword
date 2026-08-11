import { existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import nodePath from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  commandInvokesCloseoutCleanup,
  readFreshCloseoutBinding,
  rememberCloseoutBinding,
  resolveExactCodexTranscript,
} from '../../templates/hooks/lib/closeout-binding.ts';
import { createTemporaryDirectory, removeTemporaryDirectory } from '../helpers.js';

const temporaryProjects: string[] = [];

function project(): string {
  const directory = createTemporaryDirectory();
  temporaryProjects.push(directory);
  mkdirSync(nodePath.join(directory, '.safeword'));
  writeFileSync(nodePath.join(directory, '.safeword', 'SAFEWORD.md'), '# SafeWord\n');
  return directory;
}

afterEach(() => {
  for (const directory of temporaryProjects) removeTemporaryDirectory(directory);
  temporaryProjects.length = 0;
});

describe('closeout host identity bridge (93C14D NTB1.R2/TBU1.R4)', () => {
  it('matches only an executable closeout guard command', () => {
    expect(commandInvokesCloseoutCleanup('bun .safeword/scripts/closeout-cleanup.ts --pr 42')).toBe(
      true,
    );
    expect(
      commandInvokesCloseoutCleanup(
        'env SAFE=1 bun "/repo/.safeword/scripts/closeout-cleanup.ts" --pr 42',
      ),
    ).toBe(true);
    expect(commandInvokesCloseoutCleanup('echo "bun .safeword/scripts/closeout-cleanup.ts"')).toBe(
      false,
    );
    expect(commandInvokesCloseoutCleanup('bun foo.safeword/scripts/closeout-cleanup.ts')).toBe(
      false,
    );
  });

  it('matches the generated native-plugin guard command without matching arbitrary resources', () => {
    expect(
      commandInvokesCloseoutCleanup(
        'bun "${CLAUDE_PLUGIN_ROOT}"/resources/scripts/closeout-cleanup.ts --pr 42',
      ),
    ).toBe(true);
    expect(
      commandInvokesCloseoutCleanup(
        'bun /plugins/safeword/resources/scripts/closeout-cleanup.ts --pr 42',
        '/plugins/safeword',
      ),
    ).toBe(true);
    expect(
      commandInvokesCloseoutCleanup(
        'bun /other/resources/scripts/closeout-cleanup.ts --pr 42',
        '/plugins/safeword',
      ),
    ).toBe(false);
  });

  it('binds one runtime session and optional exact transcript for one fresh consumer', () => {
    const projectDirectory = project();
    const now = new Date('2026-08-02T12:00:00.000Z');
    expect(
      rememberCloseoutBinding({
        projectDirectory,
        runtime: 'cursor',
        id: 'conversation-42',
        transcriptPath: '/exact/conversation-42.jsonl',
        now,
      }),
    ).toBe(true);

    expect(readFreshCloseoutBinding({ projectDirectory, now })).toEqual({
      runtime: 'cursor',
      id: 'conversation-42',
      projectRoot: realpathSync(projectDirectory),
      transcriptPath: '/exact/conversation-42.jsonl',
    });
    expect(readFreshCloseoutBinding({ projectDirectory, now })).toBeUndefined();
  });

  it('resolves an exact Codex transcript only inside the hook-owned sessions root', () => {
    const codexHome = project();
    const sessions = nodePath.join(codexHome, 'sessions', '2026', '08');
    mkdirSync(sessions, { recursive: true });
    const transcript = nodePath.join(sessions, 'rollout-thread-42.jsonl');
    writeFileSync(transcript, '{}\n');

    expect(resolveExactCodexTranscript('thread-42', { CODEX_HOME: codexHome })).toBe(transcript);
    expect(
      resolveExactCodexTranscript('another-thread', { CODEX_HOME: codexHome }),
    ).toBeUndefined();
  });

  it('consumes and rejects expired or malformed bindings', () => {
    const projectDirectory = project();
    rememberCloseoutBinding({
      projectDirectory,
      runtime: 'claude',
      id: 'session-1',
      transcriptPath: '/exact/session-1.jsonl',
      now: new Date('2026-08-02T12:00:00.000Z'),
    });
    expect(
      readFreshCloseoutBinding({
        projectDirectory,
        now: new Date('2026-08-02T12:06:00.000Z'),
      }),
    ).toBeUndefined();

    expect(rememberCloseoutBinding({ projectDirectory, runtime: 'codex', id: undefined })).toBe(
      false,
    );
  });

  it('rejects a binding dated in the future', () => {
    const projectDirectory = project();
    rememberCloseoutBinding({
      projectDirectory,
      runtime: 'codex',
      id: 'future-thread',
      now: new Date('2026-08-02T12:01:00.000Z'),
    });

    expect(
      readFreshCloseoutBinding({
        projectDirectory,
        now: new Date('2026-08-02T12:00:00.000Z'),
      }),
    ).toBeUndefined();
  });

  it('consumes a claimed cache exactly once', () => {
    const projectDirectory = project();
    const now = new Date('2026-08-02T12:00:00.000Z');
    rememberCloseoutBinding({ projectDirectory, runtime: 'codex', id: 'thread-42', now });

    const bindingPath = nodePath.join(
      projectDirectory,
      '.project',
      'closeout-session-binding.json',
    );
    expect(existsSync(bindingPath)).toBe(true);
    expect(readFreshCloseoutBinding({ projectDirectory, now })?.id).toBe('thread-42');
    expect(existsSync(bindingPath)).toBe(false);
    expect(readFreshCloseoutBinding({ projectDirectory, now })).toBeUndefined();
  });

  it('fails closed instead of adopting either of two pending session bindings', () => {
    const projectDirectory = project();
    const now = new Date('2026-08-02T12:00:00.000Z');
    rememberCloseoutBinding({ projectDirectory, runtime: 'codex', id: 'thread-a', now });
    rememberCloseoutBinding({ projectDirectory, runtime: 'codex', id: 'thread-b', now });

    expect(readFreshCloseoutBinding({ projectDirectory, now })).toBeUndefined();
  });
});
