import {
  formatCanaryAuthorization,
  validateCanaryAuthorization,
  type CanaryAuthorization,
  type GitHubIssueComment,
} from "./terra-github-authorization";
import type {
  CanaryAttemptCompletionReceipt,
  CanaryAttemptStartReceipt,
  CanaryInitializationReceipt,
  CanaryUpstream,
  CanaryUpstreamSnapshot,
} from "./terra-development-canary";
import { canaryBindingDigest } from "./terra-development-canary";

const REGISTRATION_MARKER = "<!-- cwgyh0-corpus-registration-anchor:v1 -->";
const RECEIPT_MARKER = "SAFEWORD_TERRA_CANARY_RECEIPT_V1";
const PAGE_SIZE = 100;
const MAX_PAGES = 20;

export type GitHubHttp = (request: {
  body?: string;
  method: "GET" | "POST";
  url: string;
}) => Promise<{ body: string; status: number }>;

export function createAuthenticatedGitHubHttp(input: {
  fetch?: typeof globalThis.fetch;
  token: string;
}): GitHubHttp {
  if (input.token.length === 0 || input.token.trim() !== input.token) {
    throw new Error("GitHub token is invalid");
  }
  const transport = input.fetch ?? globalThis.fetch;
  return async (request) => {
    const url = new URL(request.url);
    if (url.origin !== "https://api.github.com") {
      throw new Error("GitHub request must target the canonical HTTPS API");
    }
    const response = await transport(request.url, {
      body: request.body,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: request.method,
    });
    return { body: await response.text(), status: response.status };
  };
}

type ReceiptEnvelope =
  | {
      bindingDigest: string;
      kind: "initialization";
      receipt: CanaryInitializationReceipt;
    }
  | {
      bindingDigest: string;
      kind: "attempt-start";
      receipt: CanaryAttemptStartReceipt;
    }
  | {
      bindingDigest: string;
      kind: "attempt-completion";
      receipt: CanaryAttemptCompletionReceipt;
    };

function repositoryUrl(repository: string): string {
  return `https://github.com/${repository}.git`;
}

export function formatCorpusRegistrationAnchor(
  authorization: CanaryAuthorization
): string {
  return `${REGISTRATION_MARKER}\n${JSON.stringify({
    blobPath:
      ".project/tickets/CWGYH0-pr-review-eval/corpus-registration-development-2026-08-11.json",
    commit: authorization.registrationCommit,
    digest: authorization.corpusDigest,
    digestPath:
      ".project/tickets/CWGYH0-pr-review-eval/corpus-registration-development-2026-08-11.sha256",
    repositoryIdentity: repositoryUrl(authorization.canonicalRepository),
  })}`;
}

function formatReceipt(envelope: ReceiptEnvelope): string {
  return `${RECEIPT_MARKER}\n${JSON.stringify(envelope)}`;
}

function parseComment(value: unknown): GitHubIssueComment | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const user = record.user;
  if (
    typeof record.author_association !== "string" ||
    typeof record.body !== "string" ||
    typeof record.created_at !== "string" ||
    !Number.isSafeInteger(record.id) ||
    typeof record.updated_at !== "string" ||
    typeof user !== "object" ||
    user === null ||
    Array.isArray(user) ||
    typeof (user as Record<string, unknown>).login !== "string"
  ) {
    return null;
  }
  return record as GitHubIssueComment;
}

function trustedComment(
  comment: GitHubIssueComment,
  allowlistedMaintainers: readonly string[]
): boolean {
  return (
    comment.created_at === comment.updated_at &&
    comment.user !== null &&
    allowlistedMaintainers.includes(comment.user.login) &&
    (comment.author_association === "MEMBER" ||
      comment.author_association === "OWNER")
  );
}

function parseReceipt(
  comment: GitHubIssueComment,
  allowlistedMaintainers: readonly string[]
): ReceiptEnvelope | null | "invalid" {
  if (!comment.body.startsWith(`${RECEIPT_MARKER}\n`)) {
    return null;
  }
  if (!trustedComment(comment, allowlistedMaintainers)) {
    return "invalid";
  }
  try {
    const envelope = JSON.parse(
      comment.body.slice(RECEIPT_MARKER.length + 1)
    ) as ReceiptEnvelope;
    return comment.body === formatReceipt(envelope) ? envelope : "invalid";
  } catch {
    return "invalid";
  }
}

async function listComments(input: {
  http: GitHubHttp;
  issueNumber: number;
  repository: string;
}): Promise<GitHubIssueComment[]> {
  const comments: GitHubIssueComment[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await input.http({
      method: "GET",
      url: `https://api.github.com/repos/${input.repository}/issues/${input.issueNumber}/comments?per_page=${PAGE_SIZE}&page=${page}`,
    });
    if (response.status !== 200) {
      throw new Error(`GitHub comments returned HTTP ${response.status}`);
    }
    let values: unknown;
    try {
      values = JSON.parse(response.body);
    } catch {
      throw new Error("GitHub comments returned invalid JSON");
    }
    if (!Array.isArray(values)) {
      throw new Error("GitHub comments response must be an array");
    }
    const pageComments = values.map(parseComment);
    if (pageComments.some((comment) => comment === null)) {
      throw new Error("GitHub comments response contains an invalid comment");
    }
    comments.push(...(pageComments as GitHubIssueComment[]));
    if (values.length < PAGE_SIZE) {
      return comments;
    }
  }
  throw new Error("GitHub comments exceeded the pagination limit");
}

function receiptSnapshot(input: {
  allowlistedMaintainers: readonly string[];
  authorization: CanaryAuthorization;
  bindingDigest: string;
  comments: readonly GitHubIssueComment[];
}): CanaryUpstreamSnapshot {
  const registration = input.comments.filter(
    (comment) => comment.id === input.authorization.registrationCommentId
  );
  if (
    registration.length !== 1 ||
    !trustedComment(registration[0]!, input.allowlistedMaintainers) ||
    registration[0]!.body !== formatCorpusRegistrationAnchor(input.authorization)
  ) {
    return { kind: "unreadable" };
  }
  try {
    validateCanaryAuthorization({
      allowlistedMaintainers: input.allowlistedMaintainers,
      comments: input.comments,
      expected: input.authorization,
    });
  } catch {
    return { kind: "unreadable" };
  }

  const parsed = input.comments.map((comment) =>
    parseReceipt(comment, input.allowlistedMaintainers)
  );
  if (parsed.includes("invalid")) {
    return { kind: "unreadable" };
  }
  const receipts = parsed.filter(
    (receipt): receipt is ReceiptEnvelope => receipt !== null
  );
  if (receipts.some((receipt) => receipt.bindingDigest !== input.bindingDigest)) {
    return { kind: "unreadable" };
  }
  const initializations = receipts.filter(
    (receipt) => receipt.kind === "initialization"
  );
  if (initializations.length === 0) {
    return { authorizationId: input.authorization.authorizationId, kind: "ready" };
  }
  if (initializations.length !== 1) {
    return { kind: "unreadable" };
  }
  const starts = receipts
    .filter((receipt) => receipt.kind === "attempt-start")
    .map((receipt) => receipt.receipt)
    .sort((left, right) => left.sequence - right.sequence);
  const completions = receipts
    .filter((receipt) => receipt.kind === "attempt-completion")
    .map((receipt) => receipt.receipt)
    .sort((left, right) => left.sequence - right.sequence);
  return {
    completions,
    head: {
      observedCostPicodollars:
        completions.at(-1)?.observedCostPicodollars ?? "0",
      startedAttempts: starts.length,
    },
    kind: "consumed",
    receipt: initializations[0]!.receipt,
    starts,
  };
}

export function createGitHubCanaryUpstream(input: {
  allowlistedMaintainers: readonly string[];
  authorization: CanaryAuthorization;
  http: GitHubHttp;
  issueNumber: number;
  nextReceiptId(): string;
}): CanaryUpstream {
  const repository = input.authorization.canonicalRepository;
  const authorizedBindingDigest = canaryBindingDigest({
    adapterCommit: input.authorization.adapterCommit,
    adapterTag: input.authorization.adapterTag,
    attemptLimit: input.authorization.attemptLimit,
    canonicalRepository: input.authorization.canonicalRepository,
    corpusDigest: input.authorization.corpusDigest,
    costLimitPicodollars: input.authorization.costLimitPicodollars,
    harnessCommit: input.authorization.harnessCommit,
    harnessTag: input.authorization.harnessTag,
    model: input.authorization.model,
    outputIdentity: input.authorization.outputIdentity,
    receiptBudget: input.authorization.receiptBudget,
    serviceTier: input.authorization.serviceTier,
    ticketId: input.authorization.ticketId,
  });
  const requireAuthorizedBinding = (bindingDigest: string): void => {
    if (bindingDigest !== authorizedBindingDigest) {
      throw new Error("canary binding does not match its authorization");
    }
  };
  const inspect = async (
    bindingDigest: string
  ): Promise<CanaryUpstreamSnapshot> => {
    if (bindingDigest !== authorizedBindingDigest) {
      return { kind: "unreadable" };
    }
    try {
      const comments = await listComments({ ...input, repository });
      return receiptSnapshot({ ...input, bindingDigest, comments });
    } catch {
      return { kind: "unavailable" };
    }
  };

  const post = async (envelope: ReceiptEnvelope): Promise<void> => {
    const response = await input.http({
      body: JSON.stringify({ body: formatReceipt(envelope) }),
      method: "POST",
      url: `https://api.github.com/repos/${repository}/issues/${input.issueNumber}/comments`,
    });
    if (response.status !== 201) {
      throw new Error(`GitHub receipt write returned HTTP ${response.status}`);
    }
  };

  return {
    consumeInitialization: async ({ authorizationId, bindingDigest }) => {
      requireAuthorizedBinding(bindingDigest);
      if (authorizationId !== input.authorization.authorizationId) {
        throw new Error("canary authorization identity does not match");
      }
      const receipt: CanaryInitializationReceipt = {
        authorizationId,
        bindingDigest,
        observedCostPicodollars: "0",
        receiptId: input.nextReceiptId(),
        startedAttempts: 0,
      };
      await post({ bindingDigest, kind: "initialization", receipt });
      const visible = await inspect(bindingDigest);
      if (
        visible.kind !== "consumed" ||
        JSON.stringify(visible.receipt) !== JSON.stringify(receipt)
      ) {
        throw new Error("GitHub initialization receipt is not durably visible");
      }
      return receipt;
    },
    inspect,
    postAttemptCompletion: async ({ bindingDigest, ...fields }) => {
      requireAuthorizedBinding(bindingDigest);
      const receipt: CanaryAttemptCompletionReceipt = {
        ...fields,
        receiptId: input.nextReceiptId(),
      };
      await post({ bindingDigest, kind: "attempt-completion", receipt });
      return receipt;
    },
    postAttemptStart: async ({ bindingDigest, ...fields }) => {
      requireAuthorizedBinding(bindingDigest);
      const receipt: CanaryAttemptStartReceipt = {
        ...fields,
        receiptId: input.nextReceiptId(),
        startedAttempts: fields.sequence,
      };
      await post({ bindingDigest, kind: "attempt-start", receipt });
      return receipt;
    },
  };
}
