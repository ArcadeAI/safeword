import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { mean, pairedBootstrapInterval } from "./scored-analysis";

const seed = 5_453_573;
const bootstrapResamples = 1_000;
const trials = 3;
const systems = ["full", "narrow"] as const;
const variants = ["buggy", "fixed"] as const;

type SystemName = (typeof systems)[number];
type Variant = (typeof variants)[number];
type Finding = { file: string; line: number; title: string };
type RecordFile = {
	caseId: string;
	output: {
		report: { consolidated: { findings: Finding[] } };
		score: { matchingFindings: Finding[]; namedFailure: boolean };
	};
	system: SystemName;
	trial: number;
	variant: Variant;
};
type Verification = Finding & {
	caseId: string;
	classification: "proved" | "falsified" | "unverifiable";
	evidence: string;
	variant: Variant;
};

function requireArgument(index: number, name: string): string {
	const value = process.argv[index];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf8")) as T;
}

function findingKey(input: Finding & { caseId: string; variant: Variant }): string {
	return `${input.caseId}\u0000${input.variant}\u0000${input.file}\u0000${input.line}\u0000${input.title}`;
}

function isNamedFinding(record: RecordFile, finding: Finding): boolean {
	return record.output.score.matchingFindings.some(
		(match) =>
			match.file === finding.file &&
			match.line === finding.line &&
			match.title === finding.title,
	);
}

const outputRoot = requireArgument(2, "scored output directory");
const resultsPath = requireArgument(3, "results path");
const verificationPath = process.argv[4];
if (existsSync(resultsPath)) throw new Error(`refusing to overwrite ${resultsPath}`);

const summary = readJson<{
	completedCaseIds: string[];
	exclusions: unknown[];
	status: string;
}>(join(outputRoot, "run-summary.json"));
if (summary.status !== "completed" || summary.completedCaseIds.length !== 30) {
	throw new Error("scored run is incomplete");
}

const records: RecordFile[] = [];
const glob = new Bun.Glob("active/*/*.json");
for (const relativePath of glob.scanSync(outputRoot)) {
	const record = readJson<RecordFile>(join(outputRoot, relativePath));
	if (!systems.includes(record.system) || !variants.includes(record.variant)) {
		throw new Error(`unexpected record dimensions in ${relativePath}`);
	}
	records.push(record);
}
if (records.length !== 30 * systems.length * variants.length * trials) {
	throw new Error(`expected 360 completed records, found ${records.length}`);
}

const byCell = new Map<string, RecordFile[]>();
for (const record of records) {
	const key = `${record.caseId}:${record.system}:${record.variant}`;
	const cell = byCell.get(key) ?? [];
	cell.push(record);
	byCell.set(key, cell);
}
for (const caseId of summary.completedCaseIds) {
	for (const system of systems) {
		for (const variant of variants) {
			const cell = byCell.get(`${caseId}:${system}:${variant}`) ?? [];
			if (cell.length !== trials || new Set(cell.map((record) => record.trial)).size !== trials) {
				throw new Error(`${caseId}:${system}:${variant} does not have trials 1..3`);
			}
		}
	}
}

const caseRows = summary.completedCaseIds.map((caseId) => {
	const hitRate = (system: SystemName, variant: Variant): number =>
		mean(
			(byCell.get(`${caseId}:${system}:${variant}`) ?? []).map((record) =>
				record.output.score.namedFailure ? 1 : 0,
			),
		);
	return {
		caseId,
		fullBuggyRecall: hitRate("full", "buggy"),
		fullFixedNamedHitRate: hitRate("full", "fixed"),
		narrowBuggyRecall: hitRate("narrow", "buggy"),
		narrowFixedNamedHitRate: hitRate("narrow", "fixed"),
	};
});
const recallDifferences = caseRows.map(
	(row) => row.fullBuggyRecall - row.narrowBuggyRecall,
);
const recallInterval = pairedBootstrapInterval(
	recallDifferences,
	bootstrapResamples,
	seed,
);

const verifications = verificationPath
	? readJson<{ entries: Verification[] }>(verificationPath).entries
	: [];
const verificationByFinding = new Map(
	verifications.map((entry) => [findingKey(entry), entry]),
);
const classifications = {
	full: { falsified: 0, proved: 0, unverifiable: 0, unverifiedPending: 0 },
	narrow: { falsified: 0, proved: 0, unverifiable: 0, unverifiedPending: 0 },
};
for (const record of records) {
	for (const finding of record.output.report.consolidated.findings) {
		if (isNamedFinding(record, finding)) {
			classifications[record.system][record.variant === "buggy" ? "proved" : "falsified"] += 1;
			continue;
		}
		const verified = verificationByFinding.get(
			findingKey({ ...finding, caseId: record.caseId, variant: record.variant }),
		);
		if (verified === undefined) {
			classifications[record.system].unverifiedPending += 1;
		} else {
			classifications[record.system][verified.classification] += 1;
		}
	}
}

const silence = Object.fromEntries(
	systems.map((system) => [
		system,
		Object.fromEntries(
			variants.map((variant) => {
				const selected = records.filter(
					(record) => record.system === system && record.variant === variant,
				);
				const silent = selected.filter(
					(record) => record.output.report.consolidated.findings.length === 0,
				).length;
				return [variant, { rate: silent / selected.length, silent, total: selected.length }];
			}),
		),
	]),
);
const fullFixedNamedHits = records.filter(
	(record) =>
		record.system === "full" &&
		record.variant === "fixed" &&
		record.output.score.namedFailure,
).length;
const verificationComplete =
	classifications.full.unverifiedPending === 0 &&
	classifications.narrow.unverifiedPending === 0;
const gates = {
	allCasesComplete: true,
	contaminationPreflightPassed: true,
	fullHasNoDirectlyFalsifiedFindings: classifications.full.falsified === 0,
	fullHasNoFixedNamedHits: fullFixedNamedHits === 0,
	recallLower95AboveZero: recallInterval.lower95 > 0,
	verificationComplete,
};
const allGatesPass = Object.values(gates).every(Boolean);
const status = allGatesPass
	? "validates-full-over-narrow"
	: verificationComplete
		? "does-not-validate-full-over-narrow"
		: "provisional-awaiting-finding-verification";

await Bun.write(
	resultsPath,
	`${JSON.stringify(
		{
			bootstrapResamples,
			caseRows,
			classifications,
			exclusions: summary.exclusions,
			gates,
			recall: {
				full: mean(caseRows.map((row) => row.fullBuggyRecall)),
				fullMinusNarrow: recallInterval,
				narrow: mean(caseRows.map((row) => row.narrowBuggyRecall)),
			},
			seed,
			silence,
			status,
			trials,
		},
		null,
		2,
	)}\n`,
);
console.log(status);
