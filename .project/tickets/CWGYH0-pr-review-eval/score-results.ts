import { existsSync } from "node:fs";

import { mean, pairedBootstrapInterval } from "./scored-analysis";
import {
	loadPinnedManifestFromGit,
	verifyRawArtifactManifest,
} from "./scored-artifact-manifest";
import { loadGitHubEvidenceAnchor } from "./scored-evidence-anchor";
import { deriveScoreableMatrix } from "./scored-matrix";
import { classifyTrialOutput } from "./scored-run-policy";
import {
	bindContaminationPreflight,
	type EvidenceFinding,
	validateVerifications,
} from "./scored-evidence";

const seed = 5_453_573;
const bootstrapResamples = 1_000;
const trials = 3;
const systems = ["full", "narrow"] as const;
const variants = ["buggy", "fixed"] as const;
const expectedRoute = {
	expert: "correctness",
	model: "claude-sonnet-5",
	provider: "anthropic",
} as const;

type SystemName = (typeof systems)[number];
type Variant = (typeof variants)[number];
type Finding = { file: string; line: number; title: string };
type RecordFile = {
	caseId: string;
	output: {
		report: { consolidated: { findings: Finding[] } };
		score: { matchingFindings: Finding[]; namedFailure: boolean };
	};
	reviewBaseSha: string;
	runnerRef: string;
	sourceSha: string;
	system: SystemName;
	trial: number;
	variant: Variant;
};

function requireArgument(index: number, name: string): string {
	const value = process.argv[index];
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function findingKey(input: EvidenceFinding): string {
	return `${input.caseId}\u0000${input.variant}\u0000${input.system}\u0000${input.trial}\u0000${input.file}\u0000${input.line}\u0000${input.title}`;
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
const verificationIdentity = process.argv[4];
if (existsSync(resultsPath)) throw new Error(`refusing to overwrite ${resultsPath}`);

const rawAnchor = await loadGitHubEvidenceAnchor(
	process.env.CWGYH0_RAW_MANIFEST_ANCHOR_URL ??
		requireArgument(6, "raw manifest anchor URL"),
	"raw-manifest",
);
const pinnedManifest = loadPinnedManifestFromGit({
	commit: rawAnchor.commit,
	digestPath: rawAnchor.digestPath,
	expectedRepositoryIdentity: rawAnchor.repositoryIdentity,
	gitRoot: process.env.CWGYH0_RAW_MANIFEST_GIT_ROOT ??
		requireArgument(7, "raw manifest Git root"),
	manifestPath: rawAnchor.blobPath,
});
if (pinnedManifest.digest !== rawAnchor.digest) {
	throw new Error("raw manifest differs from independently retained issue anchor");
}
const verifiedRaw = verifyRawArtifactManifest({
	expectedManifestDigest: pinnedManifest.digest,
	manifestBytes: pinnedManifest.manifestBytes,
	retainedAt: rawAnchor.createdAt,
	reusedAt: new Date().toISOString(),
	root: outputRoot,
});
const verifiedBytes = new Map(
	verifiedRaw.artifacts.map((artifact) => [artifact.identity, artifact.bytes]),
);
const readVerifiedText = (identity: string): string => {
	const bytes = verifiedBytes.get(identity);
	if (bytes === undefined) throw new Error(`verified raw artifact is missing: ${identity}`);
	return new TextDecoder().decode(bytes);
};
const readVerifiedJson = <T>(identity: string): T => {
	return JSON.parse(readVerifiedText(identity)) as T;
};

const summary = readVerifiedJson<{
	completedCaseIds: string[];
	exclusions: Array<{ caseId: string; replacementId: string }>;
	primaryCases: string[];
	preflightId: string;
	preflightSha256: string;
	reserveCases: string[];
	sourceRepositoryIdentity: string;
	status: string;
}>("run-summary.json");
if (summary.status !== "completed") {
	throw new Error("scored run is incomplete");
}
const preflight = bindContaminationPreflight(
	readVerifiedText("contamination-preflight.json"), {
	preflightId: summary.preflightId,
	preflightSha256: summary.preflightSha256,
	sourceRepositoryIdentity: summary.sourceRepositoryIdentity,
});

const rawRecords: RecordFile[] = [];
for (const relativePath of [...verifiedBytes.keys()].filter((identity) =>
	/^active\/[^/]+\/[^/]+--record\.json$/.test(identity)
)) {
	const record = readVerifiedJson<RecordFile>(relativePath);
	if (!systems.includes(record.system) || !variants.includes(record.variant)) {
		throw new Error(`unexpected record dimensions in ${relativePath}`);
	}
	rawRecords.push(record);
}
const classifiedRecords = rawRecords.map((record) => {
	const disposition = classifyTrialOutput(record.output, expectedRoute, {
		caseId: record.caseId,
		reviewBaseSha: record.reviewBaseSha,
		runnerRef: record.runnerRef,
		sourceSha: record.sourceSha,
		variant: record.variant,
	});
	return { ...record, usable: disposition.status === "usable" };
});
const expectedRepositories =
	(summary.primaryCases.length + summary.reserveCases.length) * variants.length;
const matrix = deriveScoreableMatrix({
	allocations: summary.exclusions.map((exclusion) => ({
		quarantinedCaseId: exclusion.caseId,
		replacementCaseId: exclusion.replacementId,
	})),
	preflight: {
		expectedRepositoryCount: expectedRepositories,
		observedRepositoryCount: preflight.preflightedRepositories,
		status:
			JSON.stringify(preflight.primaryCases) ===
				JSON.stringify(summary.primaryCases) &&
			JSON.stringify(preflight.reserveCases) ===
				JSON.stringify(summary.reserveCases)
				? preflight.status
				: "mismatched",
	},
	primaryCaseIds: summary.primaryCases,
	records: classifiedRecords,
	reserveCaseIds: summary.reserveCases,
	systems,
	trials: Array.from({ length: trials }, (_, index) => index + 1),
	variants,
});
if (
	[...summary.completedCaseIds].sort().join("\u0000") !==
	[...matrix.effectiveCaseIds].sort().join("\u0000")
) {
	throw new Error("completed case IDs do not match the effective frozen matrix");
}
const records = matrix.admittedRecords;

const byCell = new Map<string, typeof records>();
for (const record of matrix.admittedRecords) {
	const key = `${record.caseId}:${record.system}:${record.variant}`;
	const cell = byCell.get(key) ?? [];
	cell.push(record);
	byCell.set(key, cell);
}

const caseRows = matrix.effectiveCaseIds.map((caseId) => {
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

const scoreableFindings: EvidenceFinding[] = records.flatMap((record) =>
	record.output.report.consolidated.findings
		.filter((finding) => !isNamedFinding(record, finding))
		.map((finding) => ({
			...finding,
			caseId: record.caseId,
			system: record.system,
			trial: record.trial,
			variant: record.variant,
		})),
);
const verifications = verificationIdentity
	? validateVerifications(readVerifiedJson<unknown>(verificationIdentity), scoreableFindings)
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
			findingKey({
				...finding,
				caseId: record.caseId,
				system: record.system,
				trial: record.trial,
				variant: record.variant,
			}),
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
	...matrix.gates,
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
