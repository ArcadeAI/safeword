import {
	classifyTrialOutput,
	type TrialProvenance,
	type TrialRoute,
} from "./scored-run-policy";

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

export const REQUIRED_AUTHORIZATION_BINDINGS = [
	"adapter",
	"classifier",
	"costPolicy",
	"effectiveMatrixDeriver",
	"fixtures",
	"labels",
	"preflight",
	"preregisteredMatrix",
	"primaryManifest",
	"providerConfiguration",
	"reserveManifest",
	"runner",
	"runIdentity",
	"scorer",
	"sourceCommits",
	"writer",
] as const;

type CanaryInput = {
	anchorCreatedAt: string;
	labelAnchorCreatedAt: string;
	attempts: Array<{
		attemptId: string;
		callId: string;
		costComplete: boolean;
		costUsd: number;
		expectedProvenance: TrialProvenance;
		expectedRoute: TrialRoute;
		output: unknown;
		usable: boolean;
	}>;
	expectedBindings: Record<string, string>;
	fixtures: Array<{
		expectedReason: string;
		fixtureId: string;
		observedReason: string;
		recordedAt: string;
	}>;
	hiddenFailureRejected: boolean;
	nextCheckpoint: string;
	observedBindings: Record<string, string>;
	operational: Array<{ failureClass: string; passed: boolean; recordedAt: string; scenarioId: string }>;
	paidOutcomes: Array<{
		attemptIds: string[];
		callId: string;
		costComplete: boolean;
		costUsd: number;
		observedLabel: string;
		provenanceComplete: boolean;
		recordedAt: string;
		system: string;
		usageCostUsd: number;
		usable: boolean;
		variant: string;
	}>;
	preregisteredLabels: Array<{
		callId: string;
		expectedAdmission: "usable";
		expectedOutputClass: "clean" | "finding" | "genuine-empty";
		expectedReason: "completed";
		system: "full" | "narrow";
		variant: "buggy" | "fixed";
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
	const anchorTime = new Date(input.anchorCreatedAt).valueOf();
	const labelAnchorTime = new Date(input.labelAnchorCreatedAt).valueOf();
	if (!Number.isFinite(anchorTime)) reasons.push("authorization anchor timestamp is invalid");
	if (!Number.isFinite(labelAnchorTime) || labelAnchorTime >= anchorTime) {
		reasons.push("label anchor must be valid and predate authorization");
	}
	const retainedBeforeAnchor = (recordedAt: string): boolean => {
		const time = new Date(recordedAt).valueOf();
		return Number.isFinite(time) && time <= anchorTime;
	};
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
		if (!retainedBeforeAnchor(fixture.recordedAt)) reasons.push(`fixture ${fixture.fixtureId} was not retained before authorization`);
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
		if (!retainedBeforeAnchor(outcome.recordedAt)) reasons.push(`operational scenario ${outcome.scenarioId} was not retained before authorization`);
		if (!outcome.passed) reasons.push(`operational scenario ${outcome.scenarioId} failed`);
	}

	const callIds = input.paidOutcomes.map(({ callId }) => callId);
	if (callIds.length !== 10 || callIds.some((id) => id.length === 0) || duplicates(callIds).length > 0) {
		reasons.push("paid canary must contain exactly ten unique call outcomes");
	}
	const labelCallIds = input.preregisteredLabels.map(({ callId }) => callId);
	if (
		labelCallIds.length !== 10 ||
		labelCallIds.some((id) => id.length === 0) ||
		duplicates(labelCallIds).length > 0 ||
		!exactMembers(labelCallIds, callIds)
	) {
		reasons.push("pre-call labels must identify exactly the ten paid calls");
	}
	for (const label of input.preregisteredLabels) {
		if (
			label.expectedAdmission !== "usable" ||
			label.expectedReason !== "completed" ||
			!["clean", "finding", "genuine-empty"].includes(label.expectedOutputClass) ||
			!["full", "narrow"].includes(label.system) ||
			!["buggy", "fixed"].includes(label.variant)
		) {
			reasons.push(`pre-call label ${label.callId} has an unsupported mechanical contract`);
		}
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
		if (!input.preregisteredLabels.some(({ expectedOutputClass }) => expectedOutputClass === required)) {
			reasons.push(`paid canary does not cover ${required} outcome`);
		}
	}
	for (const outcome of input.paidOutcomes) {
		const label = input.preregisteredLabels.find(({ callId }) => callId === outcome.callId);
		if (!retainedBeforeAnchor(outcome.recordedAt)) reasons.push(`paid call ${outcome.callId} was not retained before authorization`);
		if (new Date(outcome.recordedAt).valueOf() <= labelAnchorTime) {
			reasons.push(`paid call ${outcome.callId} does not postdate its frozen label anchor`);
		}
		if (!outcome.usable) reasons.push(`paid call ${outcome.callId} is unusable`);
		if (!outcome.provenanceComplete) {
			reasons.push(`paid call ${outcome.callId} has incomplete provenance`);
		}
		if (
			label === undefined ||
			outcome.observedLabel !== label.expectedOutputClass ||
			outcome.system !== label.system ||
			outcome.variant !== label.variant
		) {
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
		const disposition = classifyTrialOutput(
			attempt.output,
			attempt.expectedRoute,
			attempt.expectedProvenance,
		);
		if (attempt.usable !== (disposition.status === "usable")) {
			reasons.push(`attempt ${attempt.attemptId} usable flag disagrees with its raw output`);
		}
	}
	const referencedAttemptIds = input.paidOutcomes.flatMap(({ attemptIds: ids }) => ids);
	if (
		referencedAttemptIds.length !== attemptIds.length ||
		duplicates(referencedAttemptIds).length > 0 ||
		!exactMembers(referencedAttemptIds, attemptIds)
	) {
		reasons.push("paid outcomes do not reference the complete attempt ledger exactly once");
	}
	for (const outcome of input.paidOutcomes) {
		const label = input.preregisteredLabels.find(({ callId }) => callId === outcome.callId);
		if (outcome.attemptIds.length === 0 || new Set(outcome.attemptIds).size !== outcome.attemptIds.length) {
			reasons.push(`paid call ${outcome.callId} has no complete unique attempt set`);
			continue;
		}
		const attempts = input.attempts.filter((attempt) => outcome.attemptIds.includes(attempt.attemptId));
		if (
			attempts.length !== outcome.attemptIds.length ||
			attempts.some((attempt) => attempt.callId !== outcome.callId)
		) {
			reasons.push(`paid call ${outcome.callId} references an absent or unrelated attempt`);
			continue;
		}
		const reconciledCost = roundedCost(attempts.reduce((total, attempt) => total + attempt.costUsd, 0));
		if (Math.abs(reconciledCost - outcome.costUsd) > 1e-9) {
			reasons.push(`paid call ${outcome.callId} cost does not equal its complete attempt set`);
		}
		const terminalAttempt = attempts.at(-1);
		const rawOutput = terminalAttempt?.output;
		const rawFindings =
			rawOutput !== null && typeof rawOutput === "object" &&
			"report" in rawOutput && rawOutput.report !== null && typeof rawOutput.report === "object" &&
			"consolidated" in rawOutput.report && rawOutput.report.consolidated !== null && typeof rawOutput.report.consolidated === "object" &&
			"findings" in rawOutput.report.consolidated && Array.isArray(rawOutput.report.consolidated.findings)
				? rawOutput.report.consolidated.findings
				: null;
		const expectedRawClass = label?.expectedOutputClass === "finding" ? "finding" : "empty";
		const observedRawClass = rawFindings === null ? null : rawFindings.length > 0 ? "finding" : "empty";
		if (
			terminalAttempt?.usable !== true ||
			observedRawClass !== expectedRawClass
		) {
			reasons.push(`paid call ${outcome.callId} raw output disagrees with its frozen output class`);
		}
	}
	if (!input.hiddenFailureRejected) reasons.push("real-wiring hidden failure was admitted");
	if (input.nextCheckpoint.length === 0) reasons.push("next checkpoint is missing");

	const expectedBindingNames = Object.keys(input.expectedBindings).sort();
	const observedBindingNames = Object.keys(input.observedBindings).sort();
	if (!exactMembers(expectedBindingNames, REQUIRED_AUTHORIZATION_BINDINGS)) {
		reasons.push("authorization binding inventory is incomplete or unsupported");
	}
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
