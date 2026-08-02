import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
} from "node:fs";
import { join } from "node:path";

import {
	createRunnerExecutor,
	type DevelopmentCase,
	type DevelopmentReviewInput,
	type DevelopmentVariant,
	loadDevelopmentManifest,
} from "/private/tmp/cwgyh0-pr-review-adapter-PxYDro/tools/pr-review/src/eval/development-benchmark";
import {
	executeWithInfrastructureRetry,
	shuffleFrozen,
} from "./scored-run-policy";

const ticketRoot =
	"/Users/alex/.codex/worktrees/1fb8/safeword/.project/tickets/CWGYH0-pr-review-eval";
const sourceRepository = "/Users/alex/Projects/arcade-monorepo";
const adapterRoot = "/private/tmp/cwgyh0-pr-review-adapter-PxYDro";
const primaryManifestPath = join(
	ticketRoot,
	"scored-cases-frozen-2026-08-01.json",
);
const reserveManifestPath = join(
	ticketRoot,
	"reserve-cases-frozen-2026-08-01.json",
);
const experts = {
	full: join(ticketRoot, "scored-prompts/full"),
	narrow: join(ticketRoot, "scored-prompts/narrow"),
} as const;
const expectedHashes = {
	primaryManifest:
		"6180519f4d72f5b082baae9cd14af7848786f7601359ed1c3625769ef4146bc7",
	reserveManifest:
		"df4c1ae9fcff16c30bd24b30f54ffc6ebacd03a5e4f5796b5334fe773f360803",
	fullCorrectness:
		"95c67724efddc44716f0933709aa64a0f48ce4b96bf7c0692b696f29d3c2a712",
	fullVerifier:
		"cfbabd76b53d0c41a955bd4330c4103bed357f905214718fc4e6819ff79454c5",
	narrowCorrectness:
		"6868edf3a04758d2a46eaa040ff14e121e9fd767fa10ad8f044e0c8791a051b5",
	narrowVerifier:
		"cfbabd76b53d0c41a955bd4330c4103bed357f905214718fc4e6819ff79454c5",
};
const expectedAdapterCommit = "8d86720c09361577373a353b0f2e4810c4423c8a";
const expectedRunnerRef = "codex/cwgyh0-dev-benchmark-adapter@8d86720c0";
const model = "claude-sonnet-5";
const trials = 3;
const seed = 5_453_573;
const aggregateCostCeilingUsd = 1_000;
const inputPricePerMillionUsd = 3;
const outputPricePerMillionUsd = 15;
const policy = {
	maxVerifications: 25,
	toolCallsPerExpert: 40,
	wallClockMsPerExpert: 360_000,
};
const scratchRoot = requireEnvironment("CWGYH0_SCRATCH_ROOT");
const outputRoot = requireEnvironment("CWGYH0_OUTPUT_ROOT");
const preflightOnly = process.env.CWGYH0_PREFLIGHT_ONLY === "1";

type RawCase = DevelopmentCase & {
	testPatchPaths: string[];
	testPatchSha: string;
};
type RawManifest = {
	cases: RawCase[];
	modelCutoff: string;
	runnerRef: string;
};
type SystemName = keyof typeof experts;
type WorkItem = {
	item: RawCase;
	system: SystemName;
	trial: number;
	variant: DevelopmentVariant;
};

function requireEnvironment(name: string): string {
	const value = process.env[name];
	if (value === undefined || value.length === 0) {
		throw new Error(`${name} is required`);
	}
	return value;
}

function runGit(cwd: string, args: string[]): string {
	const result = Bun.spawnSync(["git", ...args], {
		cwd,
		stderr: "pipe",
		stdout: "pipe",
	});
	if (result.exitCode !== 0) {
		throw new Error(
			`git ${args[0] ?? "command"} failed: ${result.stderr.toString().trim()}`,
		);
	}
	return result.stdout.toString().trim();
}

function gitSucceeds(cwd: string, args: string[]): boolean {
	return Bun.spawnSync(["git", ...args], {
		cwd,
		stderr: "pipe",
		stdout: "pipe",
	}).exitCode === 0;
}

function objectExists(repository: string, sha: string): boolean {
	return gitSucceeds(repository, ["cat-file", "-e", `${sha}^{commit}`]);
}

function sha256(path: string): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(readFileSync(path));
	return hasher.digest("hex");
}

function assertHash(path: string, expected: string): void {
	const actual = sha256(path);
	if (actual !== expected) {
		throw new Error(`frozen hash mismatch for ${path}: ${actual}`);
	}
}

function safeName(value: string): string {
	return value.replaceAll(/[^A-Za-z0-9._-]/g, "-");
}

function sourceSha(item: RawCase, variant: DevelopmentVariant): string {
	return variant === "buggy" ? item.baseSha : item.fixedSha;
}

function forbiddenObjects(item: RawCase, variant: DevelopmentVariant): string[] {
	return variant === "buggy"
		? [item.fixedSha, item.testPatchSha]
		: [item.testPatchSha];
}

function readRawManifest(path: string): RawManifest {
	return JSON.parse(readFileSync(path, "utf8")) as RawManifest;
}

function changedPaths(from: string, to: string): Set<string> {
	return new Set(
		runGit(sourceRepository, ["diff", "--name-only", from, to])
			.split("\n")
			.filter(Boolean),
	);
}

function certifyCase(item: RawCase, cutoff: Date): void {
	for (const sha of [
		item.reviewBaseSha,
		item.baseSha,
		item.fixedSha,
		item.testPatchSha,
	]) {
		if (!objectExists(sourceRepository, sha)) {
			throw new Error(`${item.id}: missing frozen object ${sha}`);
		}
	}
	if (
		!gitSucceeds(sourceRepository, [
			"merge-base",
			"--is-ancestor",
			item.reviewBaseSha,
			item.baseSha,
		])
	) {
		throw new Error(`${item.id}: review base is not an ancestor of buggy head`);
	}
	const fixedParents = runGit(sourceRepository, [
		"rev-list",
		"--parents",
		"-n",
		"1",
		item.fixedSha,
	]).split(" ");
	if (fixedParents.length !== 2 || fixedParents[1] !== item.baseSha) {
		throw new Error(`${item.id}: fixed twin is not a direct child of buggy head`);
	}
	if (
		gitSucceeds(sourceRepository, [
			"merge-base",
			"--is-ancestor",
			item.testPatchSha,
			item.fixedSha,
		])
	) {
		throw new Error(`${item.id}: fixed twin descends from private grader`);
	}
	const originalPaths = changedPaths(item.reviewBaseSha, item.baseSha);
	if (!item.causalPaths.some((path) => originalPaths.has(path))) {
		throw new Error(`${item.id}: no causal path is in the original PR diff`);
	}
	for (const path of item.causalPaths) {
		if (!gitSucceeds(sourceRepository, ["cat-file", "-e", `${item.baseSha}:${path}`])) {
			throw new Error(`${item.id}: causal path is absent from reviewed tree: ${path}`);
		}
	}
	const fixedPaths = changedPaths(item.baseSha, item.fixedSha);
	if (fixedPaths.size === 0) {
		throw new Error(`${item.id}: fixed twin has no production change`);
	}
	for (const path of item.testPatchPaths) {
		if (fixedPaths.has(path)) {
			throw new Error(`${item.id}: fixed twin leaks grader path: ${path}`);
		}
	}
	const graderPaths = new Set(
		runGit(sourceRepository, [
			"diff-tree",
			"--no-commit-id",
			"--name-only",
			"-r",
			item.testPatchSha,
		])
			.split("\n")
			.filter(Boolean),
	);
	for (const path of item.testPatchPaths) {
		if (!graderPaths.has(path)) {
			throw new Error(`${item.id}: grader commit does not contain ${path}`);
		}
	}
	const committedAt = new Date(
		runGit(sourceRepository, ["show", "-s", "--format=%cI", item.baseSha]),
	);
	if (Number.isNaN(committedAt.valueOf()) || committedAt <= cutoff) {
		throw new Error(`${item.id}: buggy head is not after model cutoff`);
	}
}

function validateFrozenInputs(
	primary: RawManifest,
	reserve: RawManifest,
): RawCase[] {
	assertHash(primaryManifestPath, expectedHashes.primaryManifest);
	assertHash(reserveManifestPath, expectedHashes.reserveManifest);
	assertHash(
		join(experts.full, "correctness.md"),
		expectedHashes.fullCorrectness,
	);
	assertHash(join(experts.full, "verifier.md"), expectedHashes.fullVerifier);
	assertHash(
		join(experts.narrow, "correctness.md"),
		expectedHashes.narrowCorrectness,
	);
	assertHash(join(experts.narrow, "verifier.md"), expectedHashes.narrowVerifier);
	if (runGit(adapterRoot, ["rev-parse", "HEAD"]) !== expectedAdapterCommit) {
		throw new Error("adapter commit does not match the frozen runner");
	}
	if (runGit(adapterRoot, ["status", "--porcelain", "--untracked-files=no"])) {
		throw new Error("adapter has tracked modifications");
	}
	if (primary.cases.length !== 30 || reserve.cases.length !== 10) {
		throw new Error("frozen corpus must contain 30 primary and 10 reserve cases");
	}
	if (
		primary.modelCutoff !== reserve.modelCutoff ||
		primary.runnerRef !== expectedRunnerRef ||
		reserve.runnerRef !== expectedRunnerRef
	) {
		throw new Error("frozen manifests disagree on cutoff or runner reference");
	}
	for (const directory of Object.values(experts)) {
		for (const filename of ["correctness.md", "verifier.md"]) {
			const prompt = readFileSync(join(directory, filename), "utf8");
			if (!prompt.includes(`model: ${model}`) || !prompt.includes("effort: high")) {
				throw new Error(`${directory}/${filename}: model or effort drift`);
			}
		}
	}
	const allCases = [...primary.cases, ...reserve.cases];
	const ids = new Set<string>();
	const boundaries = new Set<string>();
	const cutoff = new Date(primary.modelCutoff);
	if (Number.isNaN(cutoff.valueOf())) throw new Error("invalid model cutoff");
	for (const item of allCases) {
		const boundary = `${item.reviewBaseSha}..${item.baseSha}`;
		if (ids.has(item.id)) throw new Error(`duplicate case ID: ${item.id}`);
		if (boundaries.has(boundary)) {
			throw new Error(`duplicate original PR boundary: ${boundary}`);
		}
		ids.add(item.id);
		boundaries.add(boundary);
		certifyCase(item, cutoff);
	}
	return allCases;
}

function prepareSafeRepository(
	item: RawCase,
	variant: DevelopmentVariant,
): string {
	const repository = join(
		scratchRoot,
		"safe-repositories",
		`${safeName(item.id)}--${variant}.git`,
	);
	mkdirSync(join(scratchRoot, "safe-repositories"), { recursive: true });
	runGit(scratchRoot, ["init", "--bare", repository]);
	runGit(repository, [
		"fetch",
		"--no-tags",
		sourceRepository,
		`${sourceSha(item, variant)}:refs/heads/snapshot`,
	]);
	runGit(repository, ["symbolic-ref", "HEAD", "refs/heads/snapshot"]);
	runGit(repository, ["reflog", "expire", "--expire=now", "--all"]);
	runGit(repository, ["gc", "--prune=now"]);
	if (!objectExists(repository, item.reviewBaseSha)) {
		throw new Error(`${item.id} ${variant}: frozen review base is absent`);
	}
	for (const forbidden of forbiddenObjects(item, variant)) {
		if (objectExists(repository, forbidden)) {
			throw new Error(`${item.id} ${variant}: forbidden object ${forbidden} is visible`);
		}
	}
	const unreachable = runGit(repository, [
		"fsck",
		"--unreachable",
		"--no-reflogs",
	]);
	if (unreachable.length > 0) {
		throw new Error(`${item.id} ${variant}: unreachable Git objects remain`);
	}
	return repository;
}

function createTrialClone(
	safeRepository: string,
	work: WorkItem,
	caseOrdinal: number,
	callOrdinal: number,
): string {
	const root = join(
		scratchRoot,
		"trials",
		`${String(caseOrdinal).padStart(2, "0")}--${String(callOrdinal).padStart(2, "0")}--${work.system}--${safeName(work.item.id)}--${work.variant}--t${work.trial}`,
	);
	mkdirSync(join(scratchRoot, "trials"), { recursive: true });
	runGit(scratchRoot, [
		"clone",
		"--shared",
		"--no-checkout",
		safeRepository,
		root,
	]);
	runGit(root, ["checkout", "--detach", sourceSha(work.item, work.variant)]);
	runGit(root, ["remote", "remove", "origin"]);
	runGit(root, ["reflog", "expire", "--expire=now", "--all"]);
	for (const forbidden of forbiddenObjects(work.item, work.variant)) {
		if (objectExists(root, forbidden)) {
			throw new Error(`${work.item.id}: trial clone exposes forbidden ${forbidden}`);
		}
	}
	return root;
}

function serializeError(error: unknown): Record<string, unknown> {
	if (!(error instanceof Error)) return { message: String(error) };
	const details: Record<string, unknown> = {
		message: error.message,
		name: error.name,
	};
	if ("raw" in error && typeof error.raw === "string") details.raw = error.raw;
	if ("status" in error && typeof error.status === "number") {
		details.status = error.status;
	}
	return details;
}

function estimatedCost(output: {
	report: unknown;
}): { costUsd: number; inputTokens: number; outputTokens: number } {
	const report = output.report as {
		usage: { inputTokens: number; outputTokens: number };
	};
	const { inputTokens, outputTokens } = report.usage;
	return {
		costUsd:
			(inputTokens * inputPricePerMillionUsd +
				outputTokens * outputPricePerMillionUsd) /
			1_000_000,
		inputTokens,
		outputTokens,
	};
}

if (existsSync(outputRoot)) {
	throw new Error(`refusing to overwrite existing output directory: ${outputRoot}`);
}
if (existsSync(scratchRoot)) {
	throw new Error(`scratch root must not already exist: ${scratchRoot}`);
}
mkdirSync(outputRoot, { recursive: true });
mkdirSync(scratchRoot, { recursive: true });

loadDevelopmentManifest(primaryManifestPath);
loadDevelopmentManifest(reserveManifestPath);
const primary = readRawManifest(primaryManifestPath);
const reserve = readRawManifest(reserveManifestPath);
const allCases = validateFrozenInputs(primary, reserve);
const safeRepositories = new Map<string, string>();
for (const item of allCases) {
	for (const variant of ["buggy", "fixed"] as const) {
		safeRepositories.set(
			`${item.id}:${variant}`,
			prepareSafeRepository(item, variant),
		);
	}
}

const frozenRun = {
	aggregateCostCeilingUsd,
	expectedAdapterCommit,
	expectedHashes,
	inputPricePerMillionUsd,
	model,
	outputPricePerMillionUsd,
	policy,
	primaryCases: primary.cases.map((item) => item.id),
	reserveCases: reserve.cases.map((item) => item.id),
	seed,
	trials,
};

if (preflightOnly) {
	await Bun.write(
		join(outputRoot, "preflight.json"),
		`${JSON.stringify(
			{
				...frozenRun,
				completedAt: new Date().toISOString(),
				preflightedRepositories: safeRepositories.size,
				status: "passed",
			},
			null,
			2,
		)}\n`,
	);
	console.log(`preflight passed for ${allCases.length} cases / ${safeRepositories.size} snapshots`);
} else {
	const candidateQueue = shuffleFrozen(primary.cases, seed);
	let reserveIndex = 0;
	let completedCases = 0;
	let attemptedCases = 0;
	let cumulativeCostUsd = 0;
	const exclusions: Array<Record<string, unknown>> = [];
	const completedCaseIds: string[] = [];
	mkdirSync(join(outputRoot, "active"), { recursive: true });
	mkdirSync(join(outputRoot, "quarantine"), { recursive: true });

	while (completedCases < primary.cases.length) {
		const item = candidateQueue.shift();
		if (item === undefined) throw new Error("candidate queue exhausted");
		attemptedCases += 1;
		const caseDirectory = join(
			outputRoot,
			"active",
			`${String(attemptedCases).padStart(2, "0")}--${safeName(item.id)}`,
		);
		mkdirSync(caseDirectory, { recursive: true });
		const work = shuffleFrozen(
			(["full", "narrow"] as const).flatMap((system) =>
				(["buggy", "fixed"] as const).flatMap((variant) =>
					Array.from({ length: trials }, (_, index) => ({
						item,
						system,
						trial: index + 1,
						variant,
					})),
				),
			),
			seed + attemptedCases,
		);
		let excluded = false;
		for (const [workIndex, current] of work.entries()) {
			const callOrdinal = workIndex + 1;
			if (cumulativeCostUsd >= aggregateCostCeilingUsd) {
				throw new Error(`aggregate cost ceiling reached: $${cumulativeCostUsd.toFixed(2)}`);
			}
			const safeRepository = safeRepositories.get(
				`${item.id}:${current.variant}`,
			);
			if (safeRepository === undefined) throw new Error("safe repository vanished");
			const root = createTrialClone(
				safeRepository,
				current,
				attemptedCases,
				callOrdinal,
			);
			const execute = createRunnerExecutor({
				env: process.env,
				expertsDir: experts[current.system],
				policy,
				targetFor: () => ({ baseRef: item.reviewBaseSha, root }),
			});
			const reviewInput: DevelopmentReviewInput = {
				caseId: item.id,
				causalPaths: item.causalPaths,
				failureDescription: item.failureDescription,
				modelCutoff: primary.modelCutoff,
				reviewBaseSha: item.reviewBaseSha,
				runnerRef: primary.runnerRef,
				sourceSha: sourceSha(item, current.variant),
				variant: current.variant,
			};
			const startedAt = new Date().toISOString();
			const started = performance.now();
			console.log(
				`case ${completedCases + 1}/30 call ${callOrdinal}/12: ${current.system} ${item.id} ${current.variant} t${current.trial}`,
			);
			try {
				const result = await executeWithInfrastructureRetry(() => execute(reviewInput));
				if (result.status === "exclude-case") {
					excluded = true;
					const exclusion = {
						caseId: item.id,
						failedWork: current,
						infrastructureErrors: result.infrastructureErrors,
						recordedAt: new Date().toISOString(),
					};
					exclusions.push(exclusion);
					await Bun.write(
						join(caseDirectory, `${String(callOrdinal).padStart(2, "0")}--EXCLUDED.json`),
						`${JSON.stringify(exclusion, null, 2)}\n`,
					);
					break;
				}
				const usage = estimatedCost(result.value);
				cumulativeCostUsd += usage.costUsd;
				const record = {
					...reviewInput,
					attempts: result.attempts,
					completedAt: new Date().toISOString(),
					cumulativeCostUsd,
					durationMs: Math.round(performance.now() - started),
					frozenRun,
					infrastructureErrors: result.infrastructureErrors,
					output: result.value,
					startedAt,
					system: current.system,
					trial: current.trial,
					usage,
				};
				await Bun.write(
					join(
						caseDirectory,
						`${String(callOrdinal).padStart(2, "0")}--${current.system}--${current.variant}--t${current.trial}.json`,
					),
					`${JSON.stringify(record, null, 2)}\n`,
				);
				if (cumulativeCostUsd > aggregateCostCeilingUsd) {
					throw new Error(`aggregate cost ceiling exceeded: $${cumulativeCostUsd.toFixed(2)}`);
				}
			} catch (error) {
				await Bun.write(
					join(caseDirectory, `${String(callOrdinal).padStart(2, "0")}--FAILED.json`),
					`${JSON.stringify(
						{
							...reviewInput,
							durationMs: Math.round(performance.now() - started),
							error: serializeError(error),
							startedAt,
							system: current.system,
							trial: current.trial,
						},
						null,
						2,
					)}\n`,
				);
				throw error;
			}
		}

		if (excluded) {
			const quarantine = join(
				outputRoot,
				"quarantine",
				`${String(attemptedCases).padStart(2, "0")}--${safeName(item.id)}`,
			);
			renameSync(caseDirectory, quarantine);
			const replacement = reserve.cases[reserveIndex];
			if (replacement === undefined) {
				throw new Error("frozen reserves exhausted after infrastructure exclusions");
			}
			reserveIndex += 1;
			candidateQueue.unshift(replacement);
			continue;
		}
		completedCases += 1;
		completedCaseIds.push(item.id);
	}

	await Bun.write(
		join(outputRoot, "run-summary.json"),
		`${JSON.stringify(
			{
				...frozenRun,
				completedAt: new Date().toISOString(),
				completedCaseIds,
				cumulativeCostUsd,
				exclusions,
				status: "completed",
			},
			null,
			2,
		)}\n`,
	);
	console.log(
		`completed 30 cases with ${exclusions.length} exclusion(s), estimated cost $${cumulativeCostUsd.toFixed(2)}`,
	);
}
