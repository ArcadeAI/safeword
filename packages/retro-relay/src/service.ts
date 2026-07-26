/* eslint-disable unicorn/consistent-class-member-order -- Public state-machine operations precede internal transition helpers. */

import { setTimeout as delay } from 'node:timers/promises';

import { RelayError } from './errors.js';
import type { GitHubRestClient } from './github.js';
import {
  canonicalMarker,
  legacyMarker,
  normalizeRepo,
  payloadHash,
  requestMarker,
} from './identity.js';
import { encryptPayload } from './payload.js';
import type { DurableRequest, RelayStore } from './store.js';
import type {
  FileRetroDraftRequest,
  FilingReceipt,
  RelayPrincipal,
  RequestScope,
} from './types.js';

export interface RelayFaults {
  afterGitHubCreate?: () => void;
}

function authorize(
  principal: RelayPrincipal,
  request: FileRetroDraftRequest,
  role: 'file' | 'reconcile',
): RequestScope {
  const repo = normalizeRepo(request.repository);
  if (
    !principal.roles.includes(role) ||
    principal.installationId !== request.installationId ||
    principal.repository !== repo
  ) {
    throw new RelayError(403, 'repository is not authorized');
  }
  return {
    tenantId: principal.tenantId,
    installationId: request.installationId,
    repository: repo,
    requestId: request.requestId,
  };
}

function receiptFromRecord(record: DurableRequest): FilingReceipt {
  return {
    receiptId: record.receiptId,
    requestId: record.scope.requestId,
    state: record.state,
    ...(record.issueNumber !== undefined && { issueNumber: record.issueNumber }),
  };
}

function belongsTo(record: DurableRequest, principal: RelayPrincipal): boolean {
  return (
    record.scope.tenantId === principal.tenantId &&
    record.scope.installationId === principal.installationId &&
    record.scope.repository === principal.repository
  );
}

export class RelayService {
  readonly #github: GitHubRestClient;
  readonly #payloadKey: Buffer;
  readonly #store: RelayStore;
  readonly faults: RelayFaults;

  constructor(input: {
    store: RelayStore;
    github: GitHubRestClient;
    payloadKey: Buffer;
    faults?: RelayFaults;
  }) {
    this.#store = input.store;
    this.#github = input.github;
    this.#payloadKey = input.payloadKey;
    this.faults = input.faults ?? {};
  }

  async reconcile(principal: RelayPrincipal, receiptId: string): Promise<FilingReceipt> {
    const record = this.#store.loadByReceipt(receiptId);
    if (record === undefined || !belongsTo(record, principal)) {
      throw new RelayError(404, 'filing receipt not found');
    }
    if (!principal.roles.includes('reconcile')) {
      throw new RelayError(403, 'reconcile role is required');
    }
    if (record.state === 'filed') return receiptFromRecord(record);
    if (record.state !== 'ambiguous') {
      throw new RelayError(409, 'only ambiguous filings can be reconciled');
    }
    const scan = await this.#github.scanExactMarker({
      installationId: record.scope.installationId,
      repository: record.scope.repository,
      marker: record.requestMarker,
    });
    if (!scan.complete || scan.issueNumbers.length !== 1) {
      throw new RelayError(503, 'raw reconciliation is incomplete or non-unique', {
        receiptId,
        state: 'ambiguous',
      });
    }
    return this.#store.markFiled(record.scope, scan.issueNumbers[0]);
  }

  status(principal: RelayPrincipal, receiptId: string): FilingReceipt {
    const record = this.#store.loadByReceipt(receiptId);
    if (record === undefined || !belongsTo(record, principal)) {
      throw new RelayError(404, 'filing receipt not found');
    }
    return receiptFromRecord(record);
  }

  // eslint-disable-next-line complexity -- The branches mirror the durable state machine and stay together intentionally.
  async submit(principal: RelayPrincipal, request: FileRetroDraftRequest): Promise<FilingReceipt> {
    const scope = authorize(principal, request, 'file');
    const hash = payloadHash(request);
    const marker = requestMarker(scope);
    const accepted = this.#store.accept({
      scope,
      payloadHash: hash,
      envelope: encryptPayload(request, scope, hash, this.#payloadKey),
      requestMarker: marker,
    });
    // eslint-disable-next-line security/detect-possible-timing-attacks -- Both values are non-secret digests.
    if (accepted.record.payloadHash !== hash) {
      throw new RelayError(409, 'request identity was reused with a different payload');
    }
    if (accepted.record.state === 'filed') return receiptFromRecord(accepted.record);
    if (accepted.record.state === 'ambiguous') {
      throw new RelayError(503, 'filing outcome is ambiguous', {
        receiptId: accepted.record.receiptId,
        state: 'ambiguous',
      });
    }
    if (!this.#store.claim(scope)) return this.#waitForTerminal(scope);

    try {
      const adopted = await this.#adoptExisting(scope, request);
      if (adopted !== undefined) return adopted;
      const owner = this.#store.reserveEvidence(scope, [
        { kind: 'canonical', value: request.canonicalKey },
        { kind: 'legacy', value: request.legacySignature },
      ]);
      if (owner.scope.requestId !== scope.requestId) {
        return await this.#waitForTerminal(owner.scope);
      }
      const issueNumber = await this.#github.createIssue({
        installationId: scope.installationId,
        repository: scope.repository,
        title: request.title,
        body: `${request.body}\n\n${marker}`,
        labels: request.labels,
      });
      this.faults.afterGitHubCreate?.();
      return this.#store.markFiled(scope, issueNumber);
    } catch (error) {
      if (error instanceof RelayError) throw error;
      this.#store.markAmbiguous(scope);
      const record = this.#store.load(scope);
      throw new RelayError(503, 'filing outcome is ambiguous', {
        ...(record !== undefined && { receiptId: record.receiptId }),
        state: 'ambiguous',
      });
    }
  }

  async #adoptExisting(
    scope: RequestScope,
    request: FileRetroDraftRequest,
  ): Promise<FilingReceipt | undefined> {
    for (const marker of [
      canonicalMarker(request.canonicalKey),
      legacyMarker(request.legacySignature),
    ]) {
      const scan = await this.#github.scanExactMarker({
        installationId: scope.installationId,
        repository: scope.repository,
        marker,
      });
      if (!scan.complete || scan.issueNumbers.length > 1) {
        this.#store.markRetryable(scope);
        throw new RelayError(503, 'raw marker scan is incomplete or non-unique');
      }
      if (scan.issueNumbers.length === 1) {
        this.#store.reserveEvidence(scope, [
          { kind: 'canonical', value: request.canonicalKey },
          { kind: 'legacy', value: request.legacySignature },
        ]);
        return this.#store.markFiled(scope, scan.issueNumbers[0]);
      }
    }
    return undefined;
  }

  async #waitForTerminal(scope: RequestScope): Promise<FilingReceipt> {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const record = this.#store.load(scope);
      if (record === undefined) throw new RelayError(404, 'filing receipt not found');
      if (record.state === 'filed') return receiptFromRecord(record);
      if (record.state === 'ambiguous') {
        throw new RelayError(503, 'filing outcome is ambiguous', {
          receiptId: record.receiptId,
          state: 'ambiguous',
        });
      }
      await delay(5);
    }
    const record = this.#store.load(scope);
    throw new RelayError(202, 'filing remains in progress', {
      ...(record !== undefined && { receiptId: record.receiptId }),
    });
  }
}
