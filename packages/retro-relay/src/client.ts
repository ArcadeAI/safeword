/* eslint-disable unicorn/consistent-class-member-order -- Public adapter operations precede the shared transport helper. */

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
    return this.#request('/v1/retro-filings', request);
  }

  async #request(path: string, body: unknown): Promise<FilingReceipt> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.#credential.length > 0) headers.authorization = `Bearer ${this.#credential}`;
    const response = await fetch(`${this.#relayUrl}${path}`, {
      method: 'POST',
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
    return this.#request(`/v1/retro-filings/${encodeURIComponent(receiptId)}/reconcile`, undefined);
  }
}

export function createHarnessAdapters(
  relayUrl: string,
  credential: string,
): {
  claude: FilingAdapter;
  codex: FilingAdapter;
  cursor: FilingAdapter;
  operator: FilingAdapter;
} {
  return {
    claude: new FilingAdapter(relayUrl, credential),
    codex: new FilingAdapter(relayUrl, credential),
    cursor: new FilingAdapter(relayUrl, credential),
    operator: new FilingAdapter(relayUrl, credential),
  };
}
