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

function usageOf(value: unknown): { inputTokens: number; outputTokens: number } | null {
	if (!hasUsage(value)) return null;
	return {
		inputTokens: value.inputTokens as number,
		outputTokens: value.outputTokens as number,
	};
}

function isToolCall(value: unknown): boolean {
	return (
		isRecord(value) &&
		isRecord(value.args) &&
		typeof value.name === "string" &&
		value.name.length > 0 &&
		typeof value.ok === "boolean" &&
		(value.path === null || (typeof value.path === "string" && value.path.length > 0)) &&
		typeof value.summary === "string" &&
		value.summary.length > 0
	);
}

function hasRetainedProviderCompletion(outcome: UnknownRecord): boolean {
	if (
		!Number.isInteger(outcome.turns) ||
		!Array.isArray(outcome.providerResponses) ||
		outcome.providerResponses.length !== outcome.turns ||
		outcome.providerResponses.length === 0
	) {
		return false;
	}
	let inputTokens = 0;
	let outputTokens = 0;
	const requestedTools: Array<{
		args: UnknownRecord;
		name: string;
		path: string | null;
	}> = [];
	for (const evidence of outcome.providerResponses) {
		if (
			!isRecord(evidence) ||
			typeof evidence.raw !== "string" ||
			evidence.raw.length === 0 ||
			typeof evidence.stopReason !== "string" ||
			evidence.stopReason.length === 0
		) {
			return false;
		}
		try {
			const raw = JSON.parse(evidence.raw) as unknown;
			if (
				!isRecord(raw) ||
				raw.stop_reason !== evidence.stopReason ||
				!isRecord(raw.usage) ||
				!Array.isArray(raw.content)
			) return false;
			for (const block of raw.content) {
				if (
					!isRecord(block) ||
					block.type !== "tool_use" ||
					block.name === "report_findings"
				) continue;
				if (typeof block.name !== "string" || !isRecord(block.input)) return false;
				requestedTools.push({
					args: block.input,
					name: block.name,
					path: typeof block.input.path === "string" ? block.input.path : null,
				});
			}
			const rawUsage = usageOf({
				inputTokens: raw.usage.input_tokens,
				outputTokens: raw.usage.output_tokens,
			});
			if (rawUsage === null) return false;
			inputTokens += rawUsage.inputTokens;
			outputTokens += rawUsage.outputTokens;
		} catch {
			return false;
		}
	}
	const outcomeUsage = usageOf(outcome.usage);
	if (
		outcomeUsage === null ||
		outcomeUsage.inputTokens !== inputTokens ||
		outcomeUsage.outputTokens !== outputTokens
	) return false;
	if (
		!Array.isArray(outcome.toolCalls) ||
		requestedTools.length !== outcome.toolCalls.length ||
		requestedTools.some((requested, index) => {
			const executed = outcome.toolCalls[index];
			return !isToolCall(executed) ||
				executed.name !== requested.name ||
				executed.path !== requested.path ||
				JSON.stringify(executed.args) !== JSON.stringify(requested.args);
		})
	) return false;
	const terminal = outcome.providerResponses.at(-1) as UnknownRecord;
	if (terminal.stopReason !== "tool_use" || typeof terminal.raw !== "string") {
		return false;
	}
	const raw = JSON.parse(terminal.raw) as UnknownRecord;
	if (!Array.isArray(raw.content)) return false;
	const reports = raw.content.filter(
		(block) =>
			isRecord(block) &&
			block.type === "tool_use" &&
			block.name === "report_findings" &&
			isRecord(block.input),
	);
	if (reports.length !== 1) return false;
	const report = reports[0] as UnknownRecord;
	const input = report.input as UnknownRecord;
	return (
		JSON.stringify(input.findings) === JSON.stringify(outcome.findings) &&
		JSON.stringify(input.couldNotVerify) === JSON.stringify(outcome.couldNotVerify) &&
		input.summary === outcome.summary
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
	if (
		!Array.isArray(value.trace) ||
		value.trace.length === 0 ||
		!value.trace.every(isToolCall) ||
		!Array.isArray(outcome.toolCalls) ||
		JSON.stringify(value.trace) !== JSON.stringify(outcome.toolCalls)
	) {
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
	const outcomeUsage = usageOf(outcome.usage);
	const reportUsage = usageOf(report.usage);
	if (
		outcomeUsage === null ||
		reportUsage === null ||
		outcomeUsage.inputTokens !== reportUsage.inputTokens ||
		outcomeUsage.outputTokens !== reportUsage.outputTokens
	) {
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
		outcomeFindingKeys.size !== outcome.findings.length ||
		new Set(matchingFindingKeys).size !== matchingFindingKeys.length ||
		new Set(consolidatedFindingKeys).size !== consolidatedFindingKeys.length ||
		value.score.namedFailure !== (matchingFindingKeys.length > 0) ||
		matchingFindingKeys.some((key) => !outcomeFindingKeys.has(key)) ||
		consolidatedFindingKeys.some((key) => !outcomeFindingKeys.has(key))
	) {
		return { reason: "schema-invalid", retry: "never", status: "invalid" };
	}
	if (!hasRetainedProviderCompletion(outcome)) {
		return {
			reason: "incomplete-provider-output",
			retry: "never",
			status: "invalid",
		};
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
		return {
			reason: "provider-failure",
			retry: retryForFailure({ kind: "provider-request", status: error.status }),
			status: "invalid",
		};
	}
	return null;
}

class AttemptPersistenceError extends Error {
	constructor(readonly original: unknown) {
		super(original instanceof Error ? original.message : "attempt persistence failed");
	}
}

function persistAttempt<T>(
	onAttempt: ((attempt: TrialAttempt<T>) => void) | undefined,
	attempt: TrialAttempt<T>,
): void {
	try {
		onAttempt?.(attempt);
	} catch (error) {
		throw new AttemptPersistenceError(error);
	}
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
	options: {
		canRetryAttempt?: (attempt: TrialAttempt<T>) => boolean;
		onAttempt?: (attempt: TrialAttempt<T>) => void;
		onBeforeAttempt?: (attempt: 1 | 2) => void;
		priorAttemptRecords?: readonly TrialAttempt<T>[];
	} = {},
): Promise<RetriedResult<T>> {
	const attemptRecords = [...(options.priorAttemptRecords ?? [])];
	if (
		attemptRecords.length > 2 ||
		attemptRecords.some((record, index) => record.attempt !== index + 1)
	) {
		throw new Error("durable attempt history is not a contiguous one-or-two-attempt prefix");
	}
	const infrastructureErrors = attemptRecords
		.filter((record) =>
			record.error !== null &&
			(record.disposition === null || record.disposition.retry === "infrastructure-once")
		)
		.map((record) => record.error as string);
	const prior = attemptRecords.at(-1);
	if (prior !== undefined) {
		if (prior.output !== null && prior.disposition.status === "usable") {
			return {
				attempts: prior.attempt,
				attemptRecords,
				infrastructureErrors,
				status: "completed",
				value: prior.output,
			};
		}
		if (
			prior.attempt === 2 ||
			(prior.disposition !== null && prior.disposition.retry === "never") ||
			(options.canRetryAttempt !== undefined &&
				!options.canRetryAttempt(prior))
		) {
			return {
				attempts: prior.attempt,
				attemptRecords,
				disposition: prior.disposition ?? undefined,
				infrastructureErrors,
				status: "exclude-case",
			};
		}
	}
	for (const attempts of [1, 2] as const) {
		if (attempts <= attemptRecords.length) continue;
		try {
			try {
				options.onBeforeAttempt?.(attempts);
			} catch (error) {
				throw new AttemptPersistenceError(error);
			}
			const value = await execute();
			const disposition = classify?.(value) ?? {
				reason: "completed",
				retry: "never",
				status: "usable",
			} as const;
			const attempt = {
				attempt: attempts,
				disposition,
				error: null,
				output: value,
			} as TrialAttempt<T>;
			attemptRecords.push(attempt);
			persistAttempt(options.onAttempt, attempt);
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
					if (
						attempts === 1 &&
						(options.canRetryAttempt === undefined ||
							options.canRetryAttempt(attempt))
					) continue;
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
			if (error instanceof AttemptPersistenceError) throw error.original;
			const summary = errorSummary(error);
			if (!isInfrastructureError(error)) {
				const disposition = thrownDisposition(error) ?? {
					reason: "unknown-state",
					retry: "never",
					status: "invalid",
				} as const;
				const attempt = {
					attempt: attempts,
					disposition,
					error: summary,
					output: null,
				} as TrialAttempt<T>;
				attemptRecords.push(attempt);
				persistAttempt(options.onAttempt, attempt);
				return {
					attempts,
					attemptRecords,
					disposition,
					infrastructureErrors,
					status: "exclude-case",
				};
			}
			infrastructureErrors.push(summary);
			const attempt = {
				attempt: attempts,
				disposition: thrownDisposition(error),
				error: summary,
				output: null,
			} as TrialAttempt<T>;
			attemptRecords.push(attempt);
			persistAttempt(options.onAttempt, attempt);
			if (
				options.canRetryAttempt !== undefined &&
				!options.canRetryAttempt(attempt)
			) {
				return {
					attempts,
					attemptRecords,
					disposition: attempt.disposition ?? undefined,
					infrastructureErrors,
					status: "exclude-case",
				};
			}
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
