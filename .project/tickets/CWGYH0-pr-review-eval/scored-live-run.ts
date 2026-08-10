import {
	existsSync,
	mkdirSync,
	readdirSync,
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
} from "/Users/alex/.codex/worktrees/ec04/arcade-pr-review/tools/pr-review/src/eval/development-benchmark.ts";
import {
	classifyTrialOutput,
	executeWithInfrastructureRetry,
	parseCumulativeCaseTarget,
	parseCumulativeCostTarget,
	shuffleFrozen,
} from "./scored-run-policy";

const ticketRoot = import.meta.dir;
const sourceRepository = "/Users/alex/Projects/arcade-monorepo";
const adapterRoot = "/Users/alex/.codex/worktrees/ec04/arcade-pr-review";
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
const expectedAdapterCommit = "b9b8d1f26af118b6a9d5c1e4b658bd96f3aee09a";
const expectedRunnerRef = "codex/cwgyh0-dev-benchmark-adapter@b9b8d1f26";
const preregisteredRunnerRef = "codex/cwgyh0-dev-benchmark-adapter@8d86720c0";
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
const cumulativeCaseTarget = parseCumulativeCaseTarget(
	process.env.CWGYH0_CASE_TARGET,
	30,
);
const cumulativeCostTargetUsd = parseCumulativeCostTarget(
	process.env.CWGYH0_COST_TARGET_USD,
	aggregateCostCeilingUsd,
);

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
type RunState = {
	attemptedCases: number;
	candidateQueueIds: string[];
	completedCaseIds: string[];
	completedCases: number;
	cumulativeCostUsd: number;
	currentCaseId: string | null;
	exclusions: Array<Record<string, unknown>>;
	frozenRun: Record<string, unknown>;
	nextWorkIndex: number;
	reserveIndex: number;
	version: 2;
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
		primary.runnerRef !== preregisteredRunnerRef ||
		reserve.runnerRef !== preregisteredRunnerRef
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

function estimatedAttemptCost(
	attemptRecords: readonly { output: { report: unknown } | null }[],
): { costUsd: number; inputTokens: number; outputTokens: number } {
	return attemptRecords.reduce(
		(total, attempt) => {
			if (attempt.output === null) return total;
			const usage = estimatedCost(attempt.output);
			return {
				costUsd: total.costUsd + usage.costUsd,
				inputTokens: total.inputTokens + usage.inputTokens,
				outputTokens: total.outputTokens + usage.outputTokens,
			};
		},
		{ costUsd: 0, inputTokens: 0, outputTokens: 0 },
	);
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
	const temporaryPath = `${path}.tmp`;
	await Bun.write(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
	renameSync(temporaryPath, path);
}

function directoryEntryCount(path: string): number {
	return existsSync(path) ? readdirSync(path).length : 0;
}

const resuming = existsSync(outputRoot);
if (preflightOnly && resuming) {
	throw new Error(`refusing to overwrite existing output directory: ${outputRoot}`);
}
if (existsSync(scratchRoot)) {
	throw new Error(`scratch root must not already exist: ${scratchRoot}`);
}
if (!resuming) mkdirSync(outputRoot, { recursive: true });
mkdirSync(scratchRoot, { recursive: true });

loadDevelopmentManifest(primaryManifestPath);
loadDevelopmentManifest(reserveManifestPath);
const primary = readRawManifest(primaryManifestPath);
const reserve = readRawManifest(reserveManifestPath);
const allCases = validateFrozenInputs(primary, reserve);
const safeRepositories = new Map<string, string>();

const frozenRun = {
	aggregateCostCeilingUsd,
	expectedAdapterCommit,
	expectedRunnerRef,
	expectedHashes,
	inputPricePerMillionUsd,
	model,
	outputPricePerMillionUsd,
	policy,
	preregisteredRunnerRef,
	primaryCases: primary.cases.map((item) => item.id),
	reserveCases: reserve.cases.map((item) => item.id),
	seed,
	trials,
};

if (preflightOnly) {
	for (const item of allCases) {
		for (const variant of ["buggy", "fixed"] as const) {
			safeRepositories.set(
				`${item.id}:${variant}`,
				prepareSafeRepository(item, variant),
			);
		}
	}
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
	mkdirSync(join(outputRoot, "active"), { recursive: true });
	mkdirSync(join(outputRoot, "quarantine"), { recursive: true });
	const statePath = join(outputRoot, "run-state.json");
	const casesById = new Map(allCases.map((item) => [item.id, item]));
	let state: RunState;
	if (resuming) {
		if (!existsSync(statePath)) {
			throw new Error("existing scored output has no resumable run-state.json");
		}
		state = JSON.parse(readFileSync(statePath, "utf8")) as RunState;
		if (state.version !== 2 || JSON.stringify(state.frozenRun) !== JSON.stringify(frozenRun)) {
			throw new Error("saved run state does not match the frozen benchmark");
		}
		const recordedCaseDirectories =
			directoryEntryCount(join(outputRoot, "active")) +
			directoryEntryCount(join(outputRoot, "quarantine"));
		if (recordedCaseDirectories !== state.attemptedCases) {
			throw new Error(
				"scored output contains an interrupted case and cannot be resumed safely",
			);
		}
	} else {
		state = {
			attemptedCases: 0,
			candidateQueueIds: shuffleFrozen(primary.cases, seed).map((item) => item.id),
			completedCaseIds: [],
			completedCases: 0,
			cumulativeCostUsd: 0,
			currentCaseId: null,
			exclusions: [],
			frozenRun,
			nextWorkIndex: 0,
			reserveIndex: 0,
			version: 2,
		};
		await writeJsonAtomically(statePath, state);
	}
	if (cumulativeCaseTarget < state.completedCases) {
		throw new Error(
			`case target ${cumulativeCaseTarget} is behind ${state.completedCases} completed cases`,
		);
	}

	while (
		state.completedCases < primary.cases.length &&
		state.completedCases < cumulativeCaseTarget &&
		state.cumulativeCostUsd < cumulativeCostTargetUsd
	) {
		const continuingCase = state.currentCaseId !== null;
		const itemId = state.currentCaseId ?? state.candidateQueueIds.shift();
		const item = itemId === undefined ? undefined : casesById.get(itemId);
		if (item === undefined) throw new Error("candidate queue exhausted");
		if (!continuingCase) {
			state.attemptedCases += 1;
			state.currentCaseId = item.id;
			state.nextWorkIndex = 0;
			await writeJsonAtomically(statePath, state);
		}
		const caseDirectory = join(
			outputRoot,
			"active",
			`${String(state.attemptedCases).padStart(2, "0")}--${safeName(item.id)}`,
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
			seed + state.attemptedCases,
		);
		let excluded = false;
		for (const [workIndex, current] of work.entries()) {
			if (workIndex < state.nextWorkIndex) continue;
			const callOrdinal = workIndex + 1;
			if (state.cumulativeCostUsd >= cumulativeCostTargetUsd) break;
			if (state.cumulativeCostUsd >= aggregateCostCeilingUsd) {
				throw new Error(`aggregate cost ceiling reached: $${state.cumulativeCostUsd.toFixed(2)}`);
			}
			const safeRepositoryKey = `${item.id}:${current.variant}`;
			let safeRepository = safeRepositories.get(safeRepositoryKey);
			if (safeRepository === undefined) {
				safeRepository = prepareSafeRepository(item, current.variant);
				safeRepositories.set(safeRepositoryKey, safeRepository);
			}
			const root = createTrialClone(
				safeRepository,
				current,
				state.attemptedCases,
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
				runnerRef: expectedRunnerRef,
				sourceSha: sourceSha(item, current.variant),
				variant: current.variant,
			};
			const startedAt = new Date().toISOString();
			const started = performance.now();
			console.log(
				`case ${state.completedCases + 1}/30 call ${callOrdinal}/12: ${current.system} ${item.id} ${current.variant} t${current.trial}`,
			);
			try {
				const result = await executeWithInfrastructureRetry(
					() => execute(reviewInput),
					(value) => classifyTrialOutput(value, "correctness"),
				);
				if (result.status === "exclude-case") {
					const usage = estimatedAttemptCost(result.attemptRecords);
					state.cumulativeCostUsd += usage.costUsd;
					excluded = true;
					const exclusion = {
						attemptRecords: result.attemptRecords,
						attempts: result.attempts,
						caseId: item.id,
						disposition: result.disposition,
						failedWork: current,
						infrastructureErrors: result.infrastructureErrors,
						recordedAt: new Date().toISOString(),
						usage,
					};
					state.exclusions.push(exclusion);
					await Bun.write(
						join(caseDirectory, `${String(callOrdinal).padStart(2, "0")}--EXCLUDED.json`),
						`${JSON.stringify(exclusion, null, 2)}\n`,
					);
					break;
				}
				const usage = estimatedAttemptCost(result.attemptRecords);
				state.cumulativeCostUsd += usage.costUsd;
				const record = {
					...reviewInput,
					attemptRecords: result.attemptRecords,
					attempts: result.attempts,
					completedAt: new Date().toISOString(),
					cumulativeCostUsd: state.cumulativeCostUsd,
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
				state.nextWorkIndex = callOrdinal;
				await writeJsonAtomically(statePath, state);
				if (state.cumulativeCostUsd > aggregateCostCeilingUsd) {
					throw new Error(`aggregate cost ceiling exceeded: $${state.cumulativeCostUsd.toFixed(2)}`);
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
				`${String(state.attemptedCases).padStart(2, "0")}--${safeName(item.id)}`,
			);
			renameSync(caseDirectory, quarantine);
			const replacement = reserve.cases[state.reserveIndex];
			if (replacement === undefined) {
				throw new Error("frozen reserves exhausted after case exclusions");
			}
			state.reserveIndex += 1;
			state.candidateQueueIds.unshift(replacement.id);
			state.currentCaseId = null;
			state.nextWorkIndex = 0;
			await writeJsonAtomically(statePath, state);
			continue;
		}
		if (state.nextWorkIndex < work.length) break;
		state.completedCases += 1;
		state.completedCaseIds.push(item.id);
		state.currentCaseId = null;
		state.nextWorkIndex = 0;
		await writeJsonAtomically(statePath, state);
	}

	const status = state.completedCases === primary.cases.length ? "completed" : "checkpoint";
	await writeJsonAtomically(join(outputRoot, "run-summary.json"), {
		...frozenRun,
		completedAt: new Date().toISOString(),
		completedCaseIds: state.completedCaseIds,
		completedCases: state.completedCases,
		cumulativeCaseTarget,
		cumulativeCostTargetUsd,
		cumulativeCostUsd: state.cumulativeCostUsd,
		exclusions: state.exclusions,
		status,
	});
	console.log(
		`${status}: ${state.completedCases}/30 cases with ${state.exclusions.length} exclusion(s), estimated cost $${state.cumulativeCostUsd.toFixed(2)}`,
	);
}
