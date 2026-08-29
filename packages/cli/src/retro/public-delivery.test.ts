import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  buildPublicRetroEnvelope,
  deliverSanitizedPublicRetroFindings,
  type PreparedPublicRetroRequest,
  preparePublicRetroRequest,
  type PublicRetroHttpRequest,
  submitPublicRetroRequest,
} from './public-delivery.js';

const requiredInput = {
  findings: ['fixture finding'],
  sessionId: 'session-fixture-42',
  source: {
    harness: 'claude-code' as const,
    hostClass: 'local' as const,
    projectUUID: '018F0F2E-ABCD-7DEF-8ABC-DEF012345678',
    safewordCliVersion: '0.78.8',
  },
};

describe('buildPublicRetroEnvelope', () => {
  it.each([
    ['claude-code', 'claude-1.2.3', 'claude-model'],
    ['codex', 'codex-1.2.3', 'gpt-fixture'],
  ] as const)('builds the exact current %s/unknown source', (harness, agentVersion, model) => {
    const built = buildPublicRetroEnvelope({
      ...requiredInput,
      source: {
        ...requiredInput.source,
        harness,
        hostClass: 'unknown',
        repository: 'github.com/arcadeai/safeword',
        agentVersion,
        model,
        osFamily: 'darwin',
      },
    });
    const envelope = JSON.parse(new TextDecoder().decode(built.bytes)) as {
      source: Record<string, unknown>;
    };

    expect(envelope.source).toEqual({
      harness,
      hostClass: 'unknown',
      projectUUID: '018f0f2e-abcd-7def-8abc-def012345678',
      safewordCliVersion: '0.78.8',
      repository: 'github.com/arcadeai/safeword',
      agentVersion,
      model,
      osFamily: 'darwin',
    });
  });

  it('serializes the released complete source profile deterministically', () => {
    const built = buildPublicRetroEnvelope({
      findings: ['fixture finding'],
      sessionId: 'session-fixture-42',
      source: {
        osFamily: 'macos',
        safewordPluginVersion: '0.78.8',
        model: 'fixture-model',
        agentVersion: '1.2.3',
        repository: 'github.com/arcadeai/safeword',
        safewordCliVersion: '0.78.8',
        projectUUID: '018F0F2E-ABCD-7DEF-8ABC-DEF012345678',
        hostClass: 'local',
        harness: 'claude-code',
      },
    });

    const expected =
      '{"version":"v2","findings":["fixture finding"],"source":{"harness":"claude-code","hostClass":"local","projectUUID":"018f0f2e-abcd-7def-8abc-def012345678","safewordCliVersion":"0.78.8","repository":"github.com/arcadeai/safeword","agentVersion":"1.2.3","model":"fixture-model","safewordPluginVersion":"0.78.8","osFamily":"macos"},"sessionScope":"724a847e56e94bd49967250b1b27444314f1e479700c1751c3723d9852e6bee0"}';

    expect(new TextDecoder().decode(built.bytes)).toBe(expected);
    expect(built.sessionScope).toBe(
      '724a847e56e94bd49967250b1b27444314f1e479700c1751c3723d9852e6bee0',
    );
    expect(built.bytes.byteLength).toBe(410);
    expect(createHash('sha256').update(built.bytes).digest('hex')).toBe(
      '99fbe2730fac1dd0b3523467e18a40a1a11831b34c6974b24d5246b3d98783d0',
    );
  });

  it('normalizes required CLI version with the same bounded hygiene', () => {
    const built = buildPublicRetroEnvelope({
      ...requiredInput,
      source: { ...requiredInput.source, safewordCliVersion: ' 0.80.1 ' },
    });
    const envelope = JSON.parse(new TextDecoder().decode(built.bytes)) as {
      source: Record<string, unknown>;
    };

    expect(envelope.source.safewordCliVersion).toBe('0.80.1');
    expect(() =>
      buildPublicRetroEnvelope({
        ...requiredInput,
        source: { ...requiredInput.source, safewordCliVersion: 'v'.repeat(257) },
      }),
    ).toThrow('Invalid public retrospective input');
  });

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['whitespace-only', ' '.repeat(3)],
  ] as const)('omits %s optional source values', (_availability, content) => {
    const fields = [
      'repository',
      'agentVersion',
      'model',
      'safewordPluginVersion',
      'osFamily',
    ] as const;

    for (const field of fields) {
      const built = buildPublicRetroEnvelope({
        ...requiredInput,
        source: { ...requiredInput.source, [field]: content },
      });
      const envelope = JSON.parse(new TextDecoder().decode(built.bytes)) as {
        source: Record<string, unknown>;
      };
      expect(envelope.source).not.toHaveProperty(field);
    }
  });

  it.each([
    ['control character', `model\u{7}`, false],
    ['C1 control character', `model\u{85}`, false],
    ['256 UTF-8 bytes', 'é'.repeat(128), true],
    ['257 UTF-8 bytes', `${'é'.repeat(127)}abc`, false],
    ['256 non-BMP UTF-8 bytes', '🚀'.repeat(64), true],
    ['260 non-BMP UTF-8 bytes', '🚀'.repeat(65), false],
    ['trimmed non-ASCII whitespace', `\u{2003}model-fixture\u{2003}`, true],
  ] as const)('enforces the optional source boundary for %s', (_name, model, retained) => {
    const built = buildPublicRetroEnvelope({
      ...requiredInput,
      source: { ...requiredInput.source, model },
    });
    const envelope = JSON.parse(new TextDecoder().decode(built.bytes)) as {
      source: Record<string, unknown>;
    };

    expect(Object.hasOwn(envelope.source, 'model')).toBe(retained);
    if (retained) expect(envelope.source.model).toBe(model.trim());
  });

  it('generates one transport-independent request identity after claiming the scope', () => {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    let uuidCalls = 0;

    try {
      const prepared = preparePublicRetroRequest(requiredInput, {
        attemptsDirectory,
        randomUUID: () => {
          uuidCalls += 1;
          return '01911111-2222-7333-8444-55555555555A';
        },
      });

      expect(uuidCalls).toBe(1);
      expect(prepared?.requestId).toBe('01911111-2222-7333-8444-55555555555a');
      expect(new TextDecoder().decode(prepared?.bytes)).not.toContain(prepared?.requestId);
      const markerPath = path.join(attemptsDirectory, `${prepared?.sessionScope}.json`);
      const marker = JSON.parse(readFileSync(markerPath, 'utf8')) as unknown;
      expect(marker).toEqual({ sessionScope: prepared?.sessionScope });
    } finally {
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  });

  it.each([
    ['the same Cursor conversation', 'cursor-1', 'cursor-1', true],
    ['different Cursor conversations', 'cursor-1', 'cursor-2', false],
  ] as const)(
    'uses conversation identity to scope %s',
    (_case, firstSessionId, secondSessionId, sameScope) => {
      const first = buildPublicRetroEnvelope({ ...requiredInput, sessionId: firstSessionId });
      const second = buildPublicRetroEnvelope({ ...requiredInput, sessionId: secondSessionId });

      expect(first.sessionScope === second.sessionScope).toBe(sameScope);
    },
  );

  it('abandons an oversized UTF-8 envelope before identity or claim', () => {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    let uuidCalls = 0;

    try {
      const prepared = preparePublicRetroRequest(
        { ...requiredInput, findings: ['🚀'.repeat(16_384)] },
        {
          attemptsDirectory,
          randomUUID: () => {
            uuidCalls += 1;
            return '01911111-2222-7333-8444-55555555555A';
          },
        },
      );

      expect(prepared).toBeUndefined();
      expect(uuidCalls).toBe(0);
      expect(readdirSync(attemptsDirectory)).toEqual([]);
    } finally {
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  });

  function prepareSizedBatch(byteLength: number): PreparedPublicRetroRequest | undefined {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    const baseLength = buildPublicRetroEnvelope({
      ...requiredInput,
      findings: ['a'],
    }).bytes.byteLength;
    const input = {
      ...requiredInput,
      findings: ['a'.repeat(byteLength - baseLength + 1)],
    };

    try {
      return preparePublicRetroRequest(input, {
        attemptsDirectory,
        randomUUID: () => '01911111-2222-7333-8444-55555555555a',
      });
    } finally {
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  }

  it('accepts a complete v2 batch at the 65536-byte limit', () => {
    expect(prepareSizedBatch(65_536)?.bytes.byteLength).toBe(65_536);
  });

  it('abandons a complete v2 batch above the 65536-byte limit', () => {
    expect(prepareSizedBatch(65_537)).toBeUndefined();
  });

  it('hands the same prepared identity and bytes to either harness transport', async () => {
    const bytes = new TextEncoder().encode('{"fixture":true}');
    const prepared = {
      bytes,
      requestId: '01911111-2222-7333-8444-55555555555a',
      sessionScope: '7'.repeat(64),
    };
    const observed: PublicRetroHttpRequest[] = [];
    const transport = (request: PublicRetroHttpRequest) => {
      observed.push(request);
      return Promise.resolve({ requestId: prepared.requestId, receipt: 'receipt-fixture' });
    };

    await submitPublicRetroRequest(prepared, transport);
    await submitPublicRetroRequest(prepared, transport);

    expect(observed).toHaveLength(2);
    for (const request of observed) {
      expect(request).toEqual({
        method: 'POST',
        path: '/v1/public-retros',
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-safeword-request-id': prepared.requestId,
        },
        body: bytes,
        redirect: 'error',
      });
      expect(request.body).toBe(bytes);
    }
  });

  it('delivers an already-sanitized finding within the original preparation deadline', async () => {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    const times = [999, 999, 999, 2998, 2998];
    try {
      const outcome = await deliverSanitizedPublicRetroFindings(
        {
          findings: [
            {
              category: 'bug',
              title: 'Shared sanitized finding',
              safewordSurface: 'packages/cli/src/retro/public-delivery.ts',
              whatHappened: 'The shared result reached delivery.',
              whyFriction: 'A second scrub would waste the deadline.',
              repro: 'Prepare one finding.',
            },
          ],
          source: requiredInput.source,
          sessionId: requiredInput.sessionId,
        },
        {
          attemptsDirectory,
          now: () => times.shift() ?? 2998,
          randomUUID: () => '01911111-2222-7333-8444-55555555555a',
          transport: request =>
            Promise.resolve({
              requestId: request.headers['x-safeword-request-id'],
              receipt: 'receipt-fixture',
            }),
        },
        1000,
      );

      expect(outcome).toBe('preserved');
      expect(times).toEqual([]);
    } finally {
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  });

  it('abandons an already-sanitized finding on its exclusive deadline before claim', async () => {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    const times = [1000];
    let uuidCalls = 0;
    let transportCalls = 0;

    try {
      const outcome = await deliverSanitizedPublicRetroFindings(
        {
          findings: [
            {
              category: 'bug',
              title: 'Deadline finding',
              safewordSurface: 'packages/cli/src/retro/public-delivery.ts',
              whatHappened: 'Preparation reached its deadline.',
              whyFriction: 'Late work must not be claimed.',
              repro: 'Reach the preparation deadline.',
            },
          ],
          source: requiredInput.source,
          sessionId: requiredInput.sessionId,
        },
        {
          attemptsDirectory,
          now: () => times.shift() ?? 1000,
          randomUUID: () => {
            uuidCalls += 1;
            return '01911111-2222-7333-8444-55555555555A';
          },
          transport: () => {
            transportCalls += 1;
            return Promise.reject(new Error('must not submit'));
          },
        },
        1000,
      );

      expect(outcome).toBe('abandoned');
      expect(uuidCalls).toBe(0);
      expect(transportCalls).toBe(0);
      expect(readdirSync(attemptsDirectory)).toEqual([]);
    } finally {
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  });

  it('contains a collector connection failure without retrying', async () => {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    const transport = vi.fn(() => Promise.reject(new Error('injected connection failure')));
    try {
      const outcome = await deliverSanitizedPublicRetroFindings(
        {
          findings: [
            {
              category: 'bug',
              title: 'Connection failure fixture',
              safewordSurface: 'packages/cli/src/retro/public-delivery.ts',
              whatHappened: 'The collector connection failed.',
              whyFriction: 'Public delivery must not disrupt private recovery.',
              repro: 'Reject the injected transport.',
            },
          ],
          source: requiredInput.source,
          sessionId: requiredInput.sessionId,
        },
        {
          attemptsDirectory,
          now: () => 0,
          randomUUID: () => '01911111-2222-7333-8444-55555555555a',
          transport,
        },
        1000,
      );

      expect(outcome).toBe('abandoned');
      expect(transport).toHaveBeenCalledOnce();
      expect(readdirSync(attemptsDirectory)).toEqual([]);
    } finally {
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  });

  it('abandons a collector handoff at the existing deadline without retrying', async () => {
    vi.useFakeTimers();
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    const transport = vi.fn(
      (_request: PublicRetroHttpRequest, signal?: AbortSignal) =>
        new Promise<never>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new Error('injected handoff timeout'));
          });
        }),
    );
    try {
      const delivery = deliverSanitizedPublicRetroFindings(
        {
          findings: [
            {
              category: 'bug',
              title: 'Handoff timeout fixture',
              safewordSurface: 'packages/cli/src/retro/public-delivery.ts',
              whatHappened: 'The collector held the request open.',
              whyFriction: 'Public delivery must remain bounded.',
              repro: 'Hold the injected transport open.',
            },
          ],
          source: requiredInput.source,
          sessionId: requiredInput.sessionId,
        },
        {
          attemptsDirectory,
          now: () => 0,
          randomUUID: () => '01911111-2222-7333-8444-55555555555a',
          transport,
        },
        1000,
      );

      await vi.advanceTimersByTimeAsync(2000);
      expect(await delivery).toBe('abandoned');
      expect(transport).toHaveBeenCalledOnce();
      expect(readdirSync(attemptsDirectory)).toEqual([]);
    } finally {
      vi.useRealTimers();
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  });

  it('contains renderer failures before claim or handoff', async () => {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    const finding = {
      category: 'bug' as const,
      get title(): string {
        throw new Error('injected renderer failure');
      },
      safewordSurface: 'packages/cli/src/retro/public-delivery.ts',
      whatHappened: 'The renderer failed.',
      whyFriction: 'A hook failure would be visible.',
      repro: 'Render the finding.',
    };
    let transportCalls = 0;
    try {
      const outcome = await deliverSanitizedPublicRetroFindings(
        { findings: [finding], source: requiredInput.source, sessionId: requiredInput.sessionId },
        {
          attemptsDirectory,
          now: () => 0,
          randomUUID: () => '01911111-2222-7333-8444-55555555555A',
          transport: () => {
            transportCalls += 1;
            return Promise.reject(new Error('must not submit'));
          },
        },
        1000,
      );

      expect(outcome).toBe('abandoned');
      expect(transportCalls).toBe(0);
      expect(readdirSync(attemptsDirectory)).toEqual([]);
    } finally {
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  });

  it('removes an uncommitted receipt temporary file at the handoff deadline', async () => {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    const times = [0, 0, 0, 1999, 2000];
    try {
      const outcome = await deliverSanitizedPublicRetroFindings(
        {
          findings: [
            {
              category: 'bug',
              title: 'Late receipt fixture',
              safewordSurface: 'packages/cli/src/retro/public-delivery.ts',
              whatHappened: 'The receipt reached its persistence deadline.',
              whyFriction: 'Temporary files must not accumulate.',
              repro: 'Reach the handoff deadline after the temporary write.',
            },
          ],
          source: requiredInput.source,
          sessionId: requiredInput.sessionId,
        },
        {
          attemptsDirectory,
          now: () => times.shift() ?? 2000,
          randomUUID: () => '01911111-2222-7333-8444-55555555555A',
          transport: request =>
            Promise.resolve({
              requestId: request.headers['x-safeword-request-id'],
              receipt: 'receipt-fixture',
            }),
        },
        1000,
      );

      expect(outcome).toBe('abandoned');
      const [marker] = readdirSync(attemptsDirectory);
      expect(marker).toEqual(expect.stringMatching(/\.json$/u));
      if (marker === undefined) throw new TypeError('expected retained claim marker');
      const markerPath = path.join(attemptsDirectory, marker);
      const persisted = JSON.parse(readFileSync(markerPath, 'utf8')) as unknown;
      expect(persisted).toEqual({ sessionScope: expect.any(String) });
    } finally {
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  });
});
