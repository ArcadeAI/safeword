export function mayStartPaidWork(input: {
	aggregateCostStopUsd: number;
	cumulativeCostTargetUsd: number;
	cumulativeCostUsd: number;
}): boolean {
	return (
		input.cumulativeCostUsd < input.cumulativeCostTargetUsd &&
		input.cumulativeCostUsd < input.aggregateCostStopUsd
	);
}
