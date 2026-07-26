/* eslint-disable unicorn/consistent-class-member-order -- Public adapter operations precede the shared transport helper. */

import { setTimeout as delay } from 'node:timers/promises';

import type { FileRetroDraftRequest, FilingReceipt } from './types.js';

export class RelayClientError extends Error {
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(status: number, message: string, details: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

class FilingAdapter {
  readonly #credential: string;
  readonly #relayUrl: string;

  constructor(relayUrl: string, credential: string) {
    this.#relayUrl = relayUrl;
    this.#credential = credential;
  }

  async file(request: FileRetroDraftRequest): Promise<FilingReceipt> {
    const receipt = await this.#request('/v1/retro-filings', request, 'POST');
    return receipt.state === 'filed' ? receipt : this.#poll(receipt.receiptId);
  }

  async #poll(receiptId: string): Promise<FilingReceipt> {
    for (let attempt = 0; attempt < 400; attempt += 1) {
      const receipt = await this.#request(
        `/v1/retro-filings/${encodeURIComponent(receiptId)}`,
        undefined,
        'GET',
      );
      if (receipt.state === 'filed') return receipt;
      if (receipt.state === 'ambiguous') {
        throw new RelayClientError(503, 'filing outcome is ambiguous', {
          receiptId,
          state: receipt.state,
        });
      }
      await delay(5);
    }
    throw new RelayClientError(202, 'filing remains in progress', { receiptId });
  }

  async #request(path: string, body: unknown, method: 'GET' | 'POST'): Promise<FilingReceipt> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.#credential.length > 0) headers.authorization = `Bearer ${this.#credential}`;
    const response = await fetch(`${this.#relayUrl}${path}`, {
      method,
      headers,
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    const result = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new RelayClientError(
        response.status,
        typeof result.error === 'string' ? result.error : 'relay request failed',
        result,
      );
    }
    if (
      typeof result.receiptId !== 'string' ||
      typeof result.requestId !== 'string' ||
      typeof result.state !== 'string'
    ) {
      throw new RelayClientError(502, 'relay returned an invalid receipt', result);
    }
    return result as unknown as FilingReceipt;
  }

  async reconcile(request: FileRetroDraftRequest): Promise<FilingReceipt> {
    let receiptId: string | undefined;
    try {
      return await this.file(request);
    } catch (error) {
      if (error instanceof RelayClientError) {
        receiptId =
          typeof error.details.receiptId === 'string' ? error.details.receiptId : undefined;
      }
      if (receiptId === undefined) throw error;
    }
    return this.#request(
      `/v1/retro-filings/${encodeURIComponent(receiptId)}/reconcile`,
      undefined,
      'POST',
    );
  }
}

export function createHarnessAdapters(
  relayUrl: string,
  credential:
    | string
    | {
        claude: string;
        codex: string;
        cursor: string;
        operator: string;
      },
): {
  claude: FilingAdapter;
  codex: FilingAdapter;
  cursor: FilingAdapter;
  operator: FilingAdapter;
} {
  const credentials =
    typeof credential === 'string'
      ? { claude: credential, codex: credential, cursor: credential, operator: credential }
      : credential;
  return {
    claude: new FilingAdapter(relayUrl, credentials.claude),
    codex: new FilingAdapter(relayUrl, credentials.codex),
    cursor: new FilingAdapter(relayUrl, credentials.cursor),
    operator: new FilingAdapter(relayUrl, credentials.operator),
  };
}
