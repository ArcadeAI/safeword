import {
	closeSync,
	existsSync,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

import {
	executeWithInfrastructureRetry,
	type RetriedResult,
	type TrialDisposition,
} from "./scored-run-policy";

export type RunLock = { release: () => void };

export type ProvisionalCase = {
	activePath: string;
	provisionalPath: string;
	quarantinePath: string;
};

export type ReserveState = {
	candidateQueueIds: string[];
	currentCaseId: string | null;
	nextWorkIndex: number;
	reserveIndex: number;
	version: number;
};

export type CaseWorkResult<T, TState extends ReserveState> =
	| { result: RetriedResult<T>; status: "completed" }
	| {
			replacementId: string;
			result: RetriedResult<T>;
			state: TState;
			status: "excluded";
	  };

function syncDirectory(path: string): void {
	const descriptor = openSync(path, "r");
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

function writeJsonDurably(path: string, value: unknown): void {
	const temporaryPath = `${path}.tmp-${process.pid}`;
	const descriptor = openSync(temporaryPath, "wx");
	try {
		writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
	renameSync(temporaryPath, path);
	syncDirectory(dirname(path));
}

function safeSegment(value: string, field: string): string {
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) || basename(value) !== value) {
		throw new Error(`${field} must be one safe path segment`);
	}
	return value;
}

function nextReserveTransition<T extends ReserveState>(
	reserveIds: readonly string[],
	state: T,
): { replacementId: string; state: T } {
	const replacementId = reserveIds[state.reserveIndex];
	if (replacementId === undefined) throw new Error("frozen reserves exhausted");
	safeSegment(replacementId, "reserve ID");
	return {
		replacementId,
		state: {
			...state,
			candidateQueueIds: [replacementId, ...state.candidateQueueIds],
			currentCaseId: null,
			nextWorkIndex: 0,
			reserveIndex: state.reserveIndex + 1,
		} as T,
	};
}

function lockOwnerIsAlive(lockPath: string): boolean {
	const owner = Number.parseInt(readFileSync(lockPath, "utf8").trim(), 10);
	if (!Number.isSafeInteger(owner) || owner <= 0) return true;
	try {
		process.kill(owner, 0);
		return true;
	} catch (error) {
		return !(
			error instanceof Error &&
			"code" in error &&
			error.code === "ESRCH"
		);
	}
}

export function acquireRunLock(outputRoot: string): RunLock {
	mkdirSync(outputRoot, { recursive: true });
	const lockPath = join(outputRoot, ".run.lock");
	let descriptor: number;
	try {
		descriptor = openSync(lockPath, "wx");
	} catch (error) {
		if (!existsSync(lockPath)) throw error;
		if (lockOwnerIsAlive(lockPath)) {
			throw new Error(`benchmark output is already locked: ${lockPath}`);
		}
		unlinkSync(lockPath);
		syncDirectory(outputRoot);
		try {
			descriptor = openSync(lockPath, "wx");
		} catch {
			throw new Error(`benchmark output is already locked: ${lockPath}`);
		}
	}
	try {
		writeFileSync(descriptor, `${process.pid}\n`);
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
	syncDirectory(outputRoot);
	let released = false;
	return {
		release: () => {
			if (released) return;
			unlinkSync(lockPath);
			syncDirectory(outputRoot);
			released = true;
		},
	};
}

export function beginProvisionalCase(input: {
	caseId: string;
	ordinal: number;
	outputRoot: string;
}): ProvisionalCase {
	if (!Number.isInteger(input.ordinal) || input.ordinal < 1) {
		throw new Error("case ordinal must be a positive integer");
	}
	const caseId = safeSegment(input.caseId, "case ID");
	const caseName = `${String(input.ordinal).padStart(2, "0")}--${caseId}`;
	const provisionalRoot = join(input.outputRoot, "provisional");
	const activeRoot = join(input.outputRoot, "active");
	const quarantineRoot = join(input.outputRoot, "quarantine");
	for (const directory of [provisionalRoot, activeRoot, quarantineRoot]) {
		mkdirSync(directory, { recursive: true });
	}
	syncDirectory(input.outputRoot);
	const provisionalPath = join(provisionalRoot, caseName);
	const activePath = join(activeRoot, caseName);
	const quarantinePath = join(quarantineRoot, caseName);
	if (existsSync(activePath) || existsSync(quarantinePath)) {
		throw new Error(`case is already sealed: ${caseName}`);
	}
	mkdirSync(provisionalPath);
	syncDirectory(provisionalRoot);
	return { activePath, provisionalPath, quarantinePath };
}

export function recordTrialResult<T>(
	caseState: ProvisionalCase,
	workId: string,
	result: RetriedResult<T>,
): void {
	const safeWorkId = safeSegment(workId, "work ID");
	for (const attempt of result.attemptRecords) {
		writeJsonDurably(
			join(
				caseState.provisionalPath,
				`${safeWorkId}--attempt-${attempt.attempt}.json`,
			),
			attempt,
		);
	}
}

export function sealActiveCase(caseState: ProvisionalCase): void {
	if (existsSync(caseState.activePath)) {
		throw new Error(`active case already exists: ${caseState.activePath}`);
	}
	renameSync(caseState.provisionalPath, caseState.activePath);
	syncDirectory(dirname(caseState.provisionalPath));
	syncDirectory(dirname(caseState.activePath));
}

export function quarantineCaseAndAllocateReserve<T extends ReserveState>(input: {
	caseState: ProvisionalCase;
	exclusion: unknown;
	outputRoot: string;
	reserveIds: readonly string[];
	state: T;
}): { replacementId: string; state: T } {
	const transition = nextReserveTransition(input.reserveIds, input.state);
	if (existsSync(input.caseState.quarantinePath)) {
		throw new Error(
			`quarantined case already exists: ${input.caseState.quarantinePath}`,
		);
	}

	writeJsonDurably(
		join(input.caseState.provisionalPath, "EXCLUSION.json"),
		input.exclusion,
	);
	renameSync(input.caseState.provisionalPath, input.caseState.quarantinePath);
	syncDirectory(dirname(input.caseState.provisionalPath));
	syncDirectory(dirname(input.caseState.quarantinePath));

	writeJsonDurably(join(input.outputRoot, "run-state.json"), transition.state);

	return transition;
}

export async function executeCaseWork<T, TState extends ReserveState>(input: {
	caseState: ProvisionalCase;
	classify: (value: T) => TrialDisposition;
	execute: () => Promise<T>;
	outputRoot: string;
	reserveIds: readonly string[];
	state: TState;
	workId: string;
}): Promise<CaseWorkResult<T, TState>> {
	const result = await executeWithInfrastructureRetry(
		input.execute,
		input.classify,
	);
	recordTrialResult(input.caseState, input.workId, result);
	if (result.status === "completed") {
		return { result, status: "completed" };
	}

	const transition = quarantineCaseAndAllocateReserve({
		caseState: input.caseState,
		exclusion: {
			disposition: result.disposition ?? null,
			infrastructureErrors: result.infrastructureErrors,
			workId: input.workId,
		},
		outputRoot: input.outputRoot,
		reserveIds: input.reserveIds,
		state: input.state,
	});
	return { ...transition, result, status: "excluded" };
}

export function recoverInterruptedQuarantine<T extends ReserveState>(_input: {
	caseState: ProvisionalCase;
	outputRoot: string;
	reserveIds: readonly string[];
	state: T;
}): T {
	const input = _input;
	if (input.state.currentCaseId === null) return input.state;
	const provisionalExists = existsSync(input.caseState.provisionalPath);
	const quarantineExists = existsSync(input.caseState.quarantinePath);
	if (provisionalExists && quarantineExists) {
		throw new Error("case exists in both provisional and quarantine storage");
	}
	if (!provisionalExists && !quarantineExists) {
		throw new Error("current case has no durable provisional or quarantine record");
	}

	if (provisionalExists) {
		const exclusionPath = join(input.caseState.provisionalPath, "EXCLUSION.json");
		if (!existsSync(exclusionPath)) {
			const invalidAttempt = readdirSync(input.caseState.provisionalPath)
				.filter((filename) => /--attempt-[12]\.json$/.test(filename))
				.sort()
				.map((filename) => ({
					filename,
					record: JSON.parse(
						readFileSync(join(input.caseState.provisionalPath, filename), "utf8"),
					) as {
						attempt?: number;
						disposition?: TrialDisposition | null;
						error?: string | null;
					},
				}))
				.findLast(({ record }) =>
					(record.disposition?.status === "invalid" &&
						(record.disposition.retry === "never" || record.attempt === 2)) ||
					(record.attempt === 2 &&
						record.disposition === null &&
						typeof record.error === "string" &&
						record.error.length > 0),
				);
			if (invalidAttempt === undefined) return input.state;
			writeJsonDurably(exclusionPath, {
				disposition: invalidAttempt.record.disposition,
				error: invalidAttempt.record.error ?? null,
				workId: invalidAttempt.filename.replace(/--attempt-[12]\.json$/, ""),
			});
		}
		renameSync(input.caseState.provisionalPath, input.caseState.quarantinePath);
		syncDirectory(dirname(input.caseState.provisionalPath));
		syncDirectory(dirname(input.caseState.quarantinePath));
	}

	const transition = nextReserveTransition(input.reserveIds, input.state);
	writeJsonDurably(join(input.outputRoot, "run-state.json"), transition.state);
	return transition.state;
}
