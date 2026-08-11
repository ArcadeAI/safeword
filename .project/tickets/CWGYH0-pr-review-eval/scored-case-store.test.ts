import {
	existsSync,
	mkdirSync,
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
	caseStateFor,
	executeCaseWork,
	quarantineCaseAndAllocateReserve,
	recoverInterruptedQuarantine,
	recordAdmittedTrial,
	recordTrialResult,
	sealActiveCase,
	writeJsonDurably,
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
	test("cleans a failed temporary write before retrying the same target", () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		const target = join(outputRoot, "state.json");
		const circular: { self?: unknown } = {};
		circular.self = circular;

		expect(() => writeJsonDurably(target, circular)).toThrow();
		expect(readdirSync(outputRoot)).toEqual([]);

		writeJsonDurably(target, { status: "recovered" });

		expect(JSON.parse(readFileSync(target, "utf8"))).toEqual({
			status: "recovered",
		});
	});

	test("keeps admitted records invisible until the whole case is sealed", async () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		const pendingCase = beginProvisionalCase({
			caseId: "SCORE-example",
			ordinal: 1,
			outputRoot,
		});
		recordAdmittedTrial(pendingCase, "full--buggy--t1", {
			caseId: "SCORE-example",
			system: "full",
			trial: 1,
			variant: "buggy",
		});

		expect(readdirSync(join(outputRoot, "active"))).toEqual([]);
		expect(
			beginProvisionalCase({
				caseId: "SCORE-example",
				ordinal: 1,
				outputRoot,
				resume: true,
			}),
		).toEqual(pendingCase);
		expect(caseStateFor({ caseId: "SCORE-example", ordinal: 1, outputRoot }))
			.toEqual(pendingCase);

		sealActiveCase(pendingCase);

		expect(readdirSync(pendingCase.activePath)).toEqual([
			"full--buggy--t1--record.json",
		]);
	});

	test("reclaims a lock whose owning process is dead", () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		writeFileSync(join(outputRoot, ".run.lock"), "2147483647\n");

		const lock = acquireRunLock(outputRoot);

		expect(
			JSON.parse(readFileSync(join(outputRoot, ".run.lock", "owner.json"), "utf8")),
		).toMatchObject({ pid: process.pid });
		lock.release();
	});

	test("reclaims an empty lock left by a crash during acquisition", () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		mkdirSync(join(outputRoot, ".run.lock"));

		const lock = acquireRunLock(outputRoot);

		expect(
			JSON.parse(readFileSync(join(outputRoot, ".run.lock", "owner.json"), "utf8")),
		).toMatchObject({ pid: process.pid });
		lock.release();
	});

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
	test("stops before allocating beyond the frozen reserve list", async () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		const pendingCase = beginProvisionalCase({
			caseId: "SCORE-example",
			ordinal: 1,
			outputRoot,
		});
		let calls = 0;

		await expect(
			executeCaseWork({
				caseState: pendingCase,
				classify: () => ({ reason: "schema-invalid", retry: "never", status: "invalid" }),
				execute: async () => {
					calls += 1;
					return { raw: "semantic failure" };
				},
				outputRoot,
				reserveIds: [],
				state: {
					candidateQueueIds: [],
					currentCaseId: "SCORE-example",
					nextWorkIndex: 0,
					reserveIndex: 0,
					version: 3,
				},
				workId: "full--buggy--t1",
			}),
		).rejects.toThrow("frozen reserves exhausted");
		expect(calls).toBe(1);
		expect(readdirSync(pendingCase.provisionalPath)).toEqual([
			"full--buggy--t1--attempt-1.json",
		]);
		expect(existsSync(pendingCase.quarantinePath)).toBe(false);
	});

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
		"after-exclusion-write",
		"after-quarantine-rename",
		"after-state-write",
	] as const)("recovers from an injected production failure %s", async (failurePoint) => {
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
		const initialState = {
			candidateQueueIds: ["SCORE-next"],
			currentCaseId: "SCORE-example",
			nextWorkIndex: 1,
			reserveIndex: 0,
			version: 3,
		};

		expect(() =>
			quarantineCaseAndAllocateReserve({
				caseState,
				exclusion: { reason: "schema-invalid" },
				failurePoint: (point) => {
					if (point === failurePoint) throw new Error(`injected crash: ${point}`);
				},
				outputRoot,
				reserveIds: ["RESERVE-A"],
				state: initialState,
			}),
		).toThrow(`injected crash: ${failurePoint}`);

		const statePath = join(outputRoot, "run-state.json");
		const durableState = existsSync(statePath)
			? JSON.parse(readFileSync(statePath, "utf8"))
			: initialState;
		const recovered = recoverInterruptedQuarantine({
			caseState,
			outputRoot,
			reserveIds: ["RESERVE-A"],
			state: durableState,
		});

		expect(recovered).toMatchObject({
			candidateQueueIds: ["RESERVE-A", "SCORE-next"],
			currentCaseId: null,
			reserveIndex: 1,
		});
		expect(existsSync(caseState.provisionalPath)).toBe(false);
		expect(existsSync(caseState.quarantinePath)).toBe(true);
	});

	test("does not inspect reserve exhaustion until a terminal failure is durable", () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		const caseState = beginProvisionalCase({
			caseId: "SCORE-example",
			ordinal: 1,
			outputRoot,
		});
		const state = {
			candidateQueueIds: [],
			currentCaseId: "SCORE-example",
			nextWorkIndex: 0,
			reserveIndex: 0,
			version: 3,
		};

		expect(
			recoverInterruptedQuarantine({
				caseState,
				outputRoot,
				reserveIds: [],
				state,
			}),
		).toEqual(state);
	});

	test("recovers two thrown infrastructure attempts as one terminal exclusion", async () => {
		const outputRoot = mkdtempSync(join(tmpdir(), "cwgyh0-case-store-"));
		const caseState = beginProvisionalCase({
			caseId: "SCORE-example",
			ordinal: 1,
			outputRoot,
		});
		const sibling = await executeWithInfrastructureRetry(async () => ({
			report: { usage: { inputTokens: 10, outputTokens: 5 } },
		}));
		recordTrialResult(caseState, "narrow--fixed--t1", sibling);
		const failed = await executeWithInfrastructureRetry(async () => {
			throw new RequestError();
		});
		recordTrialResult(caseState, "full--buggy--t1", failed);
		const state = {
			candidateQueueIds: ["SCORE-next"],
			cumulativeCostUsd: 0,
			currentCaseId: "SCORE-example",
			exclusions: [] as unknown[],
			nextWorkIndex: 0,
			reserveIndex: 0,
			version: 3,
		};

		const recovered = recoverInterruptedQuarantine({
			caseState,
			outputRoot,
			reconcileExclusion: (current, evidence) => ({
				...current,
				cumulativeCostUsd: current.cumulativeCostUsd + 2,
				exclusions: [...current.exclusions, evidence],
			}),
			reserveIds: ["RESERVE-A"],
			state,
		});

		expect(recovered).toMatchObject({
			candidateQueueIds: ["RESERVE-A", "SCORE-next"],
			cumulativeCostUsd: 2,
			currentCaseId: null,
			exclusions: [
				{
					attemptRecords: [{ attempt: 1 }, { attempt: 2 }],
					caseId: "SCORE-example",
					replacementId: "RESERVE-A",
					workId: "full--buggy--t1",
				},
			],
			reserveIndex: 1,
		});
		expect(readdirSync(caseState.quarantinePath).sort()).toEqual([
			"EXCLUSION.json",
			"full--buggy--t1--attempt-1.json",
			"full--buggy--t1--attempt-2.json",
			"narrow--fixed--t1--attempt-1.json",
		]);
	});

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
