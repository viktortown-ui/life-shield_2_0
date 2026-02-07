export const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value));

export const randomNormal = (mean = 0, sd = 1, rng = Math.random) => {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * sd + mean;
};

const logNormalParams = (mean, sd) => {
  const variance = sd ** 2;
  const sigma2 = Math.log(1 + variance / (mean ** 2));
  const sigma = Math.sqrt(sigma2);
  const mu = Math.log(mean) - sigma2 / 2;
  return { mu, sigma };
};

export const randomLogNormal = (mean, sd, rng = Math.random) => {
  const safeMean = Math.max(1, mean);
  const safeSd = Math.max(1, sd);
  const { mu, sigma } = logNormalParams(safeMean, safeSd);
  return Math.exp(randomNormal(mu, sigma, rng));
};

export const quantile = (values, q) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
};

export const summarizeSamples = (samples) => {
  if (!samples.length) {
    return { mean: 0, ciLow: 0, ciHigh: 0, quantiles: [0, 0, 0] };
  }
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const ciLow = quantile(samples, 0.05);
  const ciHigh = quantile(samples, 0.95);
  const quantiles = [
    quantile(samples, 0.1),
    quantile(samples, 0.5),
    quantile(samples, 0.9)
  ];
  return { mean, ciLow, ciHigh, quantiles };
};

export const computeEss = (samples) => {
  const n = samples.length;
  if (n < 3) return n;
  const mean = samples.reduce((sum, value) => sum + value, 0) / n;
  const variance =
    samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1);
  if (variance === 0) return n;
  let cov = 0;
  for (let i = 0; i < n - 1; i += 1) {
    cov += (samples[i] - mean) * (samples[i + 1] - mean);
  }
  const rho1 = cov / ((n - 1) * variance);
  const ess = n * (1 - rho1) / (1 + rho1);
  return Math.max(1, Math.min(n, ess));
};

const logistic = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(p / (1 - p));

export const runMetropolis = ({
  initial,
  steps,
  burnIn,
  proposalStd,
  logPosterior,
  rng = Math.random,
  shouldAbort
}) => {
  const samples = [];
  let current = clamp(initial, 1e-6, 1 - 1e-6);
  let currentLog = logPosterior(current);
  let accepted = 0;
  const totalSteps = steps + burnIn;
  for (let i = 0; i < totalSteps; i += 1) {
    if (shouldAbort?.()) {
      return { samples, acceptanceRate: accepted / Math.max(1, i), aborted: true };
    }
    const proposedLogit = logit(current) + randomNormal(0, proposalStd, rng);
    const proposed = clamp(logistic(proposedLogit), 1e-6, 1 - 1e-6);
    const proposedLog = logPosterior(proposed);
    const accept = Math.log(rng()) < proposedLog - currentLog;
    if (accept) {
      current = proposed;
      currentLog = proposedLog;
      accepted += 1;
    }
    if (i >= burnIn) {
      samples.push(current);
    }
  }
  return { samples, acceptanceRate: accepted / totalSteps, aborted: false };
};
