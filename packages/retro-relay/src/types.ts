export interface FileRetroDraftRequest {
  requestId: string;
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
  harness: 'claude' | 'codex' | 'cursor' | 'operator';
  installationId: number;
  repository: string;
  roles: ('file' | 'reconcile')[];
}

export type ReceiptState = 'accepted' | 'dispatching' | 'filed' | 'ambiguous' | 'retryable';

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
