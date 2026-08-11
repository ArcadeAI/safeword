import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

const ticketRoot = import.meta.dirname;

describe("live scored-run lifecycle wiring", () => {
	test("routes case admission, exclusion, locking, and scoring through durable boundaries", () => {
		const runner = readFileSync(join(ticketRoot, "scored-live-run.ts"), "utf8");
		const scorer = readFileSync(join(ticketRoot, "score-results.ts"), "utf8");

		for (const lifecycleCall of [
			"acquireRunLock(outputRoot)",
			"beginProvisionalCase(",
			"commitAdmittedCaseWork({ caseState, record, state, statePath, workId })",
			"quarantineCaseAndAllocateReserve({",
			"sealActiveCase(caseState)",
		]) {
			expect(runner).toContain(lifecycleCall);
		}
		expect(runner).not.toMatch(/join\(\s*outputRoot,\s*"active",/);
		expect(scorer).toContain('new Bun.Glob("active/*/*--record.json")');
		expect(runner).toContain("version: 3");
	});

	test("describes the aggregate spend guard as a stop rather than a hard ceiling", () => {
		const runner = readFileSync(join(ticketRoot, "scored-live-run.ts"), "utf8");
		expect(runner).toContain("aggregateCostStopUsd");
		expect(runner).not.toContain("aggregateCostCeilingUsd");
	});

	test("loads the pinned adapter and source repository from explicit runtime paths", () => {
		const runner = readFileSync(join(ticketRoot, "scored-live-run.ts"), "utf8");
		expect(runner).toContain('requireEnvironment("CWGYH0_ADAPTER_ROOT")');
		expect(runner).toContain('requireEnvironment("CWGYH0_SOURCE_REPOSITORY")');
		expect(runner).not.toContain("/Users/alex/.codex/worktrees");
		expect(runner).not.toContain("/Users/alex/Projects");
	});
});
