/* eslint-disable unicorn/consistent-class-member-order -- Public adapter operations precede the shared transport helper. */

import { setTimeout as delay } from 'node:timers/promises';

import type { FileRetroDraftRequest, FilingReceipt } from '../../src/types.js';

function retryAfterMilliseconds(response: Response): number {
  const seconds = Number(response.headers.get('retry-after') ?? '1');
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : 1000;
}

function isFiledResult(receipt: FilingReceipt): boolean {
  return ['dead-letter', 'filed', 'rejected', 'tombstone'].includes(receipt.state);
}

class RelayClientError extends Error {
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
  readonly #pollBudgetMs: number;
  readonly #relayUrl: string;
  readonly #sleep: (milliseconds: number) => Promise<void>;

  constructor(
    relayUrl: string,
    credential: string,
    options: {
      pollBudgetMs: number;
      sleep: (milliseconds: number) => Promise<void>;
    },
  ) {
    this.#relayUrl = relayUrl;
    this.#credential = credential;
    this.#pollBudgetMs = options.pollBudgetMs;
    this.#sleep = options.sleep;
  }

  async file(request: FileRetroDraftRequest): Promise<FilingReceipt> {
    const result = await this.#request('/v1/retro-filings', request, 'POST');
    return isFiledResult(result.receipt)
      ? result.receipt
      : this.#poll(result.receipt, result.retryAfterMs);
  }

  async #poll(initialReceipt: FilingReceipt, initialRetryAfterMs: number): Promise<FilingReceipt> {
    const deadline = Date.now() + this.#pollBudgetMs;
    let latestReceipt = initialReceipt;
    let retryAfterMs = initialRetryAfterMs;
    while (Date.now() + retryAfterMs <= deadline) {
      await this.#sleep(retryAfterMs);
      const result = await this.#request(
        `/v1/retro-filings/${encodeURIComponent(initialReceipt.receiptId)}`,
        undefined,
        'GET',
      );
      const receipt = result.receipt;
      latestReceipt = receipt;
      retryAfterMs = result.retryAfterMs;
      if (isFiledResult(receipt)) return receipt;
      if (receipt.state === 'ambiguous') {
        throw new RelayClientError(503, 'filing outcome is ambiguous', {
          receiptId: receipt.receiptId,
          state: receipt.state,
          latestReceipt: receipt,
        });
      }
    }
    throw new RelayClientError(202, 'filing remains in progress', {
      receiptId: latestReceipt.receiptId,
      latestReceipt,
    });
  }

  async #request(
    path: string,
    body: unknown,
    method: 'GET' | 'POST',
  ): Promise<{ receipt: FilingReceipt; retryAfterMs: number }> {
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
    return {
      receipt: result as unknown as FilingReceipt,
      retryAfterMs: retryAfterMilliseconds(response),
    };
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
    return this.reconcileReceipt(receiptId);
  }

  async reconcileReceipt(receiptId: string): Promise<FilingReceipt> {
    const result = await this.#request(
      `/v1/retro-filings/${encodeURIComponent(receiptId)}/reconcile`,
      undefined,
      'POST',
    );
    return result.receipt;
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
  options: {
    pollBudgetMs?: number;
    sleep?: (milliseconds: number) => Promise<void>;
  } = {},
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
  const adapterOptions = {
    pollBudgetMs: options.pollBudgetMs ?? 24 * 60 * 60 * 1000,
    sleep: options.sleep ?? delay,
  };
  return {
    claude: new FilingAdapter(relayUrl, credentials.claude, adapterOptions),
    codex: new FilingAdapter(relayUrl, credentials.codex, adapterOptions),
    cursor: new FilingAdapter(relayUrl, credentials.cursor, adapterOptions),
    operator: new FilingAdapter(relayUrl, credentials.operator, adapterOptions),
  };
}
