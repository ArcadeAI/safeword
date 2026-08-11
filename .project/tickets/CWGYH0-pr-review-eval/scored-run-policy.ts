const RETRYABLE_HTTP_STATUSES = new Set([408, 429]);
const RETRYABLE_NETWORK_CODES = new Set([
	"EAI_AGAIN",
	"ECONNRESET",
	"ENETDOWN",
	"ENETUNREACH",
	"ENOTFOUND",
	"ETIMEDOUT",
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_SOCKET",
]);

type ErrorLike = {
	cause?: unknown;
	code?: unknown;
	message?: unknown;
	name?: unknown;
	status?: unknown;
};

type UnknownRecord = Record<string, unknown>;

export type TrialInvalidReason =
	| "incomplete-provider-output"
	| "provider-failure"
	| "provenance-incomplete"
	| "provenance-mismatch"
	| "reviewer-failed"
	| "routing-invalid"
	| "schema-invalid"
	| "unexpected-finish"
	| "unknown-state";

export type TrialProvenance = {
	caseId: string;
	reviewBaseSha: string;
	runnerRef: string;
	sourceSha: string;
	variant: string;
};

export type TrialRoute = {
	expert: string;
	model: string;
	provider: string;
};

export type TrialDisposition =
	| { reason: "completed"; retry: "never"; status: "usable" }
	| {
		reason: TrialInvalidReason;
		retry: "infrastructure-once" | "never";
		status: "invalid";
	};

export type TrialAttempt<T> =
	| {
		attempt: 1 | 2;
		disposition: TrialDisposition;
		error: null;
		output: T;
	  }
	| {
		attempt: 1 | 2;
		disposition: TrialDisposition | null;
		error: string;
		output: null;
	  };

export type RetriedResult<T> =
	| {
			attempts: 1 | 2;
			attemptRecords: TrialAttempt<T>[];
			infrastructureErrors: string[];
			status: "completed";
			value: T;
	  }
	| {
		attempts: 1 | 2;
		attemptRecords: TrialAttempt<T>[];
		disposition?: TrialDisposition;
		infrastructureErrors: string[];
		status: "exclude-case";
	  };

function isErrorLike(value: unknown): value is ErrorLike {
	return typeof value === "object" && value !== null;
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasUsage(value: unknown): boolean {
	if (!isRecord(value)) return false;
	const inputTokens = value.inputTokens;
	const outputTokens = value.outputTokens;
	return (
		typeof inputTokens === "number" &&
		Number.isFinite(inputTokens) &&
		inputTokens >= 0 &&
		typeof outputTokens === "number" &&
		Number.isFinite(outputTokens) &&
		outputTokens >= 0 &&
		inputTokens + outputTokens > 0
	);
}

function isScoredFinding(value: unknown): boolean {
	return (
		isRecord(value) &&
		typeof value.file === "string" &&
		value.file.length > 0 &&
		typeof value.line === "number" &&
		Number.isInteger(value.line) &&
		value.line > 0 &&
		typeof value.title === "string" &&
		value.title.length > 0
	);
}

function findingIdentity(value: UnknownRecord): string {
	return `${value.file as string}\u0000${value.line as number}\u0000${value.title as string}`;
}

function retryForFailure(failure: unknown): "infrastructure-once" | "never" {
	if (!isRecord(failure) || typeof failure.kind !== "string") return "never";
	if (
		failure.kind === "provider-request" &&
		typeof failure.status === "number" &&
		(RETRYABLE_HTTP_STATUSES.has(failure.status) ||
			(failure.status >= 500 && failure.status <= 599))
	) {
		return "infrastructure-once";
	}
	if (
		failure.kind === "network" &&
		typeof failure.code === "string" &&
		RETRYABLE_NETWORK_CODES.has(failure.code)
	) {
		return "infrastructure-once";
	}
	return "never";
}

function matchesProvenance(
	actual: UnknownRecord,
	expected: TrialProvenance,
): boolean {
	return Object.entries(expected).every(([key, value]) => actual[key] === value);
}

/**
 * A record is usable only when the runner positively proves reviewer
 * completion. Unknown or legacy shapes fail closed instead of becoming
 * artificial silence.
 */
export function classifyTrialOutput(
	value: unknown,
	expectedRoute: TrialRoute,
	expectedProvenance: TrialProvenance,
): TrialDisposition {
	if (value === undefined || value === null || value === "") {
		return {
			reason: "incomplete-provider-output",
			retry: "never",
			status: "invalid",
		};
	}
	if (typeof value === "string") {
		return {
			reason: "incomplete-provider-output",
			retry: "never",
			status: "invalid",
		};
	}
	if (!isRecord(value) || !isRecord(value.report)) {
		return { reason: "schema-invalid", retry: "never", status: "invalid" };
	}

	const report = value.report;
	if (
		!Array.isArray(value.models) ||
		!Array.isArray(report.expertOutcomes) ||
		!isRecord(report.consolidated) ||
		!Array.isArray(report.consolidated.findings)
	) {
		return { reason: "schema-invalid", retry: "never", status: "invalid" };
	}
	if (!isRecord(value.provenance)) {
		return {
			reason: "provenance-incomplete",
			retry: "never",
			status: "invalid",
		};
	}
	if (value.models.length !== 1 || report.expertOutcomes.length !== 1) {
		return { reason: "routing-invalid", retry: "never", status: "invalid" };
	}
	if (!matchesProvenance(value.provenance, expectedProvenance)) {
		return {
			reason: "provenance-mismatch",
			retry: "never",
			status: "invalid",
		};
	}
	const routedModels = value.models.filter(
		(model) =>
			isRecord(model) &&
			model.expert === expectedRoute.expert &&
			model.model === expectedRoute.model &&
			model.provider === expectedRoute.provider,
	);
	const routedOutcomes = report.expertOutcomes.filter(
		(outcome) =>
			isRecord(outcome) &&
			outcome.expert === expectedRoute.expert &&
			outcome.model === expectedRoute.model &&
			outcome.provider === expectedRoute.provider,
	);
	if (routedModels.length !== 1 || routedOutcomes.length !== 1) {
		return { reason: "routing-invalid", retry: "never", status: "invalid" };
	}

	const outcome = routedOutcomes[0];
	if (!isRecord(outcome)) {
		return { reason: "routing-invalid", retry: "never", status: "invalid" };
	}
	if (!Array.isArray(outcome.findings)) {
		return { reason: "schema-invalid", retry: "never", status: "invalid" };
	}
	if (outcome.cappedBy !== null) {
		return {
			reason: "unexpected-finish",
			retry: "never",
			status: "invalid",
		};
	}
	if (outcome.error !== null) {
		if (!isRecord(outcome.failure) || typeof outcome.failure.kind !== "string") {
			return { reason: "reviewer-failed", retry: "never", status: "invalid" };
		}
		if (
			outcome.failure.kind === "provider-request" ||
			outcome.failure.kind === "network" ||
			(outcome.failure.kind === "schema-violation" &&
				outcome.failure.source === "provider-response")
		) {
			return {
				reason: "provider-failure",
				retry: retryForFailure(outcome.failure),
				status: "invalid",
			};
		}
		if (outcome.failure.kind === "report-schema") {
			return { reason: "schema-invalid", retry: "never", status: "invalid" };
		}
		if (outcome.failure.kind === "review") {
			return { reason: "reviewer-failed", retry: "never", status: "invalid" };
		}
		return { reason: "unknown-state", retry: "never", status: "invalid" };
	}
	if (outcome.failure !== null) {
		return { reason: "unknown-state", retry: "never", status: "invalid" };
	}
	if (value.terminalState !== "completed") {
		return {
			reason: "unexpected-finish",
			retry: "never",
			status: "invalid",
		};
	}
	if (!Array.isArray(value.trace) || value.trace.length === 0) {
		return {
			reason: "provenance-incomplete",
			retry: "never",
			status: "invalid",
		};
	}
	if (
		typeof outcome.turns !== "number" ||
		!Number.isInteger(outcome.turns) ||
		outcome.turns < 1 ||
		!hasUsage(outcome.usage)
	) {
		return {
			reason: "reviewer-failed",
			retry: retryForFailure(outcome.failure),
			status: "invalid",
		};
	}
	if (!hasUsage(report.usage)) {
		return {
			reason: "provenance-incomplete",
			retry: "never",
			status: "invalid",
		};
	}
	if (!isRecord(value.score)) {
		return { reason: "schema-invalid", retry: "never", status: "invalid" };
	}
	if (value.score.reviewValid !== true) {
		return {
			reason: typeof value.score.reviewValid === "boolean"
				? "reviewer-failed"
				: "schema-invalid",
			retry: "never",
			status: "invalid",
		};
	}
	if (
		typeof value.score.namedFailure !== "boolean" ||
		!Array.isArray(value.score.matchingFindings) ||
		!value.score.matchingFindings.every(isScoredFinding) ||
		!report.consolidated.findings.every(isScoredFinding) ||
		!outcome.findings.every(isScoredFinding)
	) {
		return { reason: "schema-invalid", retry: "never", status: "invalid" };
	}
	const outcomeFindingKeys = new Set(
		outcome.findings.map((finding) => findingIdentity(finding as UnknownRecord)),
	);
	const matchingFindingKeys = value.score.matchingFindings.map((finding) =>
		findingIdentity(finding as UnknownRecord),
	);
	const consolidatedFindingKeys = report.consolidated.findings.map((finding) =>
		findingIdentity(finding as UnknownRecord),
	);
	if (
		value.score.namedFailure !== (matchingFindingKeys.length > 0) ||
		matchingFindingKeys.some((key) => !outcomeFindingKeys.has(key)) ||
		consolidatedFindingKeys.some((key) => !outcomeFindingKeys.has(key))
	) {
		return { reason: "schema-invalid", retry: "never", status: "invalid" };
	}
	return { reason: "completed", retry: "never", status: "usable" };
}

function errorSummary(error: unknown): string {
	return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function thrownDisposition(error: unknown): TrialDisposition | null {
	if (!isErrorLike(error) || typeof error.name !== "string") return null;
	if (error.name === "SchemaViolationError") {
		return { reason: "schema-invalid", retry: "never", status: "invalid" };
	}
	if (error.name === "ProviderRequestError" && typeof error.status === "number") {
		return { reason: "provider-failure", retry: "never", status: "invalid" };
	}
	return null;
}

/**
 * The benchmark retries only failures external to reviewer judgment. Provider
 * shape failures, parser failures, budget exhaustion, and ordinary 4xx errors
 * are scored as-is and never get a second chance.
 */
export function isInfrastructureError(error: unknown): boolean {
	if (isErrorLike(error) && error.name === "SchemaViolationError") return false;

	let current: unknown = error;
	for (let depth = 0; depth < 8 && isErrorLike(current); depth += 1) {
		if (current.name === "ProviderRequestError" && typeof current.status === "number") {
			return (
				RETRYABLE_HTTP_STATUSES.has(current.status) ||
				(current.status >= 500 && current.status <= 599)
			);
		}
		if (
			typeof current.code === "string" &&
			RETRYABLE_NETWORK_CODES.has(current.code)
		) {
			return true;
		}
		current = current.cause;
	}
	return false;
}

export async function executeWithInfrastructureRetry<T>(
	execute: () => Promise<T>,
	classify?: (value: T) => TrialDisposition,
): Promise<RetriedResult<T>> {
	const infrastructureErrors: string[] = [];
	const attemptRecords: TrialAttempt<T>[] = [];
	for (const attempts of [1, 2] as const) {
		try {
			const value = await execute();
			const disposition = classify?.(value) ?? {
				reason: "completed",
				retry: "never",
				status: "usable",
			} as const;
			attemptRecords.push({
				attempt: attempts,
				disposition,
				error: null,
				output: value,
			});
			if (disposition.status === "invalid") {
				if (disposition.retry === "infrastructure-once") {
					const report = isRecord(value) && isRecord(value.report) ? value.report : null;
					const outcomes = report !== null && Array.isArray(report.expertOutcomes)
						? report.expertOutcomes
						: [];
					const failed = outcomes.find((outcome) => isRecord(outcome) && outcome.error !== null);
					const summary = isRecord(failed) && typeof failed.error === "string"
						? failed.error
						: disposition.reason;
					infrastructureErrors.push(summary);
					if (attempts === 1) continue;
				}
				return {
					attempts,
					attemptRecords,
					disposition,
					infrastructureErrors,
					status: "exclude-case",
				};
			}
			return {
				attempts,
				attemptRecords,
				infrastructureErrors,
				status: "completed",
				value,
			};
		} catch (error) {
			const summary = errorSummary(error);
			if (!isInfrastructureError(error)) {
				const disposition = thrownDisposition(error);
				if (disposition === null) throw error;
				attemptRecords.push({
					attempt: attempts,
					disposition,
					error: summary,
					output: null,
				});
				return {
					attempts,
					attemptRecords,
					disposition,
					infrastructureErrors,
					status: "exclude-case",
				};
			}
			infrastructureErrors.push(summary);
			attemptRecords.push({
				attempt: attempts,
				disposition: null,
				error: summary,
				output: null,
			});
			if (attempts === 2) {
				return {
					attempts,
					attemptRecords,
					infrastructureErrors,
					status: "exclude-case",
				};
			}
		}
	}
	throw new Error("unreachable retry state");
}

function frozenRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
		return state / 0x1_0000_0000;
	};
}

export function shuffleFrozen<T>(values: readonly T[], seed: number): T[] {
	const next = frozenRandom(seed);
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(next() * (index + 1));
		const current = result[index];
		const replacement = result[swap];
		if (current === undefined || replacement === undefined) {
			throw new Error("shuffle selected an impossible array index");
		}
		result[index] = replacement;
		result[swap] = current;
	}
	return result;
}

export function parseCumulativeCaseTarget(
	value: string | undefined,
	totalCases: number,
): number {
	if (value === undefined || value.length === 0) return totalCases;
	const target = Number(value);
	if (!Number.isInteger(target) || target < 1 || target > totalCases) {
		throw new Error(
			`CWGYH0_CASE_TARGET must be an integer from 1 through ${totalCases}`,
		);
	}
	return target;
}

export function parseCumulativeCostTarget(
	value: string | undefined,
	aggregateCeilingUsd: number,
): number {
	if (value === undefined || value.length === 0) return aggregateCeilingUsd;
	const target = Number(value);
	if (!Number.isFinite(target) || target <= 0 || target > aggregateCeilingUsd) {
		throw new Error(
			`CWGYH0_COST_TARGET_USD must be greater than zero and at most ${aggregateCeilingUsd}`,
		);
	}
	return target;
}
