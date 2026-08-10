import {
	closeSync,
	existsSync,
	fsyncSync,
	mkdirSync,
	openSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

import type { RetriedResult } from "./scored-run-policy";

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

export function acquireRunLock(outputRoot: string): RunLock {
	mkdirSync(outputRoot, { recursive: true });
	const lockPath = join(outputRoot, ".run.lock");
	let descriptor: number;
	try {
		descriptor = openSync(lockPath, "wx");
	} catch (error) {
		if (existsSync(lockPath)) {
			throw new Error(`benchmark output is already locked: ${lockPath}`);
		}
		throw error;
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

export function quarantineCaseAndAllocateReserve<T extends ReserveState>(_input: {
	caseState: ProvisionalCase;
	exclusion: unknown;
	outputRoot: string;
	reserveIds: readonly string[];
	state: T;
}): { replacementId: string; state: T } {
	throw new Error("quarantine transition not implemented");
}
