import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildPublicRetroEnvelope,
  deliverPublicRetro,
  preparePublicRetroRequest,
  type PublicRetroHttpRequest,
  submitPublicRetroRequest,
} from './public-delivery.js';

const requiredInput = {
  finding: 'fixture finding',
  sessionId: 'session-fixture-42',
  source: {
    harness: 'claude-code' as const,
    hostClass: 'local' as const,
    projectUUID: '018F0F2E-ABCD-7DEF-8ABC-DEF012345678',
    safewordCliVersion: '0.78.8',
  },
};

describe('buildPublicRetroEnvelope', () => {
  it('serializes the complete source profile deterministically', () => {
    const built = buildPublicRetroEnvelope({
      finding: 'fixture finding',
      sessionId: 'session-fixture-42',
      source: {
        userIdentity: 'fixture@example.test',
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
      '{"version":"v1","finding":"fixture finding","source":{"harness":"claude-code","hostClass":"local","projectUUID":"018f0f2e-abcd-7def-8abc-def012345678","safewordCliVersion":"0.78.8","repository":"github.com/arcadeai/safeword","agentVersion":"1.2.3","model":"fixture-model","safewordPluginVersion":"0.78.8","osFamily":"macos","userIdentity":"fixture@example.test"},"sessionScope":"724a847e56e94bd49967250b1b27444314f1e479700c1751c3723d9852e6bee0"}';

    expect(new TextDecoder().decode(built.bytes)).toBe(expected);
    expect(built.sessionScope).toBe(
      '724a847e56e94bd49967250b1b27444314f1e479700c1751c3723d9852e6bee0',
    );
    expect(built.bytes.byteLength).toBe(445);
    expect(createHash('sha256').update(built.bytes).digest('hex')).toBe(
      'a6701f5fea50ec66e811833d67ff2b51fc8ea3808d9562005690c49ff07cd2df',
    );
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

  it('abandons an oversized UTF-8 envelope before identity or claim', () => {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    let uuidCalls = 0;

    try {
      const prepared = preparePublicRetroRequest(
        { ...requiredInput, finding: '🚀'.repeat(16_384) },
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

  it('preserves work completed inside both exclusive budgets', async () => {
    const attemptsDirectory = mkdtempSync(path.join(tmpdir(), 'safeword-public-retro-'));
    const times = [0, 999, 999, 2998, 2998];

    try {
      const outcome = await deliverPublicRetro(requiredInput, {
        attemptsDirectory,
        now: () => times.shift() ?? 2998,
        randomUUID: () => '01911111-2222-7333-8444-55555555555A',
        transport: request =>
          Promise.resolve({
            requestId: request.headers['x-safeword-request-id'],
            receipt: 'receipt-fixture',
          }),
      });

      expect(outcome).toBe('preserved');
      expect(times).toEqual([]);
      const markerName = readdirSync(attemptsDirectory).find(name => name.endsWith('.json'));
      expect(markerName).toBeDefined();
      if (!markerName) throw new Error('Expected receipt marker');
      const marker = JSON.parse(readFileSync(path.join(attemptsDirectory, markerName), 'utf8'));
      expect(marker).toEqual({
        sessionScope: markerName?.replace(/\.json$/u, ''),
        receipt: 'receipt-fixture',
      });
    } finally {
      rmSync(attemptsDirectory, { recursive: true, force: true });
    }
  });
});
