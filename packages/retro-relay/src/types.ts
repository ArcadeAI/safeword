export interface FileRetroDraftRequest {
  requestId: string;
  retryDeadlineAt: string;
  installationId: number;
  repository: string;
  canonicalKey: string;
  legacySignature: string;
  title: string;
  body: string;
  labels: string[];
}

export interface RelayPrincipal {
  tenantId: string;
  credentialId: string;
  subject: string;
  harness: 'claude' | 'codex' | 'cursor' | 'operator' | 'collector-worker';
  installationId: number;
  repository: string;
  roles: ('file' | 'ingest' | 'operate' | 'reconcile')[];
}

export type ReceiptState =
  | 'accepted'
  | 'claimed'
  | 'dispatching'
  | 'filed'
  | 'ambiguous'
  | 'retryable'
  | 'dead-letter'
  | 'rejected'
  | 'tombstone';

const resolvedReceiptStates = new Set<ReceiptState>(['filed', 'rejected', 'tombstone']);

export function isResolvedReceiptState(state: ReceiptState): boolean {
  return resolvedReceiptStates.has(state);
}

export function isTerminalReceiptState(state: ReceiptState): boolean {
  return state === 'dead-letter' || isResolvedReceiptState(state);
}

export interface FilingReceipt {
  receiptId: string;
  requestId: string;
  state: ReceiptState;
  issueNumber?: number;
}

export interface RequestScope {
  tenantId: string;
  installationId: number;
  repository: string;
  requestId: string;
}
