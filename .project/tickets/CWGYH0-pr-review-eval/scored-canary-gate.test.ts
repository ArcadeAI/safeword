import { describe, expect, test } from "vitest";

import {
	CANONICAL_OPERATIONAL_CLASSES,
	CANONICAL_REJECTION_REASONS,
	evaluateCanaryGate,
	REQUIRED_AUTHORIZATION_BINDINGS,
} from "./scored-canary-gate";

const route = { expert: "correctness", model: "claude-sonnet-5", provider: "anthropic" };

function rawOutput(index: number) {
	const findings = index === 0 ? [{ file: "src/example.ts", line: 1, title: "finding" }] : [];
	const provenance = {
		caseId: `case-${index + 1}`,
		reviewBaseSha: `base-${index + 1}`,
		runnerRef: "runner@pinned",
		sourceSha: `source-${index + 1}`,
		variant: index % 4 < 2 ? "buggy" : "fixed",
	};
	return {
		output: {
			models: [route],
			provenance,
			report: {
				consolidated: { findings },
				expertOutcomes: [{
					...route,
					cappedBy: null,
					couldNotVerify: [],
					error: null,
					failure: null,
					findings,
					providerResponses: [{
						raw: JSON.stringify({
							content: [{
								input: { couldNotVerify: [], findings, summary: "Complete." },
								name: "report_findings",
								type: "tool_use",
							}],
							stop_reason: "tool_use",
						}),
						stopReason: "tool_use",
					}],
					summary: "Complete.",
					turns: 1,
					usage: { inputTokens: 10, outputTokens: 2 },
				}],
				usage: { inputTokens: 10, outputTokens: 2 },
			},
			score: {
				matchingFindings: findings,
				namedFailure: findings.length > 0,
				reviewValid: true,
			},
			terminalState: "completed",
			trace: [{ type: "report" }],
		},
		provenance,
	};
}

function retryableRawOutput(index: number) {
	const value = rawOutput(index);
	value.output.report.expertOutcomes[0]!.error = "provider unavailable" as never;
	value.output.report.expertOutcomes[0]!.failure = {
		kind: "provider-request",
		status: 503,
	} as never;
	value.output.score.reviewValid = false;
	value.output.terminalState = "failed" as never;
	return value;
}

function validInput() {
	const fixtures = CANONICAL_REJECTION_REASONS.map((reason) => ({
		expectedReason: reason,
		fixtureId: `fixture-${reason}`,
		observedReason: reason,
		recordedAt: "2026-08-01T00:00:00.000Z",
	}));
	const operational = CANONICAL_OPERATIONAL_CLASSES.map((failureClass) => ({
		failureClass,
		passed: true,
		recordedAt: "2026-08-01T00:00:00.000Z",
		scenarioId: `scenario-${failureClass}`,
	}));
	const paidOutcomes = Array.from({ length: 10 }, (_, index) => ({
		attemptIds: [`attempt-${index + 1}`],
		callId: `call-${index + 1}`,
		costComplete: true,
		costUsd: 0.01,
		provenanceComplete: true,
		recordedAt: "2026-08-01T00:00:00.000Z",
		system: index % 2 === 0 ? "full" : "narrow",
		usageCostUsd: 0.01,
		usable: true,
		variant: index % 4 < 2 ? "buggy" : "fixed",
	}));
	const preregisteredLabels = paidOutcomes.map((outcome, index) => ({
		callId: outcome.callId,
		expectedAdmission: "usable" as const,
		expectedOutputClass: index === 0 ? "finding" as const : "empty" as const,
		expectedReason: "completed" as const,
		genuineEmpty: index === 1,
		system: outcome.system as "full" | "narrow",
		variant: outcome.variant as "buggy" | "fixed",
	}));
	paidOutcomes[0]!.attemptIds.push("retry");
	paidOutcomes[0]!.costUsd = 0.03;
	paidOutcomes[0]!.usageCostUsd = 0.03;
	paidOutcomes[1]!.attemptIds.push("failed");
	paidOutcomes[1]!.costUsd = 0.04;
	paidOutcomes[1]!.usageCostUsd = 0.04;
	const expectedBindings = Object.fromEntries(
		REQUIRED_AUTHORIZATION_BINDINGS.map((name, index) => [
			name,
			(index + 10).toString(16).padStart(64, "0"),
		]),
	);
	return {
		anchorCreatedAt: "2026-08-02T00:00:00.000Z",
		labelAnchorCreatedAt: "2026-07-31T00:00:00.000Z",
		attempts: [
			{ attempt: 1 as const, attemptId: "retry", callId: "call-1", costComplete: true, costUsd: 0.02, expectedProvenance: retryableRawOutput(0).provenance, expectedRoute: route, output: retryableRawOutput(0).output, system: "full" as const, usable: false },
			{ attempt: 1 as const, attemptId: "failed", callId: "call-2", costComplete: true, costUsd: 0.03, expectedProvenance: retryableRawOutput(1).provenance, expectedRoute: route, output: retryableRawOutput(1).output, system: "narrow" as const, usable: false },
			...Array.from({ length: 10 }, (_, index) => ({
				...rawOutput(index),
				attempt: index < 2 ? 2 as const : 1 as const,
				attemptId: `attempt-${index + 1}`,
				callId: `call-${index + 1}`,
				costComplete: true,
				costUsd: 0.01,
				expectedProvenance: rawOutput(index).provenance,
				expectedRoute: route,
				system: index % 2 === 0 ? "full" as const : "narrow" as const,
				usable: true,
			})),
		],
		expectedBindings,
		fixtures,
		hiddenFailureRejected: true,
		nextCheckpoint: "20-calls",
		observedBindings: { ...expectedBindings },
		operational,
		paidOutcomes,
		preregisteredLabels,
		runId: "run-fixture-1",
	};
}

describe("paid canary authorization", () => {
	test("authorizes one bound checkpoint from complete individual evidence", () => {
		expect(evaluateCanaryGate(validInput())).toEqual({
			authorized: true,
			nextCheckpoint: "20-calls",
			totalCostUsd: 0.15,
			usableCostUsd: 0.1,
		});
	});

	test.each([
		["missing fixture taxonomy", (input: ReturnType<typeof validInput>) => input.fixtures.pop()],
		["failed operational injection", (input: ReturnType<typeof validInput>) => { input.operational[0]!.passed = false; }],
		["unusable paid call", (input: ReturnType<typeof validInput>) => { input.paidOutcomes[3]!.usable = false; }],
		["label disagreement", (input: ReturnType<typeof validInput>) => { input.preregisteredLabels[4]!.expectedOutputClass = "finding"; }],
		["post-outcome label anchor", (input: ReturnType<typeof validInput>) => { input.labelAnchorCreatedAt = "2026-08-01T00:00:00.000Z"; }],
		["unsupported label vocabulary", (input: ReturnType<typeof validInput>) => { input.preregisteredLabels[2]!.expectedOutputClass = "unsupported" as "empty"; }],
		["fabricated raw system", (input: ReturnType<typeof validInput>) => { input.attempts.find(({ attemptId }) => attemptId === "attempt-2")!.system = "full"; }],
		["fabricated raw variant", (input: ReturnType<typeof validInput>) => { input.attempts.find(({ attemptId }) => attemptId === "attempt-3")!.expectedProvenance.variant = "buggy"; }],
		["incomplete cost", (input: ReturnType<typeof validInput>) => { input.attempts[1]!.costComplete = false; }],
		["missing attempt ledger", (input: ReturnType<typeof validInput>) => { input.attempts = []; }],
		["unreferenced retry", (input: ReturnType<typeof validInput>) => { input.paidOutcomes[0]!.attemptIds.pop(); }],
		["cost inconsistent with usage", (input: ReturnType<typeof validInput>) => { input.paidOutcomes[2]!.usageCostUsd = 0.02; }],
		["hidden failure admitted", (input: ReturnType<typeof validInput>) => { input.hiddenFailureRejected = false; }],
		["changed executable binding", (input: ReturnType<typeof validInput>) => { input.observedBindings.runner = "c".repeat(64); }],
		["missing required binding", (input: ReturnType<typeof validInput>) => { delete input.expectedBindings.labels; delete input.observedBindings.labels; }],
	] as const)("blocks more spend for %s", (_label, mutate) => {
		const input = validInput();
		mutate(input);
		const result = evaluateCanaryGate(input);
		expect(result.authorized).toBe(false);
		if (!result.authorized) expect(result.reasons.length).toBeGreaterThan(0);
	});

	test("reports all-attempt cost separately from usable cost", () => {
		const result = evaluateCanaryGate(validInput());
		expect(result).toMatchObject({ totalCostUsd: 0.15, usableCostUsd: 0.1 });
	});
});
