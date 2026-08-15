import { createHash } from "node:crypto";

import { describe, expect, test } from "vitest";

import {
	bindContaminationPreflight,
	validateVerifications,
} from "./scored-evidence";

const finding = {
	caseId: "CASE-A",
	file: "src/example.ts",
	line: 7,
	system: "full" as const,
	title: "Wrong result",
	trial: 2,
	variant: "buggy" as const,
};

describe("scorer evidence validation", () => {
	test("accepts one complete verification for a scoreable finding", () => {
		expect(
			validateVerifications(
				{
					entries: [{ ...finding, classification: "proved", evidence: "Test reproduces it." }],
				},
				[finding],
			),
		).toHaveLength(1);
	});

	test.each([
		["unsupported classification", { ...finding, classification: "likely", evidence: "proof" }],
		["empty evidence", { ...finding, classification: "proved", evidence: "   " }],
		["malformed location", { ...finding, classification: "proved", evidence: "proof", line: 0 }],
		["unknown finding", { ...finding, classification: "proved", evidence: "proof", title: "Other" }],
	])("rejects %s", (_label, entry) => {
		expect(() => validateVerifications({ entries: [entry] }, [finding])).toThrow();
	});

	test("rejects duplicate verification keys", () => {
		const entry = { ...finding, classification: "proved", evidence: "proof" };
		expect(() => validateVerifications({ entries: [entry, entry] }, [finding])).toThrow(
			"duplicate verification",
		);
	});

	test("does not reuse one verification across systems or trials", () => {
		const entry = { ...finding, classification: "proved", evidence: "proof" };
		const otherTrial = { ...finding, trial: 3 };
		expect(validateVerifications({ entries: [entry] }, [finding, otherTrial])).toHaveLength(1);
		expect(() =>
			validateVerifications(
				{ entries: [{ ...entry, trial: 4 }] },
				[finding, otherTrial],
			),
		).toThrow("scoreable finding");
	});

	test("binds contamination evidence to the exact preflight bytes and run identity", () => {
		const preflight = {
			preflightId: "preflight-123",
			preflightedRepositories: 2,
			primaryCases: ["CASE-A"],
			reserveCases: [],
			sourceRepositoryIdentity: "git@example.test:owner/repository.git",
			status: "passed",
		};
		const bytes = `${JSON.stringify(preflight)}\n`;
		const binding = {
			preflightId: preflight.preflightId,
			preflightSha256: createHash("sha256").update(bytes).digest("hex"),
			sourceRepositoryIdentity: preflight.sourceRepositoryIdentity,
		};
		expect(bindContaminationPreflight(bytes, binding)).toEqual(preflight);
		expect(() =>
			bindContaminationPreflight(bytes.replace('"passed"', '"failed"'), binding),
		).toThrow("digest");
		expect(() =>
			bindContaminationPreflight(bytes, { ...binding, preflightId: "another-run" }),
		).toThrow("run identity");
	});
});
