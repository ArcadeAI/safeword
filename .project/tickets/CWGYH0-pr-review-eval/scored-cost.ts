export type AttemptUsage = {
	complete: boolean;
	costUsd: number;
	inputTokens: number;
	outputTokens: number;
};

function usageFromOutput(output: unknown): {
	inputTokens: number;
	outputTokens: number;
} | null {
	if (typeof output !== "object" || output === null || !("report" in output)) {
		return null;
	}
	const report = output.report;
	if (typeof report !== "object" || report === null || !("usage" in report)) {
		return null;
	}
	const usage = report.usage;
	if (
		typeof usage !== "object" ||
		usage === null ||
		!("inputTokens" in usage) ||
		!("outputTokens" in usage) ||
		typeof usage.inputTokens !== "number" ||
		!Number.isFinite(usage.inputTokens) ||
		usage.inputTokens < 0 ||
		typeof usage.outputTokens !== "number" ||
		!Number.isFinite(usage.outputTokens) ||
		usage.outputTokens < 0
	) {
		return null;
	}
	return { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
}

export function estimateAttemptUsage(
	attempts: readonly { output: unknown | null }[],
	prices: { inputPerMillionUsd: number; outputPerMillionUsd: number } = {
		inputPerMillionUsd: 3,
		outputPerMillionUsd: 15,
	},
): AttemptUsage {
	return attempts.reduce<AttemptUsage>(
		(total, attempt) => {
			if (attempt.output === null) return { ...total, complete: false };
			const usage = usageFromOutput(attempt.output);
			if (usage === null) return { ...total, complete: false };
			return {
				complete: total.complete,
				costUsd:
					total.costUsd +
					(usage.inputTokens * prices.inputPerMillionUsd +
						usage.outputTokens * prices.outputPerMillionUsd) /
						1_000_000,
				inputTokens: total.inputTokens + usage.inputTokens,
				outputTokens: total.outputTokens + usage.outputTokens,
			};
		},
		{ complete: true, costUsd: 0, inputTokens: 0, outputTokens: 0 },
	);
}
