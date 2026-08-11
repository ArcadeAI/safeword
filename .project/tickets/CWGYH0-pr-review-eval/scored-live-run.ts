import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import {
	type DevelopmentReviewInput,
	type DevelopmentVariant,
	loadPinnedAdapter,
} from "./scored-adapter";
import {
	classifyTrialOutput,
	executeWithInfrastructureRetry,
	parseCumulativeCaseTarget,
	parseCumulativeCostTarget,
	shuffleFrozen,
} from "./scored-run-policy";
import {
	acquireRunLock,
	beginProvisionalCase,
	caseStateFor,
	commitAdmittedCaseWork,
	quarantineCaseAndAllocateReserve,
	recoverInterruptedQuarantine,
	readTrialAttempts,
	recordTrialAttempt,
	sealActiveCase,
	writeJsonDurably,
} from "./scored-case-store";
import { estimateAttemptUsage } from "./scored-cost";
import { evaluateCanaryGate } from "./scored-canary-gate";
import { loadPinnedManifestFromGit } from "./scored-artifact-manifest";
import { loadGitHubEvidenceAnchor } from "./scored-evidence-anchor";

const ticketRoot = import.meta.dir;
const sourceRepository = requireEnvironment("CWGYH0_SOURCE_REPOSITORY");
const adapterRoot = requireEnvironment("CWGYH0_ADAPTER_ROOT");
const primaryManifestPath = process.env.CWGYH0_PRIMARY_MANIFEST_PATH ??
	join(ticketRoot, "scored-cases-frozen-2026-08-01.json");
const reserveManifestPath = process.env.CWGYH0_RESERVE_MANIFEST_PATH ??
	join(ticketRoot, "reserve-cases-frozen-2026-08-01.json");
const expectedPrimaryCaseCount = parseExpectedCount(
	process.env.CWGYH0_EXPECTED_PRIMARY_CASES,
	30,
	"CWGYH0_EXPECTED_PRIMARY_CASES",
);
const expectedReserveCaseCount = parseExpectedCount(
	process.env.CWGYH0_EXPECTED_RESERVE_CASES,
	10,
	"CWGYH0_EXPECTED_RESERVE_CASES",
);
const experts = {
	full: join(ticketRoot, "scored-prompts/full"),
	narrow: join(ticketRoot, "scored-prompts/narrow"),
} as const;
const expectedHashes = {
	primaryManifest:
		process.env.CWGYH0_PRIMARY_MANIFEST_SHA256 ??
		"6180519f4d72f5b082baae9cd14af7848786f7601359ed1c3625769ef4146bc7",
	reserveManifest:
		process.env.CWGYH0_RESERVE_MANIFEST_SHA256 ??
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
const expectedAdapterCommit = "3eb8652324c755ce2fc806b6ab5d3d41c1f1a39f";
const expectedRunnerRef = "codex/cwgyh0-dev-benchmark-adapter@3eb865232";
const preregisteredRunnerRef = "codex/cwgyh0-dev-benchmark-adapter@8d86720c0";
const model = "claude-sonnet-5";
const expectedRoute = { expert: "correctness", model, provider: "anthropic" } as const;
const trials = 3;
const seed = 5_453_573;
const aggregateCostStopUsd = 1_000;
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
	aggregateCostStopUsd,
);

type RawCase = {
	baseSha: string;
	causalPaths: string[];
	failureDescription: unknown;
	fixedSha: string;
	id: string;
	reviewBaseSha: string;
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
	costAccountingComplete: boolean;
	cumulativeCostUsd: number;
	currentCaseId: string | null;
	exclusions: Array<Record<string, unknown>>;
	frozenRun: Record<string, unknown>;
	nextWorkIndex: number;
	reserveIndex: number;
	version: 3;
};

function requireEnvironment(name: string): string {
	const value = process.env[name];
	if (value === undefined || value.length === 0) {
		throw new Error(`${name} is required`);
	}
	return value;
}

function parseExpectedCount(value: string | undefined, fallback: number, name: string): number {
	if (value === undefined) return fallback;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer`);
	return parsed;
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

function sha256Text(value: string): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(value);
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
	if (
		primary.cases.length !== expectedPrimaryCaseCount ||
		reserve.cases.length !== expectedReserveCaseCount
	) {
		throw new Error(
			`frozen corpus must contain ${expectedPrimaryCaseCount} primary and ${expectedReserveCaseCount} reserve cases`,
		);
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

function estimatedAttemptCost(
	attemptRecords: readonly { output: unknown | null }[],
) {
	return estimateAttemptUsage(attemptRecords, {
		inputPerMillionUsd: inputPricePerMillionUsd,
		outputPerMillionUsd: outputPricePerMillionUsd,
	});
}

async function writeJsonAtomically(path: string, value: unknown): Promise<void> {
	writeJsonDurably(path, value);
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

const { createRunnerExecutor, loadDevelopmentManifest } = await loadPinnedAdapter({
	adapterRoot,
	expectedCommit: expectedAdapterCommit,
});

loadDevelopmentManifest(primaryManifestPath);
loadDevelopmentManifest(reserveManifestPath);
const primary = readRawManifest(primaryManifestPath);
const reserve = readRawManifest(reserveManifestPath);
const allCases = validateFrozenInputs(primary, reserve);
const safeRepositories = new Map<string, string>();

const baseFrozenRun = {
	aggregateCostStopUsd,
	expectedAdapterCommit,
	expectedPrimaryCaseCount,
	expectedReserveCaseCount,
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
	sourceRepositoryIdentity: runGit(sourceRepository, ["remote", "get-url", "origin"]),
	trials,
};

let frozenRun: Record<string, unknown>;

if (preflightOnly) {
	const preflightId = randomUUID();
	frozenRun = { ...baseFrozenRun, preflightId };
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
	const certifiedPreflightPath = requireEnvironment("CWGYH0_PREFLIGHT_PATH");
	const certifiedPreflightBytes = readFileSync(certifiedPreflightPath, "utf8");
	const certifiedPreflight = JSON.parse(certifiedPreflightBytes) as Record<
		string,
		unknown
	> & {
		preflightId?: unknown;
		preflightedRepositories?: unknown;
		primaryCases?: unknown;
		reserveCases?: unknown;
		sourceRepositoryIdentity?: unknown;
		status?: unknown;
	};
	const mismatchedFrozenField = Object.entries(baseFrozenRun).find(
		([key, expected]) =>
			JSON.stringify(certifiedPreflight[key]) !== JSON.stringify(expected),
	)?.[0];
	if (
		typeof certifiedPreflight.preflightId !== "string" ||
		certifiedPreflight.preflightId.length === 0 ||
		certifiedPreflight.status !== "passed" ||
		certifiedPreflight.preflightedRepositories !== allCases.length * 2 ||
		mismatchedFrozenField !== undefined
	) {
		throw new Error(
			`certified preflight does not match the frozen benchmark${
				mismatchedFrozenField === undefined ? "" : `: ${mismatchedFrozenField}`
			}`,
		);
	}
	frozenRun = {
		...baseFrozenRun,
		preflightId: certifiedPreflight.preflightId,
		preflightSha256: sha256Text(certifiedPreflightBytes),
	};
	const checkpointId = requireEnvironment("CWGYH0_CHECKPOINT_ID");
	const gateAnchor = await loadGitHubEvidenceAnchor(
		requireEnvironment("CWGYH0_CANARY_GATE_ANCHOR_URL"),
		"canary",
	);
	const pinnedGate = loadPinnedManifestFromGit({
		commit: gateAnchor.commit,
		digestPath: gateAnchor.digestPath,
		expectedRepositoryIdentity: gateAnchor.repositoryIdentity,
		gitRoot: requireEnvironment("CWGYH0_CANARY_GATE_GIT_ROOT"),
		manifestPath: gateAnchor.blobPath,
	});
	if (pinnedGate.digest !== gateAnchor.digest) {
		throw new Error("canary gate differs from independently retained issue anchor");
	}
	const gateEvidence = JSON.parse(pinnedGate.manifestBytes) as Parameters<
		typeof evaluateCanaryGate
	>[0];
	const observedBindings = () => ({
		adapter: sha256Text(expectedAdapterCommit),
		classifier: sha256(join(ticketRoot, "scored-run-policy.ts")),
		preflight: sha256Text(certifiedPreflightBytes),
		primaryManifest: sha256(primaryManifestPath),
		reserveManifest: sha256(reserveManifestPath),
		runner: sha256(join(ticketRoot, "scored-live-run.ts")),
		runIdentity: sha256Text(JSON.stringify({
			checkpointId,
			cumulativeCaseTarget,
			cumulativeCostTargetUsd,
			outputRoot: resolve(outputRoot),
			preflightId: certifiedPreflight.preflightId,
			runId: gateEvidence.runId,
		})),
		scorer: sha256(join(ticketRoot, "score-results.ts")),
		writer: sha256(join(ticketRoot, "scored-case-store.ts")),
	});
	const assertPaidAuthorization = (): void => {
		const gate = evaluateCanaryGate({
			...gateEvidence,
			anchorCreatedAt: gateAnchor.createdAt,
			observedBindings: observedBindings(),
		});
		if (!gate.authorized) {
			throw new Error(`paid checkpoint blocked: ${gate.reasons.join("; ")}`);
		}
		if (gate.nextCheckpoint !== checkpointId) {
			throw new Error(
				`paid checkpoint blocked: authorization is for ${gate.nextCheckpoint}, not ${checkpointId}`,
			);
		}
	};
	assertPaidAuthorization();
	const runLock = acquireRunLock(outputRoot);
	try {
	mkdirSync(join(outputRoot, "active"), { recursive: true });
	mkdirSync(join(outputRoot, "provisional"), { recursive: true });
	mkdirSync(join(outputRoot, "quarantine"), { recursive: true });
	const statePath = join(outputRoot, "run-state.json");
	const casesById = new Map(allCases.map((item) => [item.id, item]));
	let state: RunState;
	if (resuming) {
		if (!existsSync(statePath)) {
			throw new Error("existing scored output has no resumable run-state.json");
		}
		state = JSON.parse(readFileSync(statePath, "utf8")) as RunState;
		if (state.version !== 3 || JSON.stringify(state.frozenRun) !== JSON.stringify(frozenRun)) {
			throw new Error("saved run state does not match the frozen benchmark");
		}
		const recordedCaseDirectories =
			directoryEntryCount(join(outputRoot, "active")) +
			directoryEntryCount(join(outputRoot, "provisional")) +
			directoryEntryCount(join(outputRoot, "quarantine"));
		const awaitingProvisionalCreation =
			state.currentCaseId !== null &&
			recordedCaseDirectories === state.attemptedCases - 1;
		if (
			recordedCaseDirectories !== state.attemptedCases &&
			!awaitingProvisionalCreation
		) {
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
			costAccountingComplete: true,
			cumulativeCostUsd: 0,
			currentCaseId: null,
			exclusions: [],
			frozenRun,
			nextWorkIndex: 0,
			reserveIndex: 0,
			version: 3,
		};
		await writeJsonAtomically(statePath, state);
	}
	if (state.currentCaseId !== null) {
		const interruptedCaseId = state.currentCaseId;
		const interruptedCase = caseStateFor({
			caseId: interruptedCaseId,
			ordinal: state.attemptedCases,
			outputRoot,
		});
		if (existsSync(interruptedCase.activePath)) {
			const admittedRecords = readdirSync(interruptedCase.activePath).filter((name) =>
				name.endsWith("--record.json"),
			);
			if (admittedRecords.length !== 12) {
				throw new Error("sealed active case does not contain 12 admitted records");
			}
			state.completedCases += 1;
			state.completedCaseIds.push(interruptedCaseId);
			state.currentCaseId = null;
			state.nextWorkIndex = 0;
			await writeJsonAtomically(statePath, state);
		} else {
			if (
				!existsSync(interruptedCase.provisionalPath) &&
				!existsSync(interruptedCase.quarantinePath)
			) {
				beginProvisionalCase({
					caseId: interruptedCaseId,
					ordinal: state.attemptedCases,
					outputRoot,
				});
			}
			if (existsSync(interruptedCase.provisionalPath)) {
				const durableRecords = readdirSync(
					interruptedCase.provisionalPath,
				).filter((name) => name.endsWith("--record.json"));
				if (durableRecords.length > state.nextWorkIndex) {
					if (durableRecords.length !== state.nextWorkIndex + 1) {
						throw new Error("provisional records are ahead of state by more than one work item");
					}
					const recoveredEvidence = durableRecords.map((name) => {
						const record = JSON.parse(
							readFileSync(join(interruptedCase.provisionalPath, name), "utf8"),
						) as { cumulativeCostUsd?: unknown; usage?: { complete?: unknown } };
						return record;
					});
					if (
						recoveredEvidence.some(
							(record) =>
								typeof record.cumulativeCostUsd !== "number" ||
								!Number.isFinite(record.cumulativeCostUsd) ||
								typeof record.usage?.complete !== "boolean",
						)
					) {
						throw new Error("recovered record has invalid cumulative cost evidence");
					}
					state.nextWorkIndex = durableRecords.length;
					state.cumulativeCostUsd = Math.max(
						...recoveredEvidence.map((record) => record.cumulativeCostUsd as number),
					);
					state.costAccountingComplete =
						state.costAccountingComplete &&
						recoveredEvidence.every((record) => record.usage?.complete === true);
					await writeJsonAtomically(statePath, state);
				}
			}
			state = recoverInterruptedQuarantine({
				caseState: interruptedCase,
				outputRoot,
				reconcileExclusion: (current, evidence) => {
					const attemptRecords = evidence.attemptRecords as Array<{
						output: { report: unknown } | null;
					}>;
					const usage = estimatedAttemptCost(attemptRecords);
					const durableExclusion =
						typeof evidence.exclusion === "object" &&
						evidence.exclusion !== null &&
						!Array.isArray(evidence.exclusion)
							? evidence.exclusion
							: {};
					return {
						...current,
						costAccountingComplete:
							current.costAccountingComplete && usage.complete,
						cumulativeCostUsd: current.cumulativeCostUsd + usage.costUsd,
						exclusions: [
							...current.exclusions,
							{
								...durableExclusion,
								attemptRecords: evidence.attemptRecords,
								caseId: evidence.caseId,
								recoveredAt: new Date().toISOString(),
								replacementId: evidence.replacementId,
								usage,
							},
						],
					};
				},
				reserveIds: reserve.cases.map((candidate) => candidate.id),
				state,
			});
		}
	}
	if (cumulativeCaseTarget < state.completedCases) {
		throw new Error(
			`case target ${cumulativeCaseTarget} is behind ${state.completedCases} completed cases`,
		);
	}
	const authorizationIdentity = sha256Text(JSON.stringify({
		checkpointId,
		cumulativeCaseTarget,
		cumulativeCostTargetUsd,
		gateDigest: pinnedGate.digest,
		outputRoot: resolve(outputRoot),
		preflightId: certifiedPreflight.preflightId,
		runId: gateEvidence.runId,
	}));
	const authorizationDirectory = join(outputRoot, "authorizations");
	mkdirSync(authorizationDirectory, { recursive: true });
	const authorizationMarkerPath = join(
		authorizationDirectory,
		`${safeName(checkpointId)}.json`,
	);
	if (existsSync(authorizationMarkerPath)) {
		const marker = JSON.parse(readFileSync(authorizationMarkerPath, "utf8")) as {
			authorizationIdentity?: unknown;
		};
		if (marker.authorizationIdentity !== authorizationIdentity) {
			throw new Error("paid checkpoint authorization was already consumed by another target");
		}
	} else {
		writeJsonDurably(authorizationMarkerPath, {
			authorizationIdentity,
			checkpointId,
			status: "active",
		});
	}

	while (
		state.completedCases < primary.cases.length &&
		state.completedCases < cumulativeCaseTarget &&
		state.costAccountingComplete &&
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
		const caseState = continuingCase
			? beginProvisionalCase({
				caseId: item.id,
				ordinal: state.attemptedCases,
				outputRoot,
				resume: true,
			})
			: beginProvisionalCase({
				caseId: item.id,
				ordinal: state.attemptedCases,
				outputRoot,
			});
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
			if (state.cumulativeCostUsd >= aggregateCostStopUsd) {
				break;
			}
			assertPaidAuthorization();
			const currentMarker = JSON.parse(
				readFileSync(authorizationMarkerPath, "utf8"),
			) as { authorizationIdentity?: unknown; status?: unknown };
			if (
				currentMarker.authorizationIdentity !== authorizationIdentity ||
				currentMarker.status !== "active"
			) {
				throw new Error("paid checkpoint authorization changed before provider call");
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
				forceExpertLane: "correctness",
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
			const workId = `${current.system}--${current.variant}--t${current.trial}`;
			try {
				const result = await executeWithInfrastructureRetry(
					() => execute(reviewInput),
					(value) => classifyTrialOutput(value, expectedRoute, {
						caseId: reviewInput.caseId,
						reviewBaseSha: reviewInput.reviewBaseSha,
						runnerRef: reviewInput.runnerRef,
						sourceSha: reviewInput.sourceSha,
						variant: reviewInput.variant,
					}),
					{
						onAttempt: (attempt) => recordTrialAttempt(caseState, workId, attempt),
						priorAttemptRecords: readTrialAttempts(caseState, workId),
					},
				);
				if (result.status === "exclude-case") {
					const usage = estimatedAttemptCost(result.attemptRecords);
					excluded = true;
					const replacement = reserve.cases[state.reserveIndex];
					if (replacement === undefined) {
						throw new Error("frozen reserves exhausted after case exclusions");
					}
					const exclusion = {
						attemptRecords: result.attemptRecords,
						attempts: result.attempts,
						caseId: item.id,
						disposition: result.disposition,
						failedWork: current,
						infrastructureErrors: result.infrastructureErrors,
						replacementId: replacement.id,
						recordedAt: new Date().toISOString(),
						usage,
						workId,
					};
					const transition = quarantineCaseAndAllocateReserve({
						caseState,
						exclusion,
						outputRoot,
						reserveIds: reserve.cases.map((candidate) => candidate.id),
						state: {
							...state,
							costAccountingComplete:
								state.costAccountingComplete && usage.complete,
							cumulativeCostUsd: state.cumulativeCostUsd + usage.costUsd,
							exclusions: [...state.exclusions, exclusion],
						},
					});
					state = transition.state;
					break;
				}
				const usage = estimatedAttemptCost(result.attemptRecords);
				state.costAccountingComplete =
					state.costAccountingComplete && usage.complete;
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
				state.nextWorkIndex = callOrdinal;
				commitAdmittedCaseWork({ caseState, record, state, statePath, workId });
			} catch (error) {
				writeJsonDurably(
					join(caseState.provisionalPath, `${String(callOrdinal).padStart(2, "0")}--FAILED.json`),
					{
						...reviewInput,
						durationMs: Math.round(performance.now() - started),
						error: serializeError(error),
						startedAt,
						system: current.system,
						trial: current.trial,
					},
				);
				throw error;
			}
		}

		if (excluded) {
			continue;
		}
		if (state.nextWorkIndex < work.length) break;
		sealActiveCase(caseState);
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
		costAccountingComplete: state.costAccountingComplete,
		cumulativeCaseTarget,
		cumulativeCostTargetUsd,
		cumulativeCostUsd: state.cumulativeCostUsd,
		exclusions: state.exclusions,
		status,
	});
	writeJsonDurably(authorizationMarkerPath, {
		authorizationIdentity,
		checkpointId,
		completedCases: state.completedCases,
		cumulativeCostUsd: state.cumulativeCostUsd,
		status: "consumed",
	});
	console.log(
		`${status}: ${state.completedCases}/30 cases with ${state.exclusions.length} exclusion(s), estimated cost $${state.cumulativeCostUsd.toFixed(2)}`,
	);
	} finally {
		runLock.release();
	}
}
