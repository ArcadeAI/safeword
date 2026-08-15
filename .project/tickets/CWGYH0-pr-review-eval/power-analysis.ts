type Scenario = {
  aOnly: number;
  bOnly: number;
  label: string;
};

const TRIALS_PER_CASE = 3;
const EXPERIMENTS = 5_000;
const BOOTSTRAPS = 1_000;
const SEED = 0x53_37_05;
const CASE_COUNTS = [20, 30, 40, 60, 80, 100];
const SCENARIOS: Scenario[] = [
  { aOnly: 0.3, bOnly: 0.15, label: 'modest +0.15' },
  { aOnly: 0.4, bOnly: 0.1, label: 'target +0.30' },
  { aOnly: 0.5, bOnly: 0.05, label: 'large +0.45' },
];

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function quantile(sorted: readonly number[], probability: number): number {
  const index = Math.floor((sorted.length - 1) * probability);
  return sorted[index] ?? 0;
}

function caseDifference(random: () => number, scenario: Scenario): number {
  // Treat the three trials as perfectly correlated for power planning. This
  // conservative case-level model prevents repeated reviews of one PR from
  // being counted as independent evidence.
  const draw = random();
  if (draw < scenario.aOnly) return 1;
  if (draw < scenario.aOnly + scenario.bOnly) return -1;
  return 0;
}

function lowerBound(differences: readonly number[], random: () => number): number {
  const means: number[] = [];
  for (let bootstrap = 0; bootstrap < BOOTSTRAPS; bootstrap += 1) {
    let total = 0;
    for (let index = 0; index < differences.length; index += 1) {
      total += differences[Math.floor(random() * differences.length)] ?? 0;
    }
    means.push(total / differences.length);
  }
  means.sort((left, right) => left - right);
  return quantile(means, 0.025);
}

function estimatePower(caseCount: number, scenario: Scenario): number {
  const random = mulberry32(SEED + caseCount * 1_009 + Math.round(scenario.aOnly * 10_000));
  let passes = 0;
  for (let experiment = 0; experiment < EXPERIMENTS; experiment += 1) {
    const differences = Array.from({ length: caseCount }, () => caseDifference(random, scenario));
    if (lowerBound(differences, random) > 0) {
      passes += 1;
    }
  }
  return passes / EXPERIMENTS;
}

const power = SCENARIOS.flatMap(scenario =>
  CASE_COUNTS.map(caseCount => ({
    caseCount,
    expectedDifference: scenario.aOnly - scenario.bOnly,
    power: estimatePower(caseCount, scenario),
    scenario: scenario.label,
  })),
);

const zeroFixedHitProbability = CASE_COUNTS.flatMap(caseCount =>
  [0.005, 0.01, 0.02].map(perTrialRate => ({
    caseCount,
    perTrialRate,
    probabilityOfZeroNamedHits: (1 - perTrialRate) ** caseCount,
  })),
);

console.log(
  JSON.stringify(
    {
      assumptions: {
        bootstraps: BOOTSTRAPS,
        experiments: EXPERIMENTS,
        independentUnit: 'PR case',
        withinCaseCorrelation: 'perfect (conservative planning bound)',
        seed: SEED,
        trialsPerCase: TRIALS_PER_CASE,
      },
      power,
      zeroFixedHitProbability,
    },
    null,
    2,
  ),
);
