export const CANONICAL_REJECTION_REASONS = [
	"provider-failure",
	"incomplete-provider-output",
	"unexpected-finish",
	"schema-invalid",
	"routing-invalid",
	"reviewer-failed",
	"provenance-incomplete",
	"provenance-mismatch",
	"unknown-state",
] as const;

export const CANONICAL_OPERATIONAL_CLASSES = [
	"retry-success",
	"retry-exhaustion",
	"semantic-after-retry",
	"early-failure",
	"atomic-quarantine",
	"crash-recovery",
	"reserve-order",
	"reserve-exhaustion",
] as const;

type CanaryInput = {
	attempts: Array<{
		attemptId: string;
		costComplete: boolean;
		costUsd: number;
		usable: boolean;
	}>;
	expectedBindings: Record<string, string>;
	fixtures: Array<{
		expectedReason: string;
		fixtureId: string;
		observedReason: string;
	}>;
	hiddenFailureRejected: boolean;
	nextCheckpoint: string;
	observedBindings: Record<string, string>;
	operational: Array<{ failureClass: string; passed: boolean; scenarioId: string }>;
	paidOutcomes: Array<{
		callId: string;
		costComplete: boolean;
		costUsd: number;
		expectedLabel: string;
		observedLabel: string;
		provenanceComplete: boolean;
		system: string;
		usageCostUsd: number;
		usable: boolean;
		variant: string;
	}>;
	runId: string;
};

type CanaryDecision = {
	authorized: boolean;
	nextCheckpoint: string;
	totalCostUsd: number;
	usableCostUsd: number;
} & ({ authorized: true } | { authorized: false; reasons: string[] });

function duplicates(values: readonly string[]): string[] {
	const seen = new Set<string>();
	return values.filter((value) => {
		if (seen.has(value)) return true;
		seen.add(value);
		return false;
	});
}

function exactMembers(actual: readonly string[], expected: readonly string[]): boolean {
	return actual.length === expected.length &&
		new Set(actual).size === actual.length &&
		expected.every((value) => actual.includes(value));
}

function validCost(value: number): boolean {
	return Number.isFinite(value) && value >= 0;
}

function roundedCost(value: number): number {
	return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

export function evaluateCanaryGate(input: CanaryInput): CanaryDecision {
	const reasons: string[] = [];
	if (input.runId.length === 0) reasons.push("run identity is missing");
	const fixtureIds = input.fixtures.map(({ fixtureId }) => fixtureId);
	if (fixtureIds.some((id) => id.length === 0) || duplicates(fixtureIds).length > 0) {
		reasons.push("fixture identities must be non-empty and unique");
	}
	if (
		!exactMembers(
			input.fixtures.map(({ expectedReason }) => expectedReason),
			CANONICAL_REJECTION_REASONS,
		)
	) {
		reasons.push("fixture inventory does not exactly cover the canonical R1 taxonomy");
	}
	for (const fixture of input.fixtures) {
		if (fixture.observedReason !== fixture.expectedReason) {
			reasons.push(`fixture ${fixture.fixtureId} disagrees with its frozen reason`);
		}
	}

	const operationalIds = input.operational.map(({ scenarioId }) => scenarioId);
	if (operationalIds.some((id) => id.length === 0) || duplicates(operationalIds).length > 0) {
		reasons.push("operational scenario identities must be non-empty and unique");
	}
	if (
		!exactMembers(
			input.operational.map(({ failureClass }) => failureClass),
			CANONICAL_OPERATIONAL_CLASSES,
		)
	) {
		reasons.push("operational evidence does not exactly cover the canonical R2 taxonomy");
	}
	for (const outcome of input.operational) {
		if (!outcome.passed) reasons.push(`operational scenario ${outcome.scenarioId} failed`);
	}

	const callIds = input.paidOutcomes.map(({ callId }) => callId);
	if (callIds.length !== 10 || callIds.some((id) => id.length === 0) || duplicates(callIds).length > 0) {
		reasons.push("paid canary must contain exactly ten unique call outcomes");
	}
	for (const required of ["full", "narrow"]) {
		if (!input.paidOutcomes.some(({ system }) => system === required)) {
			reasons.push(`paid canary does not cover ${required} system`);
		}
	}
	for (const required of ["buggy", "fixed"]) {
		if (!input.paidOutcomes.some(({ variant }) => variant === required)) {
			reasons.push(`paid canary does not cover ${required} variant`);
		}
	}
	for (const required of ["finding", "genuine-empty"]) {
		if (!input.paidOutcomes.some(({ expectedLabel }) => expectedLabel === required)) {
			reasons.push(`paid canary does not cover ${required} outcome`);
		}
	}
	for (const outcome of input.paidOutcomes) {
		if (!outcome.usable) reasons.push(`paid call ${outcome.callId} is unusable`);
		if (!outcome.provenanceComplete) {
			reasons.push(`paid call ${outcome.callId} has incomplete provenance`);
		}
		if (outcome.observedLabel !== outcome.expectedLabel) {
			reasons.push(`paid call ${outcome.callId} disagrees with its frozen label`);
		}
		if (
			!outcome.costComplete ||
			!validCost(outcome.costUsd) ||
			!validCost(outcome.usageCostUsd) ||
			Math.abs(outcome.costUsd - outcome.usageCostUsd) > 1e-9
		) {
			reasons.push(`paid call ${outcome.callId} has incomplete or inconsistent cost`);
		}
	}

	const attemptIds = input.attempts.map(({ attemptId }) => attemptId);
	if (attemptIds.some((id) => id.length === 0) || duplicates(attemptIds).length > 0) {
		reasons.push("attempt identities must be non-empty and unique");
	}
	for (const attempt of input.attempts) {
		if (!attempt.costComplete || !validCost(attempt.costUsd)) {
			reasons.push(`attempt ${attempt.attemptId} has incomplete cost`);
		}
	}
	if (!input.hiddenFailureRejected) reasons.push("real-wiring hidden failure was admitted");
	if (input.nextCheckpoint.length === 0) reasons.push("next checkpoint is missing");

	const expectedBindingNames = Object.keys(input.expectedBindings).sort();
	const observedBindingNames = Object.keys(input.observedBindings).sort();
	if (!exactMembers(observedBindingNames, expectedBindingNames)) {
		reasons.push("authorization binding inventory changed");
	}
	for (const name of expectedBindingNames) {
		const expected = input.expectedBindings[name];
		const observed = input.observedBindings[name];
		if (!/^[0-9a-f]{64}$/.test(expected ?? "") || observed !== expected) {
			reasons.push(`authorization binding ${name} is missing, malformed, or changed`);
		}
	}

	const totalCostUsd = roundedCost(
		input.attempts.reduce((total, attempt) => total + (validCost(attempt.costUsd) ? attempt.costUsd : 0), 0),
	);
	const usableCostUsd = roundedCost(
		input.attempts.reduce(
			(total, attempt) => total + (attempt.usable && validCost(attempt.costUsd) ? attempt.costUsd : 0),
			0,
		),
	);
	return reasons.length === 0
		? { authorized: true, nextCheckpoint: input.nextCheckpoint, totalCostUsd, usableCostUsd }
		: {
			authorized: false,
			nextCheckpoint: input.nextCheckpoint,
			reasons: [...new Set(reasons)],
			totalCostUsd,
			usableCostUsd,
		};
}
