import { describe, expect, test } from "vitest";

import {
	deriveScoreableMatrix,
	type MatrixRecord,
} from "./scored-matrix";

const systems = ["full", "narrow"] as const;
const variants = ["buggy", "fixed"] as const;
const trials = [1, 2, 3] as const;

function completeRecords(caseIds: readonly string[]): MatrixRecord[] {
	return caseIds.flatMap((caseId) =>
		systems.flatMap((system) =>
			variants.flatMap((variant) =>
				trials.map((trial) => ({ caseId, system, trial, usable: true, variant })),
			),
		),
	);
}

function completeInput() {
	return {
		allocations: [
			{ quarantinedCaseId: "PRIMARY-B", replacementCaseId: "RESERVE-A" },
		],
		preflight: {
			expectedRepositoryCount: 8,
			observedRepositoryCount: 8,
			status: "passed" as const,
		},
		primaryCaseIds: ["PRIMARY-A", "PRIMARY-B"],
		records: completeRecords(["PRIMARY-A", "RESERVE-A"]),
		reserveCaseIds: ["RESERVE-A", "RESERVE-B"],
		systems,
		trials,
		variants,
	};
}

describe("scoreable matrix derivation", () => {
	test("derives a complete effective matrix from primaries and allocated reserves", () => {
		const result = deriveScoreableMatrix(completeInput());

		expect(result.effectiveCaseIds).toEqual(["PRIMARY-A", "RESERVE-A"]);
		expect(result.admittedRecords).toHaveLength(24);
		expect(result.gates).toEqual({
			allCasesComplete: true,
			contaminationPreflightPassed: true,
		});
	});

	test.each([
		["one unusable reviewer trial", (records: MatrixRecord[]) => {
			records[0] = { ...records[0]!, usable: false };
		}],
		["one missing trial", (records: MatrixRecord[]) => records.splice(0, 1)],
		["one duplicate trial number", (records: MatrixRecord[]) => {
			records[1] = { ...records[1]!, trial: 1 };
		}],
		["one unexpected extra trial", (records: MatrixRecord[]) => {
			records[2] = { ...records[2]!, trial: 4 };
		}],
		["one empty system and variant cell", (records: MatrixRecord[]) => {
			const filtered = records.filter(
				(record) => !(record.caseId === "PRIMARY-A" && record.system === "full" && record.variant === "buggy"),
			);
			records.splice(0, records.length, ...filtered);
		}],
		["one frozen case missing entirely", (records: MatrixRecord[]) => {
			const filtered = records.filter((record) => record.caseId !== "PRIMARY-A");
			records.splice(0, records.length, ...filtered);
		}],
		["one unexpected case", (records: MatrixRecord[]) => {
			records.push({ ...records[0]!, caseId: "UNKNOWN" });
		}],
		["one frozen system missing entirely", (records: MatrixRecord[]) => {
			const filtered = records.filter((record) => record.system !== "narrow");
			records.splice(0, records.length, ...filtered);
		}],
		["one unexpected system or variant cell", (records: MatrixRecord[]) => {
			records.push({ ...records[0]!, system: "other" });
		}],
	] as const)("rejects %s", (defect, mutate) => {
		const input = completeInput();
		mutate(input.records);

		expect(() => deriveScoreableMatrix(input)).toThrow(defect);
	});

	test("rejects exact trial set 2, 3, and 4 even though it has three distinct trials", () => {
		const input = completeInput();
		for (const record of input.records) {
			if (record.caseId === "PRIMARY-A" && record.system === "full" && record.variant === "buggy") {
				record.trial += 1;
			}
		}

		expect(() => deriveScoreableMatrix(input)).toThrow(
			"PRIMARY-A:full:buggy must contain exactly trials 1, 2, 3",
		);
	});

	test("rejects records from a quarantined primary or unused reserve", () => {
		for (const caseId of ["PRIMARY-B", "RESERVE-B"]) {
			const input = completeInput();
			input.records.push({ ...input.records[0]!, caseId });

			expect(() => deriveScoreableMatrix(input)).toThrow(
				`unexpected case: ${caseId}`,
			);
		}
	});

	test.each([
		["a failed preflight", { expectedRepositoryCount: 8, observedRepositoryCount: 8, status: "failed" }],
		["a partial preflight", { expectedRepositoryCount: 8, observedRepositoryCount: 7, status: "passed" }],
	] as const)("derives a false contamination gate from %s", (_label, preflight) => {
		const result = deriveScoreableMatrix({ ...completeInput(), preflight });

		expect(result.gates.contaminationPreflightPassed).toBe(false);
	});
});
