/* eslint-disable unicorn/consistent-class-member-order -- Public state-machine operations precede internal transition helpers. */

import { RelayError } from './errors.js';
import type { GitHubRestClient } from './github.js';
import {
  canonicalMarker,
  legacyMarker,
  normalizeRepo,
  payloadHash,
  requestMarker,
} from './identity.js';
import { decryptPayload, encryptPayload } from './payload.js';
import type { DurableRequest, RelayStore } from './store.js';
import { SemanticEvidenceConflictError } from './store.js';
import type {
  FileRetroDraftRequest,
  FilingReceipt,
  RelayPrincipal,
  RequestScope,
} from './types.js';

export interface RelayFaults {
  afterGitHubCreate?: () => void;
  afterReceiptCommit?: () => void;
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

  operations(principal: RelayPrincipal): ReturnType<RelayStore['operations']> {
    if (!principal.roles.includes('operate')) {
      throw new RelayError(403, 'operate role is required');
    }
    return this.#store.operations();
  }

  async reconcile(principal: RelayPrincipal, receiptId: string): Promise<FilingReceipt> {
    if (!principal.roles.includes('reconcile')) {
      throw new RelayError(403, 'reconcile role is required');
    }
    const record = this.#store.loadByReceipt(receiptId);
    if (record === undefined || !belongsTo(record, principal)) {
      throw new RelayError(404, 'filing receipt not found');
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
    if (!scan.complete) {
      this.#store.recordReconciliation(receiptId, principal.subject, 'incomplete', 0);
      throw new RelayError(503, 'raw reconciliation is incomplete or non-unique', {
        receiptId,
        state: 'ambiguous',
        disposition: 'incomplete',
      });
    }
    if (scan.issueNumbers.length !== 1) {
      const disposition = scan.issueNumbers.length === 0 ? 'zero' : 'multiple';
      this.#store.recordReconciliation(
        receiptId,
        principal.subject,
        disposition,
        scan.issueNumbers.length,
      );
      throw new RelayError(503, 'raw reconciliation is incomplete or non-unique', {
        receiptId,
        state: 'ambiguous',
        disposition,
      });
    }
    this.#store.recordReconciliation(receiptId, principal.subject, 'adopted', 1);
    return this.#store.markReconciledFiled(record.scope, scan.issueNumbers[0]);
  }

  status(principal: RelayPrincipal, receiptId: string): FilingReceipt {
    if (!principal.roles.includes('file')) {
      throw new RelayError(403, 'file role is required');
    }
    const record = this.#store.loadByReceipt(receiptId);
    if (record === undefined || !belongsTo(record, principal)) {
      throw new RelayError(404, 'filing receipt not found');
    }
    const resolved = this.#store.receiptById(receiptId);
    if (resolved === undefined) throw new RelayError(404, 'filing receipt not found');
    return resolved;
  }

  async maintain(now = new Date()): Promise<{
    alerts: ReturnType<RelayStore['maintain']>['alerts'];
    attempted: number;
  }> {
    const due = this.#store.claimDueRetries(now);
    for (const record of due) {
      try {
        await this.#processClaimed(record, now);
      } catch {
        // The durable state records retryable/ambiguous outcomes per request.
        // One poisoned request must not prevent the rest of the sweep.
      }
    }
    return { attempted: due.length, ...this.#store.maintain(now) };
  }

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
    if (!this.#store.claim(scope)) {
      const current = this.#store.receipt(scope);
      if (current === undefined) throw new RelayError(404, 'filing receipt not found');
      return current;
    }
    const claimed = this.#store.load(scope);
    if (claimed === undefined) throw new RelayError(404, 'filing receipt not found');
    return this.#processClaimed(claimed, new Date());
  }

  // eslint-disable-next-line complexity -- Preparation, dispatch, and ambiguity branches are the durable retry state machine.
  async #processClaimed(record: DurableRequest, now: Date): Promise<FilingReceipt> {
    const { scope } = record;
    const hash = record.payloadHash;
    let durableRequest: FileRetroDraftRequest;
    let installationToken: string;
    try {
      durableRequest = decryptPayload(record.envelope, scope, hash, this.#payloadKey);
      const adopted = await this.#adoptExisting(scope, durableRequest, now);
      if (adopted !== undefined) return adopted;
      const owner = this.#store.reserveEvidence(scope, [
        { kind: 'canonical', value: durableRequest.canonicalKey },
        { kind: 'legacy', value: durableRequest.legacySignature },
      ]);
      if (owner.scope.requestId !== scope.requestId) {
        return this.#store.linkAlias(scope, owner);
      }
      installationToken = await this.#github.installationToken(
        scope.installationId,
        scope.repository,
      );
    } catch (error) {
      if (error instanceof SemanticEvidenceConflictError) {
        this.#store.markAmbiguous(scope);
        throw new RelayError(409, 'canonical and legacy evidence conflict', {
          receiptId: record.receiptId,
          state: 'ambiguous',
        });
      }
      this.#store.markRetryable(scope, now);
      if (error instanceof RelayError) throw error;
      throw new RelayError(503, 'filing preparation failed before dispatch');
    }
    if (!this.#store.beginDispatch(scope, now)) {
      const current = this.#store.receipt(scope);
      if (current === undefined) throw new RelayError(404, 'filing receipt not found');
      return current;
    }
    try {
      const issueNumber = await this.#github.createIssue({
        repository: scope.repository,
        title: durableRequest.title,
        body: `${durableRequest.body}\n\n${record.requestMarker}`,
        labels: durableRequest.labels,
        installationToken,
      });
      this.faults.afterGitHubCreate?.();
      return this.#store.markFiled(scope, issueNumber, now);
    } catch (error) {
      if (error instanceof RelayError) throw error;
      this.#store.markAmbiguous(scope);
      const currentRecord = this.#store.load(scope);
      throw new RelayError(503, 'filing outcome is ambiguous', {
        ...(currentRecord !== undefined && { receiptId: currentRecord.receiptId }),
        state: 'ambiguous',
      });
    }
  }

  // eslint-disable-next-line complexity -- Marker completeness and conflict branches are the raw-authority contract.
  async #adoptExisting(
    scope: RequestScope,
    request: FileRetroDraftRequest,
    now: Date,
  ): Promise<FilingReceipt | undefined> {
    const scans = [];
    for (const marker of [
      canonicalMarker(request.canonicalKey),
      legacyMarker(request.legacySignature),
    ]) {
      scans.push(
        await this.#github.scanExactMarker({
          installationId: scope.installationId,
          repository: scope.repository,
          marker,
        }),
      );
    }
    for (const scan of scans) {
      if (!scan.complete || scan.issueNumbers.length > 1) {
        throw new RelayError(503, 'raw marker scan is incomplete or non-unique');
      }
    }
    const canonicalIssue = scans[0]?.issueNumbers.at(0);
    const legacyIssue = scans[1]?.issueNumbers.at(0);
    if (
      canonicalIssue !== undefined &&
      legacyIssue !== undefined &&
      canonicalIssue !== legacyIssue
    ) {
      this.#store.markAmbiguous(scope);
      throw new RelayError(409, 'canonical and legacy raw markers conflict');
    }
    const issueNumber = canonicalIssue ?? legacyIssue;
    if (issueNumber === undefined) return undefined;
    this.#store.reserveEvidence(scope, [
      { kind: 'canonical', value: request.canonicalKey },
      { kind: 'legacy', value: request.legacySignature },
    ]);
    return this.#store.markFiled(scope, issueNumber, now);
  }
}
