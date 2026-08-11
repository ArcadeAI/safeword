export type BootstrapInterval = {
	lower95: number;
	mean: number;
	upper95: number;
};

function requireFinite(values: readonly number[], label: string): void {
	if (values.some((value) => !Number.isFinite(value))) {
		throw new Error(`${label} requires finite values`);
	}
}

export function mean(values: readonly number[]): number {
	if (values.length === 0) throw new Error("mean requires at least one value");
	requireFinite(values, "mean");
	return values.reduce((total, value) => total + value, 0) / values.length;
}

export function percentile(sortedValues: readonly number[], probability: number): number {
	if (sortedValues.length === 0) {
		throw new Error("percentile requires at least one value");
	}
	requireFinite(sortedValues, "percentile");
	if (!Number.isFinite(probability)) {
		throw new Error("percentile requires a finite probability");
	}
	if (probability < 0 || probability > 1) {
		throw new Error("percentile probability must be between zero and one");
	}
	const position = (sortedValues.length - 1) * probability;
	const lowerIndex = Math.floor(position);
	const upperIndex = Math.ceil(position);
	const lower = sortedValues[lowerIndex];
	const upper = sortedValues[upperIndex];
	if (lower === undefined || upper === undefined) {
		throw new Error("percentile selected an impossible index");
	}
	return lower + (upper - lower) * (position - lowerIndex);
}

function frozenRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
		return state / 0x1_0000_0000;
	};
}

/** Trials are averaged before this function; each input is one independent PR. */
export function pairedBootstrapInterval(
	caseDifferences: readonly number[],
	resamples: number,
	seed: number,
): BootstrapInterval {
	if (caseDifferences.length === 0) {
		throw new Error("paired bootstrap requires at least one independent case");
	}
	if (caseDifferences.some((value) => !Number.isFinite(value))) {
		throw new Error("paired bootstrap requires finite case differences");
	}
	if (!Number.isInteger(resamples) || resamples < 1) {
		throw new Error("paired bootstrap requires a positive resample count");
	}
	if (!Number.isSafeInteger(seed)) {
		throw new Error("paired bootstrap requires a safe-integer seed");
	}
	const random = frozenRandom(seed);
	const bootstrapMeans = Array.from({ length: resamples }, () => {
		let total = 0;
		for (let index = 0; index < caseDifferences.length; index += 1) {
			const sampled = caseDifferences[Math.floor(random() * caseDifferences.length)];
			if (sampled === undefined) throw new Error("bootstrap selected an impossible index");
			total += sampled;
		}
		return total / caseDifferences.length;
	}).sort((left, right) => left - right);
	return {
		lower95: percentile(bootstrapMeans, 0.025),
		mean: mean(caseDifferences),
		upper95: percentile(bootstrapMeans, 0.975),
	};
}
