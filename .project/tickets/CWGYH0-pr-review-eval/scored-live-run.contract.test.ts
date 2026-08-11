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
		expect(scorer).toContain("verifyRawArtifactManifest({");
		expect(scorer).toContain("for (const relativePath of [...verifiedBytes.keys()]");
		expect(scorer).toContain('/^active\\/[^/]+\\/[^/]+--record\\.json$/');
		expect(runner).toContain("version: 3");
	});

	test("revalidates and consumes target-bound authorization at the paid-call boundary", () => {
		const runner = readFileSync(join(ticketRoot, "scored-live-run.ts"), "utf8");
		expect(runner).toContain("cumulativeCaseTarget,");
		expect(runner).toContain("cumulativeCostTargetUsd,");
		expect(runner).toContain("assertPaidAuthorization();");
		expect(runner).toContain('currentMarker.status !== "active"');
		expect(runner).toContain('status: "consumed"');
		expect(runner).toContain('const authorizationDirectory = join(outputRoot, "authorizations")');
	});

	test("describes the aggregate spend guard as a stop rather than a hard ceiling", () => {
		const runner = readFileSync(join(ticketRoot, "scored-live-run.ts"), "utf8");
		expect(runner).toContain("aggregateCostStopUsd");
		expect(runner).not.toContain("aggregateCostCeilingUsd");
	});

	test("loads optional finding verification only from manifest-verified bytes", () => {
		const scorer = readFileSync(join(ticketRoot, "score-results.ts"), "utf8");
		expect(scorer).toContain("readVerifiedJson<unknown>(verificationIdentity)");
		expect(scorer).not.toContain("readJson<unknown>(verificationPath)");
	});

	test("loads the pinned adapter and source repository from explicit runtime paths", () => {
		const runner = readFileSync(join(ticketRoot, "scored-live-run.ts"), "utf8");
		expect(runner).toContain('requireEnvironment("CWGYH0_ADAPTER_ROOT")');
		expect(runner).toContain('requireEnvironment("CWGYH0_SOURCE_REPOSITORY")');
		expect(runner).not.toContain("/Users/alex/.codex/worktrees");
		expect(runner).not.toContain("/Users/alex/Projects");
	});

	test("all wiring fixtures use the same pinned adapter loader as production", () => {
		for (const filename of [
			"scored-live-run.ts",
			"scored-real-wiring.fixture.ts",
			"scored-success-wiring.fixture.ts",
		]) {
			const source = readFileSync(join(ticketRoot, filename), "utf8");
			expect(source).toContain("loadPinnedAdapter");
			expect(source).not.toContain("/Users/alex/");
		}
	});
});
