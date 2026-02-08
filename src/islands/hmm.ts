import { ActionItem, IslandReport, Insight } from '../core/types';
import { reportCaughtError } from '../core/reportError';

export type HmmState = 'Stable' | 'Strain' | 'Crisis' | 'Recovery';
export type IncomeTrend = 'up' | 'flat' | 'down';
export type EnergyLevel = 'low' | 'med' | 'high';
export type ExpensesSpike = 'yes' | 'no';

export interface HmmObservation {
  incomeTrend: IncomeTrend;
  energy: EnergyLevel;
  expensesSpike: ExpensesSpike;
}

export interface HmmInput {
  weeks: HmmObservation[];
  transitionMatrix?: number[][];
  emissionMatrix?: number[][];
  initialDistribution?: number[];
  trainIterations?: number;
}

export interface HmmAnalysis {
  observations: HmmObservation[];
  encoded: number[];
  states: HmmState[];
  transitionMatrix: number[][];
  emissionMatrix: number[][];
  initialDistribution: number[];
  gamma: number[][];
  viterbiPath: HmmState[];
  nextDistribution: number[];
  crisisProbability: number;
  headlineState: HmmState;
  trained: boolean;
}

const states: HmmState[] = ['Stable', 'Strain', 'Crisis', 'Recovery'];
const incomeTrends: IncomeTrend[] = ['up', 'flat', 'down'];
const energyLevels: EnergyLevel[] = ['low', 'med', 'high'];
const expenseLevels: ExpensesSpike[] = ['no', 'yes'];

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeRow = (row: number[]) => {
  const sum = row.reduce((acc, value) => acc + value, 0);
  if (sum <= 0) {
    const uniform = 1 / Math.max(1, row.length);
    return row.map(() => uniform);
  }
  return row.map((value) => value / sum);
};

const normalizeMatrix = (matrix: number[][]) =>
  matrix.map((row) => normalizeRow(row));

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const buildDefaultTransition = (): number[][] =>
  normalizeMatrix([
    [0.62, 0.22, 0.04, 0.12],
    [0.18, 0.52, 0.2, 0.1],
    [0.05, 0.22, 0.56, 0.17],
    [0.38, 0.18, 0.08, 0.36]
  ]);

const buildEmissionByFeature = () => {
  const emissionByState = [
    {
      incomeTrend: { up: 0.5, flat: 0.35, down: 0.15 },
      energy: { high: 0.5, med: 0.35, low: 0.15 },
      expensesSpike: { no: 0.8, yes: 0.2 }
    },
    {
      incomeTrend: { up: 0.2, flat: 0.4, down: 0.4 },
      energy: { high: 0.2, med: 0.45, low: 0.35 },
      expensesSpike: { no: 0.6, yes: 0.4 }
    },
    {
      incomeTrend: { up: 0.1, flat: 0.2, down: 0.7 },
      energy: { high: 0.05, med: 0.25, low: 0.7 },
      expensesSpike: { no: 0.35, yes: 0.65 }
    },
    {
      incomeTrend: { up: 0.45, flat: 0.35, down: 0.2 },
      energy: { high: 0.4, med: 0.4, low: 0.2 },
      expensesSpike: { no: 0.7, yes: 0.3 }
    }
  ];

  return emissionByState.map((state) => {
    const row: number[] = [];
    incomeTrends.forEach((income) => {
      energyLevels.forEach((energy) => {
        expenseLevels.forEach((expense) => {
          row.push(
            state.incomeTrend[income] *
              state.energy[energy] *
              state.expensesSpike[expense]
          );
        });
      });
    });
    return normalizeRow(row);
  });
};

const buildDefaultEmission = () => normalizeMatrix(buildEmissionByFeature());

const defaultInitialDistribution = (): number[] =>
  normalizeRow([0.55, 0.25, 0.08, 0.12]);

const parseTrend = (value: string): IncomeTrend | null => {
  const normalized = value.trim().toLowerCase();
  if (['up', 'рост', 'increase', 'u'].includes(normalized)) return 'up';
  if (['flat', 'стаб', 'stable', 'f'].includes(normalized)) return 'flat';
  if (['down', 'пад', 'decrease', 'd'].includes(normalized)) return 'down';
  return null;
};

const parseEnergy = (value: string): EnergyLevel | null => {
  const normalized = value.trim().toLowerCase();
  if (['low', 'низ', 'l'].includes(normalized)) return 'low';
  if (['med', 'сред', 'm', 'mid'].includes(normalized)) return 'med';
  if (['high', 'выс', 'h'].includes(normalized)) return 'high';
  return null;
};

const parseExpense = (value: string): ExpensesSpike | null => {
  const normalized = value.trim().toLowerCase();
  if (['yes', 'да', 'y', 'true', '1'].includes(normalized)) return 'yes';
  if (['no', 'нет', 'n', 'false', '0'].includes(normalized)) return 'no';
  return null;
};

const encodeObservation = (observation: HmmObservation) => {
  const incomeIndex = incomeTrends.indexOf(observation.incomeTrend);
  const energyIndex = energyLevels.indexOf(observation.energy);
  const expenseIndex = expenseLevels.indexOf(observation.expensesSpike);
  if (incomeIndex < 0 || energyIndex < 0 || expenseIndex < 0) return null;
  return (incomeIndex * energyLevels.length + energyIndex) * expenseLevels.length + expenseIndex;
};

const parseObservationLine = (line: string): HmmObservation | null => {
  const tokens = line
    .split(/[;,|]/)
    .flatMap((part) => part.trim().split(/\s+/))
    .filter(Boolean);
  if (tokens.length < 3) return null;
  const income = parseTrend(tokens[0]);
  const energy = parseEnergy(tokens[1]);
  const expense = parseExpense(tokens[2]);
  if (!income || !energy || !expense) return null;
  return { incomeTrend: income, energy, expensesSpike: expense };
};

export const parseHmmInput = (raw: string): HmmInput => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { weeks: [] };
  }
  try {
    const parsed = JSON.parse(trimmed) as Partial<HmmInput> & {
      observations?: HmmObservation[];
      sequence?: HmmObservation[];
      addWeek?: HmmObservation;
    };
    const weeks = [
      ...(parsed.weeks ?? parsed.observations ?? parsed.sequence ?? [])
    ];
    if (parsed.addWeek) {
      weeks.push(parsed.addWeek);
    }
    return {
      weeks,
      transitionMatrix: parsed.transitionMatrix,
      emissionMatrix: parsed.emissionMatrix,
      initialDistribution: parsed.initialDistribution,
      trainIterations: parsed.trainIterations
    };
  } catch (error) {
    reportCaughtError(error);
    const lines = trimmed.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const weeks = lines
      .map((line) => parseObservationLine(line))
      .filter((item): item is HmmObservation => Boolean(item));
    return { weeks };
  }
};

const safeMatrix = (matrix: number[][] | undefined, rows: number, cols: number) => {
  if (!matrix || matrix.length !== rows) return null;
  if (matrix.some((row) => row.length !== cols)) return null;
  return normalizeMatrix(matrix);
};

const safeVector = (vector: number[] | undefined, length: number) => {
  if (!vector || vector.length !== length) return null;
  return normalizeRow(vector);
};

const runForwardBackward = (
  observations: number[],
  transitionMatrix: number[][],
  emissionMatrix: number[][],
  initialDistribution: number[]
) => {
  const T = observations.length;
  const N = transitionMatrix.length;
  const alpha: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));
  const beta: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));
  const scales: number[] = new Array(T).fill(0);

  for (let i = 0; i < N; i += 1) {
    alpha[0][i] = initialDistribution[i] * emissionMatrix[i][observations[0]];
  }
  let sum = alpha[0].reduce((acc, value) => acc + value, 0);
  scales[0] = sum === 0 ? 1 : 1 / sum;
  alpha[0] = alpha[0].map((value) => value * scales[0]);

  for (let t = 1; t < T; t += 1) {
    for (let j = 0; j < N; j += 1) {
      let total = 0;
      for (let i = 0; i < N; i += 1) {
        total += alpha[t - 1][i] * transitionMatrix[i][j];
      }
      alpha[t][j] = total * emissionMatrix[j][observations[t]];
    }
    sum = alpha[t].reduce((acc, value) => acc + value, 0);
    scales[t] = sum === 0 ? 1 : 1 / sum;
    alpha[t] = alpha[t].map((value) => value * scales[t]);
  }

  beta[T - 1] = beta[T - 1].map(() => scales[T - 1]);
  for (let t = T - 2; t >= 0; t -= 1) {
    for (let i = 0; i < N; i += 1) {
      let total = 0;
      for (let j = 0; j < N; j += 1) {
        total +=
          transitionMatrix[i][j] *
          emissionMatrix[j][observations[t + 1]] *
          beta[t + 1][j];
      }
      beta[t][i] = total * scales[t];
    }
  }

  const gamma: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));
  for (let t = 0; t < T; t += 1) {
    const raw = alpha[t].map((value, index) => value * beta[t][index]);
    const row = normalizeRow(raw);
    gamma[t] = row;
  }

  return { alpha, beta, gamma, scales };
};

const runViterbi = (
  observations: number[],
  transitionMatrix: number[][],
  emissionMatrix: number[][],
  initialDistribution: number[]
) => {
  const T = observations.length;
  const N = transitionMatrix.length;
  const log = (value: number) => Math.log(Math.max(value, 1e-12));
  const delta: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));
  const psi: number[][] = Array.from({ length: T }, () => new Array(N).fill(0));

  for (let i = 0; i < N; i += 1) {
    delta[0][i] = log(initialDistribution[i]) + log(emissionMatrix[i][observations[0]]);
    psi[0][i] = 0;
  }

  for (let t = 1; t < T; t += 1) {
    for (let j = 0; j < N; j += 1) {
      let maxVal = -Infinity;
      let maxIdx = 0;
      for (let i = 0; i < N; i += 1) {
        const value = delta[t - 1][i] + log(transitionMatrix[i][j]);
        if (value > maxVal) {
          maxVal = value;
          maxIdx = i;
        }
      }
      delta[t][j] = maxVal + log(emissionMatrix[j][observations[t]]);
      psi[t][j] = maxIdx;
    }
  }

  let lastState = delta[T - 1].reduce(
    (best, value, index) => (value > delta[T - 1][best] ? index : best),
    0
  );
  const path = new Array(T).fill(0);
  path[T - 1] = lastState;
  for (let t = T - 2; t >= 0; t -= 1) {
    path[t] = psi[t + 1][path[t + 1]];
  }
  return path.map((index) => states[index]);
};

const runBaumWelch = (
  observations: number[],
  transitionMatrix: number[][],
  emissionMatrix: number[][],
  initialDistribution: number[],
  iterations: number
) => {
  const N = transitionMatrix.length;
  const M = emissionMatrix[0].length;
  let A = transitionMatrix.map((row) => [...row]);
  let B = emissionMatrix.map((row) => [...row]);
  let pi = [...initialDistribution];

  for (let iter = 0; iter < iterations; iter += 1) {
    const { alpha, beta, gamma } = runForwardBackward(observations, A, B, pi);
    const T = observations.length;
    const xi: number[][][] = Array.from({ length: T - 1 }, () =>
      Array.from({ length: N }, () => new Array(N).fill(0))
    );

    for (let t = 0; t < T - 1; t += 1) {
      let total = 0;
      for (let i = 0; i < N; i += 1) {
        for (let j = 0; j < N; j += 1) {
          const value =
            alpha[t][i] *
            A[i][j] *
            B[j][observations[t + 1]] *
            beta[t + 1][j];
          xi[t][i][j] = value;
          total += value;
        }
      }
      if (total > 0) {
        for (let i = 0; i < N; i += 1) {
          for (let j = 0; j < N; j += 1) {
            xi[t][i][j] /= total;
          }
        }
      }
    }

    pi = normalizeRow([...gamma[0]]);

    for (let i = 0; i < N; i += 1) {
      const gammaSum = gamma.slice(0, T - 1).reduce((acc, row) => acc + row[i], 0);
      for (let j = 0; j < N; j += 1) {
        const xiSum = xi.reduce((acc, matrix) => acc + matrix[i][j], 0);
        A[i][j] = gammaSum === 0 ? 1 / N : xiSum / gammaSum;
      }
    }

    for (let i = 0; i < N; i += 1) {
      const gammaTotal = gamma.reduce((acc, row) => acc + row[i], 0);
      for (let k = 0; k < M; k += 1) {
        let sum = 0;
        for (let t = 0; t < T; t += 1) {
          if (observations[t] === k) sum += gamma[t][i];
        }
        B[i][k] = gammaTotal === 0 ? 1 / M : sum / gammaTotal;
      }
    }

    A = normalizeMatrix(A.map((row) => row.map((value) => Math.max(value, 1e-6))));
    B = normalizeMatrix(B.map((row) => row.map((value) => Math.max(value, 1e-6))));
  }

  return { transitionMatrix: A, emissionMatrix: B, initialDistribution: pi };
};

export const runHmmAnalysis = (input: HmmInput): HmmAnalysis => {
  const weeks = input.weeks.filter(Boolean);
  const encoded = weeks
    .map((week) => encodeObservation(week))
    .filter((value): value is number => value !== null);

  const transitionMatrix =
    safeMatrix(input.transitionMatrix, states.length, states.length) ??
    buildDefaultTransition();
  const emissionMatrix =
    safeMatrix(input.emissionMatrix, states.length, incomeTrends.length * energyLevels.length * expenseLevels.length) ??
    buildDefaultEmission();
  const initialDistribution =
    safeVector(input.initialDistribution, states.length) ??
    defaultInitialDistribution();

  let trained = false;
  let A = transitionMatrix;
  let B = emissionMatrix;
  let pi = initialDistribution;

  const iterations = Math.max(0, Math.floor(input.trainIterations ?? 0));
  if (encoded.length > 1 && iterations > 0) {
    const trainedModel = runBaumWelch(encoded, A, B, pi, Math.min(iterations, 25));
    A = trainedModel.transitionMatrix;
    B = trainedModel.emissionMatrix;
    pi = trainedModel.initialDistribution;
    trained = true;
  }

  if (encoded.length === 0) {
    const nextDistribution = normalizeRow(
      states.map((_, j) => pi.reduce((acc, value, i) => acc + value * A[i][j], 0))
    );
    const crisisIndex = states.indexOf('Crisis');
    const crisisProbability = pi[crisisIndex] ?? 0;
    const headlineIndex = pi.reduce(
      (best, value, index) => (value > pi[best] ? index : best),
      0
    );
    return {
      observations: weeks,
      encoded,
      states,
      transitionMatrix: A,
      emissionMatrix: B,
      initialDistribution: pi,
      gamma: [pi],
      viterbiPath: [],
      nextDistribution,
      crisisProbability,
      headlineState: states[headlineIndex],
      trained
    };
  }

  const forwardBackward = runForwardBackward(encoded, A, B, pi);
  const gamma = forwardBackward.gamma;
  const lastGamma = gamma[gamma.length - 1] ?? normalizeRow([...pi]);
  const crisisIndex = states.indexOf('Crisis');
  const crisisProbability = lastGamma[crisisIndex] ?? 0;
  const headlineIndex = lastGamma.reduce(
    (best, value, index) => (value > lastGamma[best] ? index : best),
    0
  );
  const headlineState = states[headlineIndex];
  const nextDistribution = normalizeRow(
    states.map((_, j) => lastGamma.reduce((acc, value, i) => acc + value * A[i][j], 0))
  );

  const viterbiPath = runViterbi(encoded, A, B, pi);

  return {
    observations: weeks,
    encoded,
    states,
    transitionMatrix: A,
    emissionMatrix: B,
    initialDistribution: pi,
    gamma,
    viterbiPath,
    nextDistribution,
    crisisProbability,
    headlineState,
    trained
  };
};

const buildActions = (state: HmmState, crisisProbability: number): ActionItem[] => {
  if (state === 'Crisis' || crisisProbability >= 0.5) {
    return [
      {
        title: 'Заморозить необязательные расходы на 2 недели',
        impact: 90,
        effort: 35,
        description: 'Снизит давление на кэшфлоу, пока не вернётся устойчивость.'
      },
      {
        title: 'Собрать антикризисный план и «стек выхода»',
        impact: 85,
        effort: 55,
        description: 'Чёткие шаги помогут быстрее перейти в Recovery.'
      },
      {
        title: 'Пересмотреть пики расходов и распределить их',
        impact: 75,
        effort: 40,
        description: 'Разглаживание пиков снижает вероятность углубления кризиса.'
      }
    ];
  }

  if (state === 'Strain') {
    return [
      {
        title: 'Уточнить план расходов на 4 недели вперёд',
        impact: 70,
        effort: 35,
        description: 'Ранние корректировки помогут избежать Crisis.'
      },
      {
        title: 'Поддержать энергию: сон/нагрузка/делегирование',
        impact: 65,
        effort: 30,
        description: 'Рост энергии усиливает шанс стабилизации.'
      },
      {
        title: 'Создать микрорезерв (1-2 недели)',
        impact: 60,
        effort: 45,
        description: 'Небольшой буфер снижает чувствительность к шокам.'
      }
    ];
  }

  if (state === 'Recovery') {
    return [
      {
        title: 'Зафиксировать рост дохода на уровне +10%',
        impact: 72,
        effort: 45,
        description: 'Закрепление тренда переводит систему в Stable.'
      },
      {
        title: 'План выходных + профилактика выгорания',
        impact: 55,
        effort: 30,
        description: 'Сохранит высокую энергию и снизит риск отката.'
      },
      {
        title: 'Оптимизировать регулярные траты',
        impact: 60,
        effort: 40,
        description: 'Снижает вероятность возврата в Strain.'
      }
    ];
  }

  return [
    {
      title: 'Закрепить стабильность: регулярный мониторинг',
      impact: 60,
      effort: 25,
      description: 'Стабильная обратная связь помогает не пропустить спад.'
    },
    {
      title: 'Подготовить резерв на 1 месяц',
      impact: 70,
      effort: 40,
      description: 'Резерв повышает устойчивость к неожиданным событиям.'
    },
    {
      title: 'Поддерживать уровень энергии через планирование',
      impact: 55,
      effort: 30,
      description: 'Чёткий ритм снижает вероятность Strain.'
    }
  ];
};

const buildInsights = (crisisProbability: number, nextState: HmmState): Insight[] => {
  const insights: Insight[] = [];
  if (crisisProbability >= 0.5) {
    insights.push({ title: 'Высокий риск закрепления кризиса', severity: 'risk' });
  } else if (crisisProbability >= 0.3) {
    insights.push({ title: 'Повышенный риск смещения в кризис', severity: 'warning' });
  } else {
    insights.push({ title: 'Кризис под контролем', severity: 'info' });
  }

  if (nextState === 'Crisis') {
    insights.push({
      title: 'Следующий шаг вероятнее в Crisis — нужно заранее подстелить соломку',
      severity: crisisProbability > 0.35 ? 'risk' : 'warning'
    });
  }

  return insights;
};

const buildConfidence = (gamma: number[][], sequenceLength: number) => {
  if (sequenceLength === 0) return 35;
  const avgMax =
    gamma.reduce((acc, row) => acc + Math.max(...row), 0) / sequenceLength;
  const lengthScore = Math.min(50, sequenceLength * 6);
  const stabilityScore = clamp(((avgMax - 0.25) / 0.75) * 40, 0, 40);
  return clamp(30 + lengthScore + stabilityScore, 25, 100);
};

export const getHmmReport = (rawInput: string): IslandReport => {
  const input = parseHmmInput(rawInput);
  const encodedPreview = input.weeks
    .map((week) => encodeObservation(week))
    .filter((value): value is number => value !== null);

  if (input.weeks.length === 0 || encodedPreview.length === 0) {
    return {
      id: 'hmm',
      score: 0,
      confidence: 25,
      headline: 'Добавьте хотя бы одну корректную неделю',
      summary: 'Нужна последовательность наблюдений (incomeTrend/energy/expenses).',
      details: [
        'Формат JSON: { "weeks": [{"incomeTrend":"up","energy":"high","expensesSpike":"no"}] }',
        'Либо строками: up high no / flat med yes',
        'Можно передать transitionMatrix, emissionMatrix, trainIterations.'
      ],
      actions: [
        {
          title: 'Добавить наблюдение за неделю',
          impact: 60,
          effort: 20,
          description: 'Минимум 2 недели для устойчивого пути.'
        }
      ],
      insights: [
        { title: 'Недостаточно данных для оценки состояния', severity: 'warning' }
      ]
    };
  }

  const analysis = runHmmAnalysis(input);
  const lastGamma = analysis.gamma[analysis.gamma.length - 1] ?? analysis.initialDistribution;
  const stateIndex = analysis.states.indexOf(analysis.headlineState);
  const stateProbability = lastGamma[stateIndex] ?? 0;
  const score = clamp((1 - analysis.crisisProbability) * 100, 0, 100);
  const confidence = buildConfidence(analysis.gamma, analysis.encoded.length);
  const nextIndex = analysis.nextDistribution.reduce(
    (best, value, index) => (value > analysis.nextDistribution[best] ? index : best),
    0
  );
  const nextState = analysis.states[nextIndex];
  const nextProbability = analysis.nextDistribution[nextIndex] ?? 0;
  const viterbiPath = analysis.viterbiPath.join(' → ');

  return {
    id: 'hmm',
    score,
    confidence,
    headline: `Сейчас: ${analysis.headlineState} (${formatPercent(stateProbability)})`,
    summary: `Последняя неделя: доход ${analysis.observations.at(-1)?.incomeTrend ?? 'n/a'}, энергия ${analysis.observations.at(-1)?.energy ?? 'n/a'}, всплеск расходов ${analysis.observations.at(-1)?.expensesSpike ?? 'n/a'}.`,
    details: [
      `P(Crisis_now): ${formatPercent(analysis.crisisProbability)}`,
      `Путь (Viterbi): ${viterbiPath}`,
      `Куда вероятнее перейдёшь: ${nextState} (${formatPercent(nextProbability)})`,
      analysis.trained
        ? 'Матрицы A/B переобучены (Baum-Welch).'
        : 'Использованы базовые матрицы A/B.'
    ],
    actions: buildActions(analysis.headlineState, analysis.crisisProbability),
    insights: buildInsights(analysis.crisisProbability, nextState)
  };
};
