import {
	existsSync,
	readFileSync,
	readdirSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
	acquireRunLock,
	beginProvisionalCase,
	executeCaseWork,
	quarantineCaseAndAllocateReserve,
	recoverInterruptedQuarantine,
	recordTrialResult,
	sealActiveCase,
} from "./scored-case-store";
import {
	executeWithInfrastructureRetry,
	type TrialDisposition,
} from "./scored-run-policy";

class RequestError extends Error {
	readonly status = 503;

	constructor() {
		super("provider unavailable");
		this.name = "ProviderRequestError";
	}
}

describe("durable case lifecycle", () => {
	test("one infrastructure failure is retried once before atomic admission", async () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		const lock = acquireRunLock(outputRoot);
		expect(() => acquireRunLock(outputRoot)).toThrow("already locked");
		const pendingCase = beginProvisionalCase({
			caseId: "SCORE-example",
			ordinal: 1,
			outputRoot,
		});
		let calls = 0;
		const result = await executeWithInfrastructureRetry(
			async () => {
				calls += 1;
				if (calls === 1) throw new RequestError();
				return { report: { findings: [] } };
			},
			(): TrialDisposition => ({
				reason: "completed",
				retry: "never",
				status: "usable",
			}),
		);

		recordTrialResult(pendingCase, "full--buggy--t1", result);

		expect(calls).toBe(2);
		expect(readdirSync(pendingCase.provisionalPath)).toEqual([
			"full--buggy--t1--attempt-1.json",
			"full--buggy--t1--attempt-2.json",
		]);
		expect(existsSync(pendingCase.activePath)).toBe(false);

		sealActiveCase(pendingCase);

		expect(existsSync(pendingCase.provisionalPath)).toBe(false);
		expect(readdirSync(pendingCase.activePath)).toHaveLength(2);
		lock.release();
	});

	test("a second infrastructure failure quarantines the pair before allocating a reserve", async () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		const pendingCase = beginProvisionalCase({
			caseId: "SCORE-example",
			ordinal: 1,
			outputRoot,
		});
		const sibling = await executeWithInfrastructureRetry(async () => ({
			report: { findings: ["earlier result"] },
		}));
		recordTrialResult(pendingCase, "narrow--fixed--t1", sibling);
		let calls = 0;
		const failed = await executeWithInfrastructureRetry(async () => {
			calls += 1;
			throw new RequestError();
		});
		recordTrialResult(pendingCase, "full--buggy--t1", failed);

		const transition = quarantineCaseAndAllocateReserve({
			caseState: pendingCase,
			exclusion: { reason: "provider-failure" },
			outputRoot,
			reserveIds: ["RESERVE-A", "RESERVE-B"],
			state: {
				candidateQueueIds: ["SCORE-next"],
				currentCaseId: "SCORE-example",
				nextWorkIndex: 4,
				reserveIndex: 0,
				version: 3,
			},
		});

		expect(calls).toBe(2);
		expect(existsSync(pendingCase.provisionalPath)).toBe(false);
		expect(existsSync(pendingCase.activePath)).toBe(false);
		expect(readdirSync(pendingCase.quarantinePath).sort()).toEqual([
			"EXCLUSION.json",
			"full--buggy--t1--attempt-1.json",
			"full--buggy--t1--attempt-2.json",
			"narrow--fixed--t1--attempt-1.json",
		]);
		expect(transition).toMatchObject({
			replacementId: "RESERVE-A",
			state: {
				candidateQueueIds: ["RESERVE-A", "SCORE-next"],
				currentCaseId: null,
				nextWorkIndex: 0,
				reserveIndex: 1,
			},
		});
		expect(JSON.parse(readFileSync(join(outputRoot, "run-state.json"), "utf8")))
			.toEqual(transition.state);
	});
});

describe("semantic failure handling", () => {
	test.each([
		["parsing failure", "schema-invalid"],
		["content-policy failure", "reviewer-failed"],
		["schema-invalid report", "schema-invalid"],
		["HTTP-200 provider error envelope", "provider-failure"],
		["empty provider response", "incomplete-provider-output"],
		["truncated provider response", "incomplete-provider-output"],
		["missing reviewer route", "routing-invalid"],
		["reviewer error outcome", "reviewer-failed"],
		["unexpected terminal finish", "unexpected-finish"],
		["incomplete provenance", "provenance-incomplete"],
		["mismatched provenance", "provenance-mismatch"],
		["unknown completion state", "unknown-state"],
	] as const)("quarantines %s after one attempt", async (_label, reason) => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		const pendingCase = beginProvisionalCase({
			caseId: "SCORE-example",
			ordinal: 1,
			outputRoot,
		});
		let calls = 0;
		const result = await executeCaseWork({
			caseState: pendingCase,
			classify: () => ({ reason, retry: "never", status: "invalid" }),
			execute: async () => {
				calls += 1;
				return { raw: _label };
			},
			outputRoot,
			reserveIds: ["RESERVE-A"],
			state: {
				candidateQueueIds: ["SCORE-next"],
				currentCaseId: "SCORE-example",
				nextWorkIndex: 3,
				reserveIndex: 0,
				version: 3,
			},
			workId: "full--buggy--t1",
		});

		expect(calls).toBe(1);
		expect(result).toMatchObject({
			replacementId: "RESERVE-A",
			state: { reserveIndex: 1 },
			status: "excluded",
		});
		expect(existsSync(pendingCase.provisionalPath)).toBe(false);
		expect(readdirSync(pendingCase.quarantinePath).sort()).toEqual([
			"EXCLUSION.json",
			"full--buggy--t1--attempt-1.json",
		]);
		const exclusion = JSON.parse(
			readFileSync(join(pendingCase.quarantinePath, "EXCLUSION.json"), "utf8"),
		);
		expect(exclusion).toMatchObject({
			disposition: { reason, retry: "never", status: "invalid" },
			workId: "full--buggy--t1",
		});
	});
});

describe("quarantine crash recovery", () => {
	test.each([
		"before the atomic quarantine transition",
		"during the quarantine state transaction",
		"after quarantine before reserve allocation",
		"after reserve allocation before next work",
	] as const)("recovers exactly once %s", async (boundary) => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		const caseState = beginProvisionalCase({
			caseId: "SCORE-example",
			ordinal: 1,
			outputRoot,
		});
		const failed = await executeWithInfrastructureRetry(
			async () => ({ raw: "semantic failure" }),
			() => ({ reason: "schema-invalid", retry: "never", status: "invalid" }),
		);
		recordTrialResult(caseState, "full--buggy--t1", failed);
		const exclusion = {
			disposition: { reason: "schema-invalid", retry: "never", status: "invalid" },
			workId: "full--buggy--t1",
		};
		const exclusionPath = join(caseState.provisionalPath, "EXCLUSION.json");
		if (boundary !== "before the atomic quarantine transition") {
			writeFileSync(exclusionPath, `${JSON.stringify(exclusion)}\n`);
		}
		if (
			boundary === "after quarantine before reserve allocation" ||
			boundary === "after reserve allocation before next work"
		) {
			renameSync(caseState.provisionalPath, caseState.quarantinePath);
		}
		const baseState = {
			candidateQueueIds: ["SCORE-next"],
			currentCaseId: "SCORE-example",
			nextWorkIndex: 4,
			reserveIndex: 0,
			version: 3,
		};
		const state = boundary === "after reserve allocation before next work"
			? {
				...baseState,
				candidateQueueIds: ["RESERVE-A", "SCORE-next"],
				currentCaseId: null,
				nextWorkIndex: 0,
				reserveIndex: 1,
			}
			: baseState;
		if (boundary === "after reserve allocation before next work") {
			writeFileSync(
				join(outputRoot, "run-state.json"),
				`${JSON.stringify(state)}\n`,
			);
		}

		const recovered = recoverInterruptedQuarantine({
			caseState,
			outputRoot,
			reserveIds: ["RESERVE-A", "RESERVE-B"],
			state,
		});
		const recoveredAgain = recoverInterruptedQuarantine({
			caseState,
			outputRoot,
			reserveIds: ["RESERVE-A", "RESERVE-B"],
			state: recovered,
		});

		expect(recoveredAgain).toEqual(recovered);
		expect(recovered).toMatchObject({
			candidateQueueIds: ["RESERVE-A", "SCORE-next"],
			currentCaseId: null,
			nextWorkIndex: 0,
			reserveIndex: 1,
		});
		expect(existsSync(caseState.provisionalPath)).toBe(false);
		expect(readdirSync(caseState.quarantinePath).sort()).toEqual([
			"EXCLUSION.json",
			"full--buggy--t1--attempt-1.json",
		]);
		expect(JSON.parse(readFileSync(join(outputRoot, "run-state.json"), "utf8")))
			.toEqual(recovered);
	});
});
