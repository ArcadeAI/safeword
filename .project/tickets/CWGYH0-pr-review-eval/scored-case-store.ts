import type { RetriedResult } from "./scored-run-policy";

export type RunLock = { release: () => void };

export type ProvisionalCase = {
	activePath: string;
	provisionalPath: string;
};

export function acquireRunLock(_outputRoot: string): RunLock {
	throw new Error("case store not implemented");
}

export function beginProvisionalCase(_input: {
	caseId: string;
	ordinal: number;
	outputRoot: string;
}): ProvisionalCase {
	throw new Error("case store not implemented");
}

export function recordTrialResult<T>(
	_case: ProvisionalCase,
	_workId: string,
	_result: RetriedResult<T>,
): void {
	throw new Error("case store not implemented");
}

export function sealActiveCase(_case: ProvisionalCase): void {
	throw new Error("case store not implemented");
}
