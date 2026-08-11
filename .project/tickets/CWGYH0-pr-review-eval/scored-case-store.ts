import {
	closeSync,
	existsSync,
	fsyncSync,
	mkdirSync,
	openSync,
	readFileSync,
	readdirSync,
	renameSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { basename, dirname, join } from "node:path";

import {
	executeWithInfrastructureRetry,
	type RetriedResult,
	type TrialDisposition,
} from "./scored-run-policy";

export type RunLock = { release: () => void };

export type QuarantineFailurePoint =
	| "after-exclusion-write"
	| "after-quarantine-rename"
	| "after-state-write";

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

export type RecoveryEvidence = {
	attemptRecords: unknown[];
	caseId: string;
	exclusion: unknown;
	replacementId: string;
	workId: string;
};

function syncDirectory(path: string): void {
	const descriptor = openSync(path, "r");
	try {
		fsyncSync(descriptor);
	} finally {
		closeSync(descriptor);
	}
}

export function writeJsonDurably(path: string, value: unknown): void {
	const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
	try {
		const descriptor = openSync(temporaryPath, "wx");
		try {
			writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
			fsyncSync(descriptor);
		} finally {
			closeSync(descriptor);
		}
		renameSync(temporaryPath, path);
		syncDirectory(dirname(path));
	} catch (error) {
		if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
		throw error;
	}
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

type LockOwner = { pid: number; token?: string };

function readLockOwner(lockPath: string): LockOwner | null {
	try {
		const value = JSON.parse(
			readFileSync(join(lockPath, "owner.json"), "utf8"),
		) as Partial<LockOwner>;
		if (!Number.isSafeInteger(value.pid) || (value.pid ?? 0) <= 0) return null;
		return { pid: value.pid as number, token: value.token };
	} catch {
		try {
			const pid = Number.parseInt(readFileSync(lockPath, "utf8").trim(), 10);
			return Number.isSafeInteger(pid) && pid > 0 ? { pid } : null;
		} catch {
			return null;
		}
	}
}

function lockOwnerIsAlive(owner: LockOwner | null): boolean {
	if (owner === null) return false;
	try {
		process.kill(owner.pid, 0);
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
	const token = randomUUID();
	const candidatePath = join(outputRoot, `.run-lock-candidate-${process.pid}-${token}`);
	mkdirSync(candidatePath);
	writeJsonDurably(join(candidatePath, "owner.json"), { pid: process.pid, token });
	syncDirectory(outputRoot);
	let acquired = false;
	try {
		for (let attempt = 0; attempt < 16 && !acquired; attempt += 1) {
			try {
				renameSync(candidatePath, lockPath);
				syncDirectory(outputRoot);
				acquired = true;
				break;
			} catch (error) {
				if (!existsSync(lockPath)) {
					if (!existsSync(candidatePath)) throw error;
					continue;
				}
			}

			if (lockOwnerIsAlive(readLockOwner(lockPath))) {
				throw new Error(`benchmark output is already locked: ${lockPath}`);
			}

			const stalePath = join(
				outputRoot,
				`.run-lock-stale-${process.pid}-${randomUUID()}`,
			);
			try {
				renameSync(lockPath, stalePath);
			} catch {
				continue;
			}
			syncDirectory(outputRoot);
			rmSync(stalePath, { force: true, recursive: true });
			syncDirectory(outputRoot);
		}
		if (!acquired) {
			throw new Error(`benchmark output lock changed too often: ${lockPath}`);
		}
	} catch (error) {
		rmSync(candidatePath, { force: true, recursive: true });
		throw error;
	}
	let released = false;
	return {
		release: () => {
			if (released) return;
			const owner = readLockOwner(lockPath);
			if (owner?.token !== token) {
				released = true;
				return;
			}
			const releasedPath = join(
				outputRoot,
				`.run-lock-released-${process.pid}-${token}`,
			);
			renameSync(lockPath, releasedPath);
			syncDirectory(outputRoot);
			rmSync(releasedPath, { force: true, recursive: true });
			syncDirectory(outputRoot);
			released = true;
		},
	};
}

export function beginProvisionalCase(input: {
	caseId: string;
	ordinal: number;
	outputRoot: string;
	resume?: boolean;
}): ProvisionalCase {
	const caseState = caseStateFor(input);
	const { activePath, provisionalPath, quarantinePath } = caseState;
	for (const directory of [
		dirname(provisionalPath),
		dirname(activePath),
		dirname(quarantinePath),
	]) {
		mkdirSync(directory, { recursive: true });
	}
	syncDirectory(input.outputRoot);
	if (existsSync(activePath) || existsSync(quarantinePath)) {
		throw new Error(`case is already sealed: ${basename(provisionalPath)}`);
	}
	if (existsSync(provisionalPath)) {
		if (input.resume === true) return caseState;
		throw new Error(`provisional case already exists: ${basename(provisionalPath)}`);
	}
	mkdirSync(provisionalPath);
	syncDirectory(dirname(provisionalPath));
	return caseState;
}

export function caseStateFor(input: {
	caseId: string;
	ordinal: number;
	outputRoot: string;
}): ProvisionalCase {
	if (!Number.isInteger(input.ordinal) || input.ordinal < 1) {
		throw new Error("case ordinal must be a positive integer");
	}
	const caseId = safeSegment(input.caseId, "case ID");
	const caseName = `${String(input.ordinal).padStart(2, "0")}--${caseId}`;
	return {
		activePath: join(input.outputRoot, "active", caseName),
		provisionalPath: join(input.outputRoot, "provisional", caseName),
		quarantinePath: join(input.outputRoot, "quarantine", caseName),
	};
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

export function recordAdmittedTrial(
	caseState: ProvisionalCase,
	workId: string,
	record: unknown,
): void {
	const safeWorkId = safeSegment(workId, "work ID");
	writeJsonDurably(
		join(caseState.provisionalPath, `${safeWorkId}--record.json`),
		record,
	);
}

export function commitAdmittedCaseWork(input: {
	caseState: ProvisionalCase;
	record: unknown;
	state: unknown;
	statePath: string;
	workId: string;
}): void {
	recordAdmittedTrial(input.caseState, input.workId, input.record);
	writeJsonDurably(input.statePath, input.state);
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
	failurePoint?: (point: QuarantineFailurePoint) => void;
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
	input.failurePoint?.("after-exclusion-write");
	renameSync(input.caseState.provisionalPath, input.caseState.quarantinePath);
	syncDirectory(dirname(input.caseState.provisionalPath));
	syncDirectory(dirname(input.caseState.quarantinePath));
	input.failurePoint?.("after-quarantine-rename");

	writeJsonDurably(join(input.outputRoot, "run-state.json"), transition.state);
	input.failurePoint?.("after-state-write");

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
	reconcileExclusion?: (state: T, evidence: RecoveryEvidence) => T;
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

	const casePath = provisionalExists
		? input.caseState.provisionalPath
		: input.caseState.quarantinePath;
	const attemptArtifacts = readdirSync(casePath)
		.filter((filename) => /--attempt-[12]\.json$/.test(filename))
		.sort()
		.map((filename) => ({
			filename,
			record: JSON.parse(readFileSync(join(casePath, filename), "utf8")) as {
				attempt?: number;
				disposition?: TrialDisposition | null;
				error?: string | null;
			},
		}));
	const exclusionPath = join(casePath, "EXCLUSION.json");
	let exclusion: unknown;
	const terminalAttempt = attemptArtifacts.findLast(({ record }) =>
		(record.disposition?.status === "invalid" &&
			(record.disposition.retry === "never" || record.attempt === 2)) ||
		(record.attempt === 2 &&
			record.disposition === null &&
			typeof record.error === "string" &&
			record.error.length > 0),
	);
	if (existsSync(exclusionPath)) {
		exclusion = JSON.parse(readFileSync(exclusionPath, "utf8")) as unknown;
	} else {
		if (!provisionalExists) {
			throw new Error("quarantined case has no durable exclusion record");
		}
		if (terminalAttempt === undefined) return input.state;
		exclusion = {
			disposition: terminalAttempt.record.disposition,
			error: terminalAttempt.record.error ?? null,
			workId: terminalAttempt.filename.replace(/--attempt-[12]\.json$/, ""),
		};
		writeJsonDurably(exclusionPath, exclusion);
	}
	if (provisionalExists) {
		renameSync(input.caseState.provisionalPath, input.caseState.quarantinePath);
		syncDirectory(dirname(input.caseState.provisionalPath));
		syncDirectory(dirname(input.caseState.quarantinePath));
	}

	const replacementId = input.reserveIds[input.state.reserveIndex];
	if (replacementId === undefined) throw new Error("frozen reserves exhausted");
	const recordedWorkId =
		typeof exclusion === "object" &&
		exclusion !== null &&
		"workId" in exclusion &&
		typeof exclusion.workId === "string"
			? exclusion.workId
			: undefined;
	const workId =
		recordedWorkId ??
		terminalAttempt?.filename.replace(/--attempt-[12]\.json$/, "");
	if (workId === undefined) {
		throw new Error("durable exclusion does not identify its failed work item");
	}
	const reconciledState = input.reconcileExclusion?.(input.state, {
		attemptRecords: attemptArtifacts
			.filter(({ filename }) => filename.startsWith(`${workId}--attempt-`))
			.map(({ record }) => record),
		caseId: input.state.currentCaseId,
		exclusion,
		replacementId,
		workId,
	}) ?? input.state;
	if (reconciledState.reserveIndex !== input.state.reserveIndex) {
		throw new Error("exclusion reconciliation must not change reserve position");
	}
	const transition = nextReserveTransition(input.reserveIds, reconciledState);
	writeJsonDurably(join(input.outputRoot, "run-state.json"), transition.state);
	return transition.state;
}
