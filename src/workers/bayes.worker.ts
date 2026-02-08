import {
  clamp,
  computeEss,
  quantile,
  randomLogNormal,
  randomNormal,
  runMetropolis,
  summarizeSamples
} from '../lib/bayes.js';
import { BayesInput, BayesWorkerRequest } from '../islands/bayes';
import { reportCaughtError } from '../core/reportError';

const makePosteriorSvg = (samples: number[]) => {
  const width = 320;
  const height = 120;
  const bins = 24;
  const counts = new Array(bins).fill(0);
  samples.forEach((value) => {
    const index = Math.min(bins - 1, Math.floor(value * bins));
    counts[index] += 1;
  });
  const maxCount = Math.max(...counts, 1);
  const barWidth = width / bins;
  const bars = counts
    .map((count, index) => {
      const barHeight = (count / maxCount) * (height - 24);
      const x = index * barWidth;
      const y = height - barHeight - 10;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(
        1
      )}" width="${(barWidth - 2).toFixed(1)}" height="${barHeight.toFixed(
        1
      )}" rx="2" />`;
    })
    .join('');
  return `
    <svg class="bayes-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Posterior density">
      <rect x="0" y="0" width="${width}" height="${height}" rx="10" />
      ${bars}
      <text x="12" y="18">Posterior p</text>
    </svg>
  `.trim();
};

const logPosterior = (p: number, a: number, b: number, failures: number, months: number) => {
  const safeP = clamp(p, 1e-6, 1 - 1e-6);
  const success = Math.max(0, months - failures);
  return (
    (a - 1 + failures) * Math.log(safeP) +
    (b - 1 + success) * Math.log(1 - safeP)
  );
};

const drawAmount = (
  mean: number,
  sd: number,
  distribution: BayesInput['incomeDistribution']
) =>
  distribution === 'lognormal'
    ? randomLogNormal(mean, sd)
    : Math.max(0, randomNormal(mean, sd));

const simulateReserve = (
  input: BayesInput,
  p: number,
  rng: () => number
) => {
  let reserve = input.reserve;
  let minReserve = reserve;
  for (let month = 0; month < input.months; month += 1) {
    const shock = rng() < p;
    let income = drawAmount(
      input.incomeMean,
      input.incomeSd,
      input.incomeDistribution
    );
    if (shock) {
      income *= Math.max(0, 1 - input.shockSeverity);
    }
    const expenses = drawAmount(
      input.expensesMean,
      input.expensesSd,
      input.expensesDistribution
    );
    reserve += income - expenses;
    minReserve = Math.min(minReserve, reserve);
    if (reserve < 0) break;
  }
  return { minReserve, failed: reserve < 0 };
};

let activeRequestId = '';
let shouldStop = false;

self.onmessage = (event: MessageEvent<BayesWorkerRequest>) => {
  const { type, requestId, input } = event.data;
  if (type === 'stop') {
    if (requestId === activeRequestId) {
      shouldStop = true;
    }
    return;
  }
  if (!input) return;

  activeRequestId = requestId;
  shouldStop = false;

  try {
    const {
      priorA,
      priorB,
      observationFailures,
      observationMonths,
      mcmcSamples,
      mcmcBurnIn,
      mcmcStep,
      simulationRuns
    } = input;

    const mcmc = runMetropolis({
      initial: priorA / (priorA + priorB),
      steps: mcmcSamples,
      burnIn: mcmcBurnIn,
      proposalStd: mcmcStep,
      logPosterior: (p: number) =>
        logPosterior(p, priorA, priorB, observationFailures, observationMonths),
      shouldAbort: () => shouldStop
    });

    if (mcmc.aborted) {
      self.postMessage({ type: 'cancelled', requestId });
      return;
    }

    const posterior = summarizeSamples(mcmc.samples);
    const ess = computeEss(mcmc.samples);

    let failures = 0;
    const minReserves: number[] = [];
    for (let i = 0; i < simulationRuns; i += 1) {
      if (shouldStop) {
        self.postMessage({ type: 'cancelled', requestId });
        return;
      }
      const pSample =
        mcmc.samples[Math.floor(Math.random() * mcmc.samples.length)] ??
        posterior.mean;
      const outcome = simulateReserve(input, pSample, Math.random);
      if (outcome.failed) failures += 1;
      minReserves.push(outcome.minReserve);
    }

    const riskProbability = failures / Math.max(1, simulationRuns);
    const reserveQuantiles: [number, number, number] = [
      quantile(minReserves, 0.1),
      quantile(minReserves, 0.5),
      quantile(minReserves, 0.9)
    ];

    const posterSvg = makePosteriorSvg(mcmc.samples);

    self.postMessage({
      type: 'success',
      requestId,
      result: {
        posterior,
        riskProbability,
        reserveQuantiles,
        posteriorSvg: posterSvg,
        effectiveSampleSize: ess,
        acceptanceRate: mcmc.acceptanceRate,
        sampleCount: mcmc.samples.length,
        observationMonths,
        observationFailures
      }
    });
  } catch (error) {
    reportCaughtError(error);
    const message =
      error instanceof Error ? error.message : 'Неожиданная ошибка воркера.';
    self.postMessage({ type: 'error', requestId, error: message });
  }
};
