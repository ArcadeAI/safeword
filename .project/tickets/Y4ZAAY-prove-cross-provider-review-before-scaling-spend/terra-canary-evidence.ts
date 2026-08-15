import { createHash } from "node:crypto";

const TERRA_MODEL = "gpt-5.6-terra";
const STANDARD_TIER = "default";
const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
const LONG_CONTEXT_START = 272_001;

const SHORT_RATES = {
  cacheWrite: 3_125_000n,
  cached: 250_000n,
  output: 15_000_000n,
  uncached: 2_500_000n,
};

const LONG_RATES = {
  cacheWrite: 6_250_000n,
  cached: 500_000n,
  output: 22_500_000n,
  uncached: 5_000_000n,
};

type JsonObject = Record<string, unknown>;
type ProviderStage = "finding-verification" | "repository-reading";

type AttemptIntent = {
  attemptId: string;
  intentId: string;
  sequence: number;
};

type ProviderRequest = {
  endpoint: string;
  intentId: string;
  model: string;
  sequence: number;
  serviceTier: string;
  stage: ProviderStage;
  turnIntentId: string;
};

type ProviderResponse = {
  errorMessage: null;
  errorName: null;
  httpStatus: number;
  intentId: string;
  nativeUsage: JsonObject;
  outcome: "response";
  rawBody: string;
  requestId: string;
  responseId: string;
  returnedModel: string;
  returnedServiceTier: string;
  sequence: number;
  stage: ProviderStage;
  turnIntentId: string;
};

export type NormalizedTerraUsage = {
  cacheWriteTokens: number;
  cachedTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  uncachedTokens: number;
};

export type ValidatedTerraEnvelope = {
  costPicodollars: bigint;
  model: typeof TERRA_MODEL;
  raw: JsonObject;
  rawUsage: JsonObject & { input_tokens_details: JsonObject };
  responseId: string;
  serviceTier: typeof STANDARD_TIER;
  usage: NormalizedTerraUsage;
};

export type ValidatedProviderInventory = {
  attemptId: string;
  intentId: string;
  routeValid: boolean;
  totalCostPicodollars: bigint;
  turns: Array<
    ValidatedTerraEnvelope & {
      requestId: string;
      stage: ProviderStage;
    }
  >;
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireExactKeys(
  value: JsonObject,
  keys: readonly string[],
  label: string
): void {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  if (
    expected.length !== actual.length ||
    expected.some((key, index) => key !== actual[index])
  ) {
    throw new Error(`${label} has unexpected or missing fields`);
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireCount(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value as number;
}

function requireSequence(value: unknown, label: string): number {
  const sequence = requireCount(value, label);
  if (sequence === 0) {
    throw new Error(`${label} must be positive`);
  }
  return sequence;
}

function parseJsonObject(raw: string, label: string): JsonObject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not complete JSON: ${detail}`);
  }
  return requireObject(parsed, label);
}

function optionalCount(
  object: JsonObject,
  key: string,
  label: string
): number {
  return object[key] === undefined ? 0 : requireCount(object[key], label);
}

export function validateTerraEnvelope(rawBody: string): ValidatedTerraEnvelope {
  const raw = parseJsonObject(rawBody, "OpenAI response envelope");
  const responseId = requireString(raw.id, "response id");
  if (raw.model !== TERRA_MODEL) {
    throw new Error(`response model must be ${TERRA_MODEL}`);
  }
  if (raw.service_tier !== STANDARD_TIER) {
    throw new Error(`response service tier must be ${STANDARD_TIER}`);
  }
  if (raw.status !== "completed") {
    throw new Error("response status must be completed");
  }
  if (!Array.isArray(raw.output)) {
    throw new Error("response output must be an array");
  }

  const rawUsage = requireObject(raw.usage, "native usage");
  const inputTokens = requireCount(rawUsage.input_tokens, "input_tokens");
  const outputTokens = requireCount(rawUsage.output_tokens, "output_tokens");
  const inputDetails = requireObject(
    rawUsage.input_tokens_details,
    "input_tokens_details"
  );
  const foreignUsageFields = new Set([
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
  ]);
  for (const key of [
    ...Object.keys(rawUsage),
    ...Object.keys(inputDetails),
  ]) {
    if (foreignUsageFields.has(key)) {
      throw new Error(`native usage contains foreign provider field ${key}`);
    }
  }
  const cachedTokens = requireCount(
    inputDetails.cached_tokens,
    "cached_tokens"
  );
  const cacheWriteTokens = optionalCount(
    inputDetails,
    "cache_write_tokens",
    "cache_write_tokens"
  );
  if (cachedTokens + cacheWriteTokens > inputTokens) {
    throw new Error(
      "cached_tokens plus cache_write_tokens cannot exceed input_tokens"
    );
  }

  const outputDetails =
    rawUsage.output_tokens_details === undefined
      ? {}
      : requireObject(rawUsage.output_tokens_details, "output_tokens_details");
  const reasoningTokens = optionalCount(
    outputDetails,
    "reasoning_tokens",
    "reasoning_tokens"
  );
  if (reasoningTokens > outputTokens) {
    throw new Error("reasoning_tokens cannot exceed output_tokens");
  }

  const uncachedTokens = inputTokens - cachedTokens - cacheWriteTokens;
  const rates = inputTokens >= LONG_CONTEXT_START ? LONG_RATES : SHORT_RATES;
  const costPicodollars =
    BigInt(uncachedTokens) * rates.uncached +
    BigInt(cachedTokens) * rates.cached +
    BigInt(cacheWriteTokens) * rates.cacheWrite +
    BigInt(outputTokens) * rates.output;

  return {
    costPicodollars,
    model: TERRA_MODEL,
    raw,
    rawUsage: rawUsage as JsonObject & { input_tokens_details: JsonObject },
    responseId,
    serviceTier: STANDARD_TIER,
    usage: {
      cacheWriteTokens,
      cachedTokens,
      inputTokens,
      outputTokens,
      reasoningTokens,
      uncachedTokens,
    },
  };
}

function parseIntent(value: unknown): AttemptIntent {
  const object = requireObject(value, "attempt intent");
  requireExactKeys(object, ["attemptId", "intentId", "sequence"], "attempt intent");
  return {
    attemptId: requireString(object.attemptId, "attemptId"),
    intentId: requireString(object.intentId, "intentId"),
    sequence: requireSequence(object.sequence, "intent sequence"),
  };
}

function parseRequest(value: unknown, index: number): ProviderRequest {
  const label = `provider request ${index + 1}`;
  const object = requireObject(value, label);
  requireExactKeys(
    object,
    [
      "endpoint",
      "intentId",
      "model",
      "sequence",
      "serviceTier",
      "stage",
      "turnIntentId",
    ],
    label
  );
  if (
    object.stage !== "repository-reading" &&
    object.stage !== "finding-verification"
  ) {
    throw new Error(`${label} has an invalid stage`);
  }
  return {
    endpoint: requireString(object.endpoint, `${label} endpoint`),
    intentId: requireString(object.intentId, `${label} intentId`),
    model: requireString(object.model, `${label} model`),
    sequence: requireSequence(object.sequence, `${label} sequence`),
    serviceTier: requireString(object.serviceTier, `${label} serviceTier`),
    stage: object.stage,
    turnIntentId: requireString(
      object.turnIntentId,
      `${label} turnIntentId`
    ),
  };
}

function parseResponse(value: unknown, index: number): ProviderResponse {
  const label = `provider response ${index + 1}`;
  const object = requireObject(value, label);
  requireExactKeys(
    object,
    [
      "errorMessage",
      "errorName",
      "httpStatus",
      "intentId",
      "nativeUsage",
      "outcome",
      "rawBody",
      "requestId",
      "responseId",
      "returnedModel",
      "returnedServiceTier",
      "sequence",
      "stage",
      "turnIntentId",
    ],
    label
  );
  if (
    object.errorMessage !== null ||
    object.errorName !== null ||
    object.outcome !== "response" ||
    !Number.isInteger(object.httpStatus) ||
    (object.httpStatus as number) < 200 ||
    (object.httpStatus as number) > 299
  ) {
    throw new Error(`${label} is not a successful physical response`);
  }
  if (
    object.stage !== "repository-reading" &&
    object.stage !== "finding-verification"
  ) {
    throw new Error(`${label} has an invalid stage`);
  }
  return {
    errorMessage: null,
    errorName: null,
    httpStatus: object.httpStatus as number,
    intentId: requireString(object.intentId, `${label} intentId`),
    nativeUsage: requireObject(object.nativeUsage, `${label} nativeUsage`),
    outcome: "response",
    rawBody: requireString(object.rawBody, `${label} rawBody`),
    requestId: requireString(object.requestId, `${label} requestId`),
    responseId: requireString(object.responseId, `${label} responseId`),
    returnedModel: requireString(object.returnedModel, `${label} returnedModel`),
    returnedServiceTier: requireString(
      object.returnedServiceTier,
      `${label} returnedServiceTier`
    ),
    sequence: requireSequence(object.sequence, `${label} sequence`),
    stage: object.stage,
    turnIntentId: requireString(
      object.turnIntentId,
      `${label} turnIntentId`
    ),
  };
}

function canonicalJson(value: unknown): string {
  const canonicalize = (item: unknown): unknown => {
    if (Array.isArray(item)) {
      return item.map(canonicalize);
    }
    if (isObject(item)) {
      return Object.fromEntries(
        Object.entries(item)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)])
      );
    }
    return item;
  };
  return JSON.stringify(canonicalize(value));
}

function analyzeProviderInventory(value: unknown): ValidatedProviderInventory {
  const object = requireObject(value, "provider inventory");
  requireExactKeys(object, ["intent", "requests", "responses"], "provider inventory");
  const intent = parseIntent(object.intent);
  if (!Array.isArray(object.requests) || !Array.isArray(object.responses)) {
    throw new Error("provider inventory requests and responses must be arrays");
  }
  if (object.requests.length === 0) {
    throw new Error("provider inventory must retain at least one paid turn");
  }
  const requests = object.requests.map(parseRequest);
  const responses = object.responses.map(parseResponse);
  const requestsByTurnIntent = new Map<string, ProviderRequest>();
  const turnIntentIds = new Set<string>();
  const sequences = new Set<number>([intent.sequence]);
  let routeValid = true;
  for (const request of requests) {
    if (request.intentId !== intent.intentId) {
      throw new Error(
        `provider turn intent ${request.turnIntentId} references a foreign attempt intent`
      );
    }
    if (request.sequence <= intent.sequence) {
      throw new Error(
        `provider turn intent ${request.turnIntentId} does not follow its attempt intent`
      );
    }
    if (sequences.has(request.sequence)) {
      throw new Error(`duplicate journal sequence ${request.sequence}`);
    }
    sequences.add(request.sequence);
    if (turnIntentIds.has(request.turnIntentId)) {
      throw new Error(`duplicate turn intent ${request.turnIntentId}`);
    }
    turnIntentIds.add(request.turnIntentId);
    if (
      request.endpoint !== RESPONSES_ENDPOINT ||
      request.model !== TERRA_MODEL ||
      request.serviceTier !== STANDARD_TIER
    ) {
      routeValid = false;
    }
    requestsByTurnIntent.set(request.turnIntentId, request);
  }

  const responsesByTurnIntent = new Map<string, ProviderResponse>();
  const providerRequestIds = new Set<string>();
  const responseIds = new Set<string>();
  const turns: ValidatedProviderInventory["turns"] = [];
  for (const response of responses) {
    if (responsesByTurnIntent.has(response.turnIntentId)) {
      throw new Error(`duplicate provider response for ${response.turnIntentId}`);
    }
    const request = requestsByTurnIntent.get(response.turnIntentId);
    if (request === undefined) {
      throw new Error(
        `provider response ${response.requestId} has no durable turn intent`
      );
    }
    if (response.intentId !== intent.intentId) {
      throw new Error(`provider response ${response.requestId} references a foreign intent`);
    }
    if (response.sequence <= request.sequence) {
      throw new Error(`provider response ${response.requestId} does not follow its request`);
    }
    if (providerRequestIds.has(response.requestId)) {
      throw new Error(`duplicate provider request ID ${response.requestId}`);
    }
    providerRequestIds.add(response.requestId);
    if (sequences.has(response.sequence)) {
      throw new Error(`duplicate journal sequence ${response.sequence}`);
    }
    sequences.add(response.sequence);
    const envelope = validateTerraEnvelope(response.rawBody);
    if (
      response.responseId !== envelope.responseId ||
      response.returnedModel !== envelope.model ||
      response.returnedServiceTier !== envelope.serviceTier ||
      response.stage !== request.stage ||
      canonicalJson(response.nativeUsage) !== canonicalJson(envelope.rawUsage)
    ) {
      throw new Error(
        `provider response ${response.requestId} contradicts its native envelope`
      );
    }
    if (responseIds.has(envelope.responseId)) {
      throw new Error(`duplicate native response ${envelope.responseId}`);
    }
    responseIds.add(envelope.responseId);
    responsesByTurnIntent.set(response.turnIntentId, response);
    turns.push({
      ...envelope,
      requestId: response.requestId,
      stage: request.stage,
    });
  }
  for (const request of requests) {
    if (!responsesByTurnIntent.has(request.turnIntentId)) {
      throw new Error(
        `provider turn intent ${request.turnIntentId} has no retained response`
      );
    }
  }
  return {
    attemptId: intent.attemptId,
    intentId: intent.intentId,
    routeValid,
    totalCostPicodollars: turns.reduce(
      (total, turn) => total + turn.costPicodollars,
      0n
    ),
    turns,
  };
}

export function priceProviderInventory(
  value: unknown
): ValidatedProviderInventory {
  return analyzeProviderInventory(value);
}

export function validateProviderInventory(
  value: unknown
): ValidatedProviderInventory {
  const inventory = analyzeProviderInventory(value);
  const stages = new Set(inventory.turns.map(({ stage }) => stage));
  if (!stages.has("repository-reading") || !stages.has("finding-verification")) {
    throw new Error("provider inventory must retain both review stages");
  }
  if (!inventory.routeValid) {
    throw new Error("provider inventory used the wrong route");
  }
  return inventory;
}

export function retainDiagnosticManifest(input: {
  corpusBytes: string;
  inventory: unknown;
  registration: unknown;
}): {
  corpus_author_provenance: string;
  corpusDigest: string;
  diagnosticOnly: true;
  evidenceRole: "development";
  /** Decimal integer text keeps the durable JSON exact and serializable. */
  observedCostPicodollars: string;
  providerTurnCount: number;
} {
  const registration = requireObject(input.registration, "corpus registration");
  requireExactKeys(
    registration,
    ["corpusAuthorProvenance", "corpusDigest", "evidenceRole"],
    "corpus registration"
  );
  const corpusDigest = requireString(
    registration.corpusDigest,
    "registration corpusDigest"
  );
  const provenance = requireString(
    registration.corpusAuthorProvenance,
    "registration corpusAuthorProvenance"
  );
  if (registration.evidenceRole !== "development") {
    throw new Error("corpus registration evidenceRole must be development");
  }
  const actualDigest = createHash("sha256")
    .update(input.corpusBytes)
    .digest("hex");
  if (actualDigest !== corpusDigest) {
    throw new Error("corpus digest does not match trusted registration");
  }
  const inventory = validateProviderInventory(input.inventory);
  return {
    corpus_author_provenance: provenance,
    corpusDigest: actualDigest,
    diagnosticOnly: true,
    evidenceRole: "development",
    observedCostPicodollars: inventory.totalCostPicodollars.toString(),
    providerTurnCount: inventory.turns.length,
  };
}
