import { createCipheriv } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { decryptPayload, encryptPayload } from '../src/payload.js';
import type { FileRetroDraftRequest, RequestScope } from '../src/types.js';

const request: FileRetroDraftRequest = {
  body: 'encrypted body',
  canonicalKey: 'canonical:key',
  installationId: 42,
  labels: ['retro'],
  legacySignature: 'retro:signature',
  repository: 'arcadeai/safeword',
  requestId: '00000000-0000-4000-8000-000000000147',
  retryDeadlineAt: '2099-01-01T00:00:00.000Z',
  title: 'encrypted title',
};

const scope: RequestScope = {
  installationId: 42,
  repository: 'arcadeai/safeword',
  requestId: request.requestId,
  tenantId: 'tenant-1',
};

describe('payload key rotation', () => {
  it('decrypts schema-v3 envelopes with the legacy associated-data format', () => {
    const key = Buffer.alloc(32, 1);
    const nonce = Buffer.alloc(12, 2);
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(
      Buffer.from(
        JSON.stringify([
          'payload-v1',
          scope.tenantId,
          scope.installationId,
          scope.repository,
          scope.requestId,
          'payload-hash',
        ]),
      ),
    );
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(request), 'utf8'),
      cipher.final(),
    ]);

    const keys = new Map([
      ['legacy', key],
      ['current', Buffer.alloc(32, 2)],
    ]);
    expect(
      decryptPayload(
        {
          ciphertext,
          formatVersion: 1,
          keyId: 'legacy',
          nonce,
          tag: cipher.getAuthTag(),
        },
        scope,
        'payload-hash',
        {
          activeKeyId: 'current',
          keys,
        },
      ),
    ).toEqual(request);
  });

  it('decrypts old envelopes after a new key becomes active', () => {
    const oldKey = Buffer.alloc(32, 1);
    const newKey = Buffer.alloc(32, 2);
    const envelope = encryptPayload(request, scope, 'payload-hash', {
      activeKeyId: '2026-06',
      keys: new Map([['2026-06', oldKey]]),
    });

    expect(envelope.keyId).toBe('2026-06');
    expect(
      decryptPayload(envelope, scope, 'payload-hash', {
        activeKeyId: '2026-07',
        keys: new Map([
          ['2026-06', oldKey],
          ['2026-07', newKey],
        ]),
      }),
    ).toEqual(request);
  });

  it('fails with the missing key id instead of a generic authentication error', () => {
    const envelope = encryptPayload(request, scope, 'payload-hash', {
      activeKeyId: 'retired',
      keys: new Map([['retired', Buffer.alloc(32, 1)]]),
    });

    expect(() =>
      decryptPayload(envelope, scope, 'payload-hash', {
        activeKeyId: 'current',
        keys: new Map([['current', Buffer.alloc(32, 2)]]),
      }),
    ).toThrow('payload key retired is unavailable');
  });
});
