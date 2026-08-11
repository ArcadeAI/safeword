import { createHash } from "node:crypto";

import { estimateAttemptUsage } from "./scored-cost";
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
	"corpusRole",
	"costPolicy",
	"effectiveMatrixDeriver",
	"fixtures",
	"labels",
	"preflight",
	"preregisteredMatrix",
	"primaryManifest",
	"providerConfiguration",
	"realWiring",
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
		attempt: 1 | 2;
		attemptId: string;
		callId: string;
		costComplete: boolean;
		costUsd: number;
		expectedProvenance: TrialProvenance;
		expectedRoute: TrialRoute;
		output: unknown;
		system: "full" | "narrow";
		usable: boolean;
	}>;
	costPolicy: {
		aggregateCostStopUsd: number;
		cumulativeCostTargetUsd: number;
		inputPricePerMillionUsd: number;
		outputPricePerMillionUsd: number;
	};
	expectedBindings: Record<string, string>;
	fixtures: Array<{
		expectedReason: string;
		fixtureId: string;
		observedReason: string;
		recordedAt: string;
	}>;
	hiddenFailureEvidence: {
		activeRecordIdentities: string[];
		attemptId: string;
		expectedProvenance: TrialProvenance;
		expectedRoute: TrialRoute;
		output: unknown;
		quarantinedAttemptIdentities: string[];
		recordedAt: string;
		scorer: {
			admittedCaseIds?: string[];
			excludedCaseIds?: string[];
			exitStatus: number;
			resultsExists: boolean;
			stderr: string;
		};
	};
	nextCheckpoint: string;
	observedBindings: Record<string, string>;
	operational: Array<{ failureClass: string; passed: boolean; recordedAt: string; scenarioId: string }>;
	paidOutcomes: Array<{
		attemptIds: string[];
		callId: string;
		costComplete: boolean;
		costUsd: number;
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
		expectedOutputClass: "empty" | "finding";
		expectedReason: "completed";
		genuineEmpty: boolean;
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

function sha256(value: string): string {
	return createHash("sha256").update(value).digest("hex");
}

export function evaluateCanaryGate(input: CanaryInput): CanaryDecision {
	const reasons: string[] = [];
	if (
		!validCost(input.costPolicy.aggregateCostStopUsd) ||
		input.costPolicy.aggregateCostStopUsd === 0 ||
		!validCost(input.costPolicy.cumulativeCostTargetUsd) ||
		input.costPolicy.cumulativeCostTargetUsd === 0 ||
		!validCost(input.costPolicy.inputPricePerMillionUsd) ||
		input.costPolicy.inputPricePerMillionUsd === 0 ||
		!validCost(input.costPolicy.outputPricePerMillionUsd) ||
		input.costPolicy.outputPricePerMillionUsd === 0
	) {
		reasons.push("cost policy must contain finite positive prices and spend stops");
	}
	if (
		sha256(JSON.stringify(input.costPolicy)) !==
		input.observedBindings.costPolicy
	) {
		reasons.push("cost policy evidence differs from its authorization binding");
	}
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
			!["empty", "finding"].includes(label.expectedOutputClass) ||
			(typeof label.genuineEmpty !== "boolean") ||
			(label.genuineEmpty && label.expectedOutputClass !== "empty") ||
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
	if (!input.preregisteredLabels.some(({ expectedOutputClass }) => expectedOutputClass === "finding")) {
		reasons.push("paid canary does not cover finding outcome");
	}
	if (!input.preregisteredLabels.some(({ genuineEmpty }) => genuineEmpty)) {
		reasons.push("paid canary does not cover a preregistered genuine-empty outcome");
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
		const derived = estimateAttemptUsage([{ output: attempt.output }], {
			inputPerMillionUsd: input.costPolicy.inputPricePerMillionUsd,
			outputPerMillionUsd: input.costPolicy.outputPricePerMillionUsd,
		});
		if (!derived.complete || Math.abs(derived.costUsd - attempt.costUsd) > 1e-9) {
			reasons.push(`attempt ${attempt.attemptId} cost disagrees with retained provider usage`);
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
		const attempts = input.attempts
			.filter((attempt) => outcome.attemptIds.includes(attempt.attemptId))
			.sort((left, right) => left.attempt - right.attempt);
		if (
			attempts.length !== outcome.attemptIds.length ||
			attempts.length < 1 ||
			attempts.length > 2 ||
			attempts.some((attempt, index) => attempt.attempt !== index + 1) ||
			attempts.some(
				(attempt) =>
					attempt.callId !== outcome.callId ||
					attempt.system !== outcome.system ||
					attempt.expectedProvenance.variant !== outcome.variant,
			)
		) {
			reasons.push(`paid call ${outcome.callId} references an absent or unrelated attempt`);
			continue;
		}
		const dispositions = attempts.map((attempt) =>
			classifyTrialOutput(
				attempt.output,
				attempt.expectedRoute,
				attempt.expectedProvenance,
			)
		);
		if (
			dispositions.length === 2 &&
			(dispositions[0]?.status !== "invalid" ||
				dispositions[0].retry !== "infrastructure-once")
		) {
			reasons.push(`paid call ${outcome.callId} retry was not eligible exactly once`);
		}
		const derivedCost = roundedCost(attempts.reduce((total, attempt) =>
			total + estimateAttemptUsage([{ output: attempt.output }], {
				inputPerMillionUsd: input.costPolicy.inputPricePerMillionUsd,
				outputPerMillionUsd: input.costPolicy.outputPricePerMillionUsd,
			}).costUsd, 0));
		if (
			Math.abs(derivedCost - outcome.costUsd) > 1e-9 ||
			Math.abs(derivedCost - outcome.usageCostUsd) > 1e-9
		) {
			reasons.push(`paid call ${outcome.callId} cost does not equal its complete attempt set`);
		}
		const terminalAttempt = attempts.at(-1);
		const terminalDisposition = dispositions.at(-1);
		const rawOutput = terminalAttempt?.output;
		const rawFindings =
			rawOutput !== null && typeof rawOutput === "object" &&
			"report" in rawOutput && rawOutput.report !== null && typeof rawOutput.report === "object" &&
			"consolidated" in rawOutput.report && rawOutput.report.consolidated !== null && typeof rawOutput.report.consolidated === "object" &&
			"findings" in rawOutput.report.consolidated && Array.isArray(rawOutput.report.consolidated.findings)
				? rawOutput.report.consolidated.findings
				: null;
		const expectedRawClass = label?.expectedOutputClass ?? null;
		const observedRawClass = rawFindings === null ? null : rawFindings.length > 0 ? "finding" : "empty";
		if (
			terminalAttempt?.usable !== true ||
			terminalDisposition?.status !== "usable" ||
			observedRawClass !== expectedRawClass
		) {
			reasons.push(`paid call ${outcome.callId} raw output disagrees with its frozen output class`);
		}
	}
	const hidden = input.hiddenFailureEvidence;
	const hiddenDisposition = classifyTrialOutput(
		hidden.output,
		hidden.expectedRoute,
		hidden.expectedProvenance,
	);
	if (!retainedBeforeAnchor(hidden.recordedAt)) {
		reasons.push("real-wiring evidence was not retained before authorization");
	}
	const scorerRejected =
		hidden.scorer.exitStatus !== 0 &&
		!hidden.scorer.resultsExists &&
		hidden.scorer.stderr.includes("missing");
	const scorerExcluded =
		hidden.scorer.exitStatus === 0 &&
		hidden.scorer.resultsExists &&
		Array.isArray(hidden.scorer.admittedCaseIds) &&
		Array.isArray(hidden.scorer.excludedCaseIds) &&
		!hidden.scorer.admittedCaseIds.includes(hidden.expectedProvenance.caseId) &&
		hidden.scorer.excludedCaseIds.includes(hidden.expectedProvenance.caseId);
	if (
		hidden.attemptId.length === 0 ||
		hiddenDisposition.status !== "invalid" ||
		hiddenDisposition.reason !== "provider-failure" ||
		hidden.activeRecordIdentities.length !== 0 ||
		hidden.quarantinedAttemptIdentities.length !== 1 ||
		hidden.quarantinedAttemptIdentities[0] !== hidden.attemptId ||
		(!scorerRejected && !scorerExcluded)
	) {
		reasons.push("real-wiring hidden failure was not proven quarantined and unscoreable");
	}
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
	if (
		totalCostUsd > input.costPolicy.aggregateCostStopUsd ||
		totalCostUsd > input.costPolicy.cumulativeCostTargetUsd
	) {
		reasons.push("complete attempt cost exceeds the frozen spend stop");
	}
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
