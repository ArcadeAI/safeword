import { describe, expect, test } from "vitest";

import {
	CANONICAL_OPERATIONAL_CLASSES,
	CANONICAL_REJECTION_REASONS,
	evaluateCanaryGate,
	REQUIRED_AUTHORIZATION_BINDINGS,
} from "./scored-canary-gate";

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
		expectedLabel: index === 0 ? "finding" : index === 1 ? "genuine-empty" : "clean",
		observedLabel: index === 0 ? "finding" : index === 1 ? "genuine-empty" : "clean",
		provenanceComplete: true,
		recordedAt: "2026-08-01T00:00:00.000Z",
		system: index % 2 === 0 ? "full" : "narrow",
		usageCostUsd: 0.01,
		usable: true,
		variant: index % 4 < 2 ? "buggy" : "fixed",
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
		attempts: [
			...Array.from({ length: 10 }, (_, index) => ({
				attemptId: `attempt-${index + 1}`,
				callId: `call-${index + 1}`,
				costComplete: true,
				costUsd: 0.01,
				usable: true,
			})),
			{ attemptId: "retry", callId: "call-1", costComplete: true, costUsd: 0.02, usable: false },
			{ attemptId: "failed", callId: "call-2", costComplete: true, costUsd: 0.03, usable: false },
		],
		expectedBindings,
		fixtures,
		hiddenFailureRejected: true,
		nextCheckpoint: "20-calls",
		observedBindings: { ...expectedBindings },
		operational,
		paidOutcomes,
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
		["label disagreement", (input: ReturnType<typeof validInput>) => { input.paidOutcomes[4]!.observedLabel = "finding"; }],
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
