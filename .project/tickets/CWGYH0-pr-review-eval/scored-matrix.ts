export type MatrixRecord = {
	caseId: string;
	system: string;
	trial: number;
	usable: boolean;
	variant: string;
};

export type MatrixAllocation = {
	quarantinedCaseId: string;
	replacementCaseId: string;
};

export type ContaminationPreflight = {
	expectedRepositoryCount: number;
	observedRepositoryCount: number;
	status: string;
};

export type ScoreableMatrixInput<T extends MatrixRecord> = {
	allocations: readonly MatrixAllocation[];
	preflight: ContaminationPreflight;
	primaryCaseIds: readonly string[];
	records: readonly T[];
	reserveCaseIds: readonly string[];
	systems: readonly string[];
	trials: readonly number[];
	variants: readonly string[];
};

export type ScoreableMatrix<T extends MatrixRecord> = {
	admittedRecords: T[];
	effectiveCaseIds: string[];
	gates: {
		allCasesComplete: boolean;
		contaminationPreflightPassed: boolean;
	};
};

function requireUnique(values: readonly (number | string)[], label: string): void {
	if (new Set(values).size !== values.length) {
		throw new Error(`${label} must not contain duplicates`);
	}
}

function deriveEffectiveCaseIds(input: ScoreableMatrixInput<MatrixRecord>): string[] {
	requireUnique(input.primaryCaseIds, "primary case IDs");
	requireUnique(input.reserveCaseIds, "reserve case IDs");
	const allCaseIds = [...input.primaryCaseIds, ...input.reserveCaseIds];
	requireUnique(allCaseIds, "primary and reserve case IDs");
	const effectiveCaseIds = [...input.primaryCaseIds];

	input.allocations.forEach((allocation, index) => {
		const expectedReplacement = input.reserveCaseIds[index];
		if (allocation.replacementCaseId !== expectedReplacement) {
			throw new Error(
				`reserve allocation ${index + 1} must use ${expectedReplacement ?? "no exhausted reserve"}`,
			);
		}
		const replacedIndex = effectiveCaseIds.indexOf(allocation.quarantinedCaseId);
		if (replacedIndex === -1) {
			throw new Error(
				`allocation does not replace a currently effective case: ${allocation.quarantinedCaseId}`,
			);
		}
		effectiveCaseIds[replacedIndex] = allocation.replacementCaseId;
	});

	return effectiveCaseIds;
}

function trialList(records: readonly MatrixRecord[]): string {
	return [...records].map((record) => record.trial).sort((left, right) => left - right).join(", ");
}

export function deriveScoreableMatrix<T extends MatrixRecord>(
	input: ScoreableMatrixInput<T>,
): ScoreableMatrix<T> {
	requireUnique(input.systems, "systems");
	requireUnique(input.variants, "variants");
	requireUnique(input.trials, "trials");
	const effectiveCaseIds = deriveEffectiveCaseIds(input);
	const effectiveCaseSet = new Set(effectiveCaseIds);
	const systemSet = new Set(input.systems);
	const variantSet = new Set(input.variants);

	for (const record of input.records) {
		if (!effectiveCaseSet.has(record.caseId)) {
			throw new Error(`one unexpected case: ${record.caseId}`);
		}
		if (!systemSet.has(record.system) || !variantSet.has(record.variant)) {
			throw new Error(
				`one unexpected system or variant cell: ${record.caseId}:${record.system}:${record.variant}`,
			);
		}
		if (!record.usable) {
			throw new Error(
				`one unusable reviewer trial: ${record.caseId}:${record.system}:${record.variant}:${record.trial}`,
			);
		}
	}

	for (const caseId of effectiveCaseIds) {
		const caseRecords = input.records.filter((record) => record.caseId === caseId);
		if (caseRecords.length === 0) {
			throw new Error(`one frozen case missing entirely: ${caseId}`);
		}
	}
	for (const system of input.systems) {
		if (!input.records.some((record) => record.system === system)) {
			throw new Error(`one frozen system missing entirely: ${system}`);
		}
	}

	for (const caseId of effectiveCaseIds) {
		for (const system of input.systems) {
			for (const variant of input.variants) {
				const cellName = `${caseId}:${system}:${variant}`;
				const cell = input.records.filter(
					(record) =>
						record.caseId === caseId &&
						record.system === system &&
						record.variant === variant,
				);
				if (cell.length === 0) {
					throw new Error(`one empty system and variant cell: ${cellName}`);
				}
				const actualTrials = cell.map((record) => record.trial);
				const expectedTrials = input.trials.join(", ");
				if (new Set(actualTrials).size !== actualTrials.length) {
					throw new Error(
						`one duplicate trial number: ${cellName} must contain exactly trials ${expectedTrials}; found ${trialList(cell)}`,
					);
				}
				const hasUnexpectedTrial = actualTrials.some(
					(trial) => !input.trials.includes(trial),
				);
				if (hasUnexpectedTrial || actualTrials.length > input.trials.length) {
					throw new Error(
						`one unexpected extra trial: ${cellName} must contain exactly trials ${expectedTrials}; found ${trialList(cell)}`,
					);
				}
				if (
					actualTrials.length !== input.trials.length ||
					input.trials.some((trial) => !actualTrials.includes(trial))
				) {
					throw new Error(
						`one missing trial: ${cellName} must contain exactly trials ${expectedTrials}; found ${trialList(cell)}`,
					);
				}
			}
		}
	}

	const expectedRecordCount =
		effectiveCaseIds.length *
		input.systems.length *
		input.variants.length *
		input.trials.length;
	return {
		admittedRecords: [...input.records],
		effectiveCaseIds,
		gates: {
			allCasesComplete:
				input.records.length === expectedRecordCount &&
				input.records.every((record) => record.usable),
			contaminationPreflightPassed:
				input.preflight.status === "passed" &&
				input.preflight.observedRepositoryCount ===
					input.preflight.expectedRepositoryCount,
		},
	};
}
