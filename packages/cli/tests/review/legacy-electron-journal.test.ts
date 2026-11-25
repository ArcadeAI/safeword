import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it, vi } from 'vitest';

import { retrospectiveCloseTag } from '../../src/review/job.js';
import {
  hasPassedElectronReplay,
  withElectronReplay,
} from '../../src/review/retrospective-electron-journal.js';

const identity = {
  proofId: '22222222-2222-4222-8222-222222222222',
  scenario: 'A differently cased soul suffix opens as a package',
  inputSha256: 'a'.repeat(64),
};
const commit = 'b'.repeat(40);

interface JournalEnvelopeFixture {
  record: {
    schema_version: number;
    policySha256: string;
    identity: typeof identity;
    state: string;
  };
  integrity: string;
}

it('authorizes a completed replay only after its owned pending execution finishes', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-journal-'));
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'profile'));
  try {
    expect(hasPassedElectronReplay(root, identity, commit)).toBe(false);
    const result = await withElectronReplay(root, identity, commit, () => {
      expect(hasPassedElectronReplay(root, identity, commit)).toBe(false);
      return Promise.resolve('executed');
    });
    expect(result).toBe('executed');
    expect(hasPassedElectronReplay(root, identity, commit)).toBe(true);
    expect(hasPassedElectronReplay(root, identity, 'c'.repeat(40))).toBe(false);
  } finally {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
});

it('requires a fresh proof review after failure even if the old row passed at the same HEAD', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-journal-'));
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'profile'));
  try {
    await withElectronReplay(root, identity, commit, () => Promise.resolve('first pass'));
    await expect(
      withElectronReplay(root, identity, commit, () =>
        Promise.reject(new Error('mutation no longer discriminates')),
      ),
    ).rejects.toThrow('mutation no longer discriminates');
    expect(hasPassedElectronReplay(root, identity, commit)).toBe(false);
    await expect(
      withElectronReplay(root, identity, commit, () => Promise.resolve('later pass')),
    ).rejects.toThrow('fresh proof review');
    const renewed = { ...identity, proofId: '33333333-3333-4333-8333-333333333333' };
    await withElectronReplay(root, renewed, commit, () => Promise.resolve('fresh reviewed pass'));
    expect(hasPassedElectronReplay(root, renewed, commit)).toBe(true);
    const records = path.join(root, '.safeword/state/reviews');
    const retained = readdirSync(records)
      .filter(file => file.endsWith('.json'))
      .map(file => JSON.parse(readFileSync(path.join(records, file), 'utf8')));
    expect(retained).toHaveLength(2);
    expect(
      retained.map(item => item.record.state).toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(['failed', 'passed']);
  } finally {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
});

it('refuses a concurrent replay without taking ownership from the first invocation', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-journal-'));
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'profile'));
  const completion: { resolve?: (value: string) => void } = {};
  const execution = new Promise<string>(resolve => {
    completion.resolve = resolve;
  });
  const first = withElectronReplay(root, identity, commit, () => execution);
  try {
    await expect(
      withElectronReplay(root, identity, commit, () => Promise.resolve('second')),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    expect(hasPassedElectronReplay(root, identity, commit)).toBe(false);
    completion.resolve?.('first');
    await expect(first).resolves.toBe('first');
    expect(hasPassedElectronReplay(root, identity, commit)).toBe(true);
  } finally {
    completion.resolve?.('cleanup');
    try {
      await first;
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  }
});

it('retains an interrupted pending execution and refuses the same proof review', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-journal-'));
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'profile'));
  const module = path.resolve(
    import.meta.dirname,
    '../../src/review/retrospective-electron-journal.ts',
  );
  const script = `
    import { withElectronReplay } from ${JSON.stringify(module)};
    await withElectronReplay(${JSON.stringify(root)}, ${JSON.stringify(identity)}, ${JSON.stringify(commit)}, async () => {
      process.stdout.write('PENDING');
      process.stdin.resume();
      await new Promise(resolve => process.stdin.once('end', resolve));
      return 'finished';
    });
  `;
  const child = spawn('bun', ['--eval', script], { stdio: ['pipe', 'pipe', 'pipe'] });
  const exited = once(child, 'exit');
  try {
    const ready = async () => {
      const [bytes] = await once(child.stdout, 'data');
      return String(bytes);
    };
    const prematureExit = async () => {
      await exited;
      return 'exited before writing pending';
    };
    await expect(Promise.race([ready(), prematureExit()])).resolves.toBe('PENDING');
    expect(hasPassedElectronReplay(root, identity, commit)).toBe(false);
    child.kill('SIGKILL');
    await exited;
    for (const [nextIdentity, nextCommit] of [
      [identity, 'c'.repeat(40)],
      [{ ...identity, inputSha256: 'd'.repeat(64) }, commit],
    ] as const) {
      await expect(
        withElectronReplay(root, nextIdentity, nextCommit, () => Promise.resolve('retry')),
      ).rejects.toMatchObject({ code: 'EEXIST' });
      expect(hasPassedElectronReplay(root, nextIdentity, nextCommit)).toBe(false);
    }
    await expect(
      withElectronReplay(root, identity, commit, () => Promise.resolve('retry')),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    expect(hasPassedElectronReplay(root, identity, commit)).toBe(false);
    const records = path.join(root, '.safeword/state/reviews');
    const file = readdirSync(records).find(name => name.endsWith('.json'));
    const envelope = JSON.parse(readFileSync(path.join(records, file ?? 'missing'), 'utf8'));
    expect(envelope.record.state).toBe('pending');
  } finally {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await exited;
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
});

it.each([
  ['commit', identity, 'c'.repeat(40)],
  ['input digest', { ...identity, inputSha256: 'd'.repeat(64) }, commit],
] as const)(
  'cannot reuse a failed proof review by changing its %s',
  async (_name, nextIdentity, nextCommit) => {
    const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-journal-'));
    vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'profile'));
    try {
      await expect(
        withElectronReplay(root, identity, commit, () =>
          Promise.reject(new Error('mutation survived')),
        ),
      ).rejects.toThrow('mutation survived');
      await expect(
        withElectronReplay(root, nextIdentity, nextCommit, () => Promise.resolve('retry')),
      ).rejects.toThrow(/fresh proof review/u);
      expect(hasPassedElectronReplay(root, nextIdentity, nextCommit)).toBe(false);
    } finally {
      vi.unstubAllEnvs();
      rmSync(root, { recursive: true, force: true });
    }
  },
);

it('keeps authorization blocked if final durable publication fails', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-journal-'));
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'profile'));
  try {
    await expect(
      withElectronReplay(root, identity, commit, () => {
        const records = path.join(root, '.safeword/state/reviews');
        const file = readdirSync(records).find(name => name.endsWith('.json'));
        const destination = path.join(records, file ?? 'missing');
        rmSync(destination);
        mkdirSync(destination);
        return Promise.resolve('executed but cannot publish');
      }),
    ).rejects.toMatchObject({ code: 'EISDIR' });
    expect(hasPassedElectronReplay(root, identity, commit)).toBe(false);
    await expect(
      withElectronReplay(root, identity, commit, () => Promise.resolve('retry')),
    ).rejects.toMatchObject({ code: 'EEXIST' });
  } finally {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
});

it.each<[string, (envelope: JournalEnvelopeFixture) => void, boolean]>([
  [
    'a forged integrity tag',
    envelope => {
      envelope.integrity = '0'.repeat(64);
    },
    false,
  ],
  [
    'a state changed without its signature',
    envelope => {
      envelope.record.state = 'pending';
    },
    false,
  ],
  [
    'an authenticated foreign policy',
    envelope => {
      envelope.record.policySha256 = 'f'.repeat(64);
    },
    true,
  ],
  [
    'an authenticated foreign scenario',
    envelope => {
      envelope.record.identity.scenario = 'Ordinary folders remain folders';
    },
    true,
  ],
  [
    'an authenticated unsupported schema',
    envelope => {
      envelope.record.schema_version = 2;
    },
    true,
  ],
  [
    'an authenticated pending record without a lock',
    envelope => {
      envelope.record.state = 'pending';
    },
    true,
  ],
])('refuses %s before executing or refreshing its replay record', async (_name, tamper, resign) => {
  const root = mkdtempSync(path.join(tmpdir(), 'safeword-electron-journal-'));
  vi.stubEnv('SAFEWORD_REVIEW_KEY_ROOT', path.join(root, 'profile'));
  try {
    await withElectronReplay(root, identity, commit, () => Promise.resolve('initial pass'));
    const records = path.join(root, '.safeword/state/reviews');
    const filename = readdirSync(records).find(file => file.endsWith('.json'));
    const recordPath = path.join(records, filename ?? 'missing');
    const envelope = JSON.parse(readFileSync(recordPath, 'utf8')) as JournalEnvelopeFixture;
    tamper(envelope);
    // Only this temporary fixture owns the signing key. Resigning isolates the
    // scope/state guard from HMAC rejection; it creates no real review receipt.
    if (resign)
      envelope.integrity = retrospectiveCloseTag(
        root,
        `electron-replay-v1\0${JSON.stringify(envelope.record)}`,
      );
    const bytes = JSON.stringify(envelope);
    writeFileSync(recordPath, bytes);
    expect(hasPassedElectronReplay(root, identity, commit)).toBe(false);
    const marker = path.join(root, 'executed-after-invalid-record');
    await expect(
      withElectronReplay(root, identity, commit, () => {
        writeFileSync(marker, 'unexpected execution');
        return Promise.resolve('invalid retry');
      }),
    ).rejects.toThrow();
    expect(existsSync(marker)).toBe(false);
    expect(readFileSync(recordPath, 'utf8')).toBe(bytes);
  } finally {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  }
});
