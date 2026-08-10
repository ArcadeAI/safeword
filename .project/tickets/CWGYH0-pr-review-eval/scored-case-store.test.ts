import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
	acquireRunLock,
	beginProvisionalCase,
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
});
