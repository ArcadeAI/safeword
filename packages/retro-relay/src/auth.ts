import { createHmac, timingSafeEqual } from 'node:crypto';

import type { RelayPrincipal } from './types.js';

export interface CredentialInput extends Omit<RelayPrincipal, 'credentialId'> {
  credentialId: string;
  secret: string;
}

interface CredentialRecord {
  principal: RelayPrincipal;
  verifier: Buffer;
}

function verifyDigest(pepper: string, secret: string): Buffer {
  return createHmac('sha256', pepper).update(secret).digest();
}

export class CredentialRegistry {
  readonly #records = new Map<string, CredentialRecord>();
  readonly #pepper: string;

  constructor(pepper: string) {
    this.#pepper = pepper;
  }

  issue(input: CredentialInput): string {
    if (!/^[\da-z-]+$/u.test(input.credentialId) || !/^[\da-f]{64}$/u.test(input.secret)) {
      throw new Error('invalid relay credential material');
    }
    const principal: RelayPrincipal = {
      tenantId: input.tenantId,
      credentialId: input.credentialId,
      subject: input.subject,
      harness: input.harness,
      installationId: input.installationId,
      repository: input.repository.toLowerCase(),
      roles: input.roles,
    };
    this.#records.set(input.credentialId, {
      principal,
      verifier: verifyDigest(this.#pepper, input.secret),
    });
    return `swc_${input.credentialId}_${input.secret}`;
  }

  authenticate(authorization: string | undefined): RelayPrincipal | undefined {
    const match = /^Bearer swc_([\da-z-]+)_([\da-f]{64})$/u.exec(authorization ?? '');
    if (match === null) return undefined;
    const [, credentialId, secret] = match;
    const record = this.#records.get(credentialId);
    if (record === undefined) return undefined;
    const candidate = verifyDigest(this.#pepper, secret);
    if (!timingSafeEqual(candidate, record.verifier)) return undefined;
    return record.principal;
  }
}
