import { IslandReport } from '../core/types';

interface ParsedDagInput {
  edges: DagEdge[];
  nodes: string[];
  target: string | null;
  intervention: { node: string; value: number } | null;
  runs: number;
  errors: string[];
  notes: string[];
}

interface DagEdge {
  from: string;
  to: string;
  weight: number;
}

interface SimulationResult {
  baseline: number[];
  intervention: number[];
  effect: number[];
}

const DEFAULT_WEIGHT = 0.3;
const DEFAULT_RUNS = 700;
const DEFAULT_DO_VALUE = 0.8;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const sigmoid = (value: number) => 1 / (1 + Math.exp(-value));

const formatNumber = (value: number, digits = 3) =>
  Number.isFinite(value) ? value.toFixed(digits) : '—';

const randomNormal = () => {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const parseDagInput = (raw: string): ParsedDagInput => {
  const edges: DagEdge[] = [];
  const nodes = new Set<string>();
  const errors: string[] = [];
  const notes: string[] = [];
  let target: string | null = null;
  let intervention: { node: string; value: number } | null = null;
  let runs = DEFAULT_RUNS;

  const lines = raw.split(/\r?\n/).map((line) => line.trim());

  lines.forEach((line, index) => {
    if (!line || line.startsWith('#') || line.startsWith('//')) {
      return;
    }

    const doMatch = line.match(
      /^do\s*\(\s*([\w-]+)\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+))\s*\)$/i
    );
    if (doMatch) {
      intervention = {
        node: doMatch[1],
        value: clamp(Number(doMatch[2]), 0, 1)
      };
      nodes.add(doMatch[1]);
      return;
    }

    const doAltMatch = line.match(
      /^(do|intervention|x)\s*[:=]\s*([\w-]+)(?:\s*=\s*([+-]?(?:\d+\.?\d*|\.\d+)))?$/i
    );
    if (doAltMatch) {
      const value = doAltMatch[3]
        ? clamp(Number(doAltMatch[3]), 0, 1)
        : DEFAULT_DO_VALUE;
      intervention = { node: doAltMatch[2], value };
      nodes.add(doAltMatch[2]);
      if (!doAltMatch[3]) {
        notes.push(
          `Для do-интервенции по умолчанию используется значение ${DEFAULT_DO_VALUE}.`
        );
      }
      return;
    }

    const targetMatch = line.match(/^(target|y)\s*[:=]\s*([\w-]+)$/i);
    if (targetMatch) {
      target = targetMatch[2];
      nodes.add(targetMatch[2]);
      return;
    }

    const runsMatch = line.match(/^(runs|samples|simulations)\s*[:=]\s*(\d+)$/i);
    if (runsMatch) {
      runs = clamp(Number(runsMatch[2]), 200, 5000);
      return;
    }

    const edgeMatch = line.match(
      /^([\w-]+)\s*->\s*([\w-]+)\s*(?:\(([^)]+)\))?$/
    );
    if (!edgeMatch) {
      errors.push(`Строка ${index + 1}: не удалось разобрать «${line}».`);
      return;
    }

    const from = edgeMatch[1];
    const to = edgeMatch[2];
    const weightText = edgeMatch[3];
    let weight = DEFAULT_WEIGHT;
    if (weightText) {
      const match = weightText.match(/[-+]?(?:\d+\.?\d*|\.\d+)/);
      if (match) {
        weight = Number(match[0]);
      } else {
        errors.push(`Строка ${index + 1}: не удалось прочитать вес в «${line}».`);
      }
    }

    edges.push({ from, to, weight });
    nodes.add(from);
    nodes.add(to);
  });

  return {
    edges,
    nodes: Array.from(nodes),
    target,
    intervention,
    runs,
    errors,
    notes
  };
};

const buildAdjacency = (nodes: string[], edges: DagEdge[]) => {
  const adjacency = new Map<string, string[]>();
  nodes.forEach((node) => adjacency.set(node, []));
  edges.forEach((edge) => {
    if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
    adjacency.get(edge.from)?.push(edge.to);
  });
  return adjacency;
};

const findCycle = (nodes: string[], edges: DagEdge[]): string[] | null => {
  const adjacency = buildAdjacency(nodes, edges);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];

  const dfs = (node: string): string[] | null => {
    if (visiting.has(node)) {
      const cycleStart = stack.indexOf(node);
      return cycleStart >= 0 ? stack.slice(cycleStart).concat(node) : [node];
    }
    if (visited.has(node)) return null;

    visiting.add(node);
    stack.push(node);

    const neighbors = adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      const cycle = dfs(neighbor);
      if (cycle) return cycle;
    }

    visiting.delete(node);
    visited.add(node);
    stack.pop();
    return null;
  };

  for (const node of nodes) {
    const cycle = dfs(node);
    if (cycle) return cycle;
  }

  return null;
};

const topologicalSort = (nodes: string[], edges: DagEdge[]): string[] | null => {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach((node) => {
    inDegree.set(node, 0);
    adjacency.set(node, []);
  });

  edges.forEach((edge) => {
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  });

  const queue: string[] = [];
  inDegree.forEach((degree, node) => {
    if (degree === 0) queue.push(node);
  });

  const order: string[] = [];
  while (queue.length) {
    const node = queue.shift() as string;
    order.push(node);
    (adjacency.get(node) ?? []).forEach((neighbor) => {
      const nextDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) queue.push(neighbor);
    });
  }

  return order.length === nodes.length ? order : null;
};

const percentile = (values: number[], pct: number) => {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * pct;
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  const weight = idx - low;
  return sorted[low] * (1 - weight) + sorted[high] * weight;
};

const mean = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / (values.length || 1);

const simulateScm = (
  order: string[],
  edges: DagEdge[],
  runs: number,
  target: string,
  intervention: { node: string; value: number } | null
): SimulationResult => {
  const indexMap = new Map<string, number>();
  order.forEach((node, idx) => indexMap.set(node, idx));

  const parentIndex = order.map(() => [] as Array<{ index: number; weight: number }>);
  edges.forEach((edge) => {
    const parentIdx = indexMap.get(edge.from);
    const childIdx = indexMap.get(edge.to);
    if (parentIdx === undefined || childIdx === undefined) return;
    parentIndex[childIdx].push({ index: parentIdx, weight: edge.weight });
  });

  const targetIndex = indexMap.get(target) ?? 0;
  const baseline: number[] = [];
  const interventionValues: number[] = [];
  const effect: number[] = [];

  for (let run = 0; run < runs; run += 1) {
    const noise = order.map(() => randomNormal());
    const values = new Array(order.length).fill(0);

    order.forEach((_, idx) => {
      const sum = parentIndex[idx].reduce(
        (acc, parent) => acc + values[parent.index] * parent.weight,
        0
      );
      values[idx] = sigmoid(sum + noise[idx]);
    });

    baseline.push(values[targetIndex]);

    if (intervention) {
      const valuesDo = new Array(order.length).fill(0);
      order.forEach((node, idx) => {
        if (node === intervention.node) {
          valuesDo[idx] = intervention.value;
          return;
        }
        const sum = parentIndex[idx].reduce(
          (acc, parent) => acc + valuesDo[parent.index] * parent.weight,
          0
        );
        valuesDo[idx] = sigmoid(sum + noise[idx]);
      });
      interventionValues.push(valuesDo[targetIndex]);
      effect.push(valuesDo[targetIndex] - values[targetIndex]);
    }
  }

  return { baseline, intervention: interventionValues, effect };
};

const buildErrorReport = (input: string, errors: string[]): IslandReport => ({
  id: 'causalDag',
  score: 15,
  confidence: 20,
  headline: 'Причинный граф требует правки',
  summary: input.trim()
    ? 'Найдены ошибки в описании DAG. Исправьте формат и связи.'
    : 'Добавьте DAG в формате A -> B (+0.4).',
  details: errors.length ? errors : ['Не удалось прочитать причинный граф.'],
  actions: [
    {
      title: 'Исправить формат и удалить циклы',
      impact: 70,
      effort: 30,
      description: 'Причинный граф должен быть ацикличным.'
    }
  ],
  insights: [
    {
      title: 'Пока DAG некорректен, симуляция невозможна',
      severity: 'risk'
    }
  ]
});

const findAncestors = (node: string, parentMap: Map<string, string[]>) => {
  const visited = new Set<string>();
  const stack = [node];
  while (stack.length) {
    const current = stack.pop() as string;
    (parentMap.get(current) ?? []).forEach((parent) => {
      if (!visited.has(parent)) {
        visited.add(parent);
        stack.push(parent);
      }
    });
  }
  return visited;
};

const pickDefaultNode = (
  nodes: string[],
  edges: DagEdge[],
  type: 'source' | 'sink'
) => {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  nodes.forEach((node) => {
    incoming.set(node, 0);
    outgoing.set(node, 0);
  });
  edges.forEach((edge) => {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
    outgoing.set(edge.from, (outgoing.get(edge.from) ?? 0) + 1);
  });

  const candidates = nodes.filter((node) => {
    if (type === 'source') return (incoming.get(node) ?? 0) === 0;
    return (outgoing.get(node) ?? 0) === 0;
  });
  if (candidates.length) return candidates.sort()[0];
  return nodes.sort()[0];
};

const estimateKeyLevers = (
  order: string[],
  edges: DagEdge[],
  baselineMean: number,
  target: string,
  runs: number
) => {
  const candidates = order.filter((node) => node !== target);
  const leverRuns = clamp(Math.round(runs / 3), 200, 600);
  const results = candidates.map((node) => {
    const sim = simulateScm(order, edges, leverRuns, target, {
      node,
      value: 0.9
    });
    const meanValue = mean(sim.intervention);
    return { node, delta: meanValue - baselineMean };
  });
  return results.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
};

export const getCausalDagReport = (input: string): IslandReport => {
  const parsed = parseDagInput(input);

  if (!parsed.edges.length) {
    return buildErrorReport(input, [
      'Добавьте хотя бы одну связь вида A -> B (+0.4).',
      'Можно задавать веса в скобках, по умолчанию используется +0.3.'
    ]);
  }

  if (parsed.errors.length) {
    return buildErrorReport(input, parsed.errors);
  }

  const cycle = findCycle(parsed.nodes, parsed.edges);
  if (cycle) {
    return buildErrorReport(input, [
      `Обнаружен цикл: ${cycle.join(' → ')}.`,
      'DAG должен быть ацикличным.'
    ]);
  }

  const order = topologicalSort(parsed.nodes, parsed.edges);
  if (!order) {
    return buildErrorReport(input, ['Не удалось получить топологический порядок.']);
  }

  const target = parsed.target ?? pickDefaultNode(order, parsed.edges, 'sink');
  const interventionNode =
    parsed.intervention?.node ?? pickDefaultNode(order, parsed.edges, 'source');
  const interventionValue = parsed.intervention?.value ?? DEFAULT_DO_VALUE;

  if (!parsed.target) {
    parsed.notes.push(
      `Цель не задана явно, выбрана ${target}. Используйте строку "target: <Y>".`
    );
  }
  if (!parsed.intervention) {
    parsed.notes.push(
      `Интервенция не задана явно, выбрана do(${interventionNode}=${formatNumber(
        interventionValue,
        2
      )}). Используйте строку "do(X=0.8)".`
    );
  }

  const sim = simulateScm(order, parsed.edges, parsed.runs, target, {
    node: interventionNode,
    value: interventionValue
  });

  const baselineMean = mean(sim.baseline);
  const doMean = mean(sim.intervention);
  const effectMean = mean(sim.effect);
  const effectP10 = percentile(sim.effect, 0.1);
  const effectP90 = percentile(sim.effect, 0.9);
  const effectWidth = effectP90 - effectP10;

  const baselineP10 = percentile(sim.baseline, 0.1);
  const baselineP90 = percentile(sim.baseline, 0.9);
  const doP10 = percentile(sim.intervention, 0.1);
  const doP90 = percentile(sim.intervention, 0.9);

  const parentMap = new Map<string, string[]>();
  parsed.nodes.forEach((node) => parentMap.set(node, []));
  parsed.edges.forEach((edge) => {
    parentMap.get(edge.to)?.push(edge.from);
  });

  const ancestorsX = findAncestors(interventionNode, parentMap);
  const ancestorsY = findAncestors(target, parentMap);
  const confounders = Array.from(ancestorsX)
    .filter((node) => ancestorsY.has(node))
    .filter((node) => node !== interventionNode && node !== target);

  const levers = estimateKeyLevers(order, parsed.edges, baselineMean, target, parsed.runs);
  const leverText = levers.length
    ? levers
        .map((lever) => `${lever.node} (Δ${formatNumber(lever.delta, 3)})`)
        .join(', ')
    : 'Нет явных лидеров';

  const score = clamp(50 + Math.abs(effectMean) * 120 - effectWidth * 90, 0, 100);
  const confidence = clamp(90 - effectWidth * 120, 25, 95);

  const details = [
    `Граф: ${parsed.nodes.length} узлов, ${parsed.edges.length} связей. ` +
      `Топологический порядок: ${order.join(' → ')}.`,
    `Цель: ${target}. Интервенция: do(${interventionNode}=${formatNumber(
      interventionValue,
      2
    )}), ${parsed.runs} прогонов.`,
    `Baseline Y: mean=${formatNumber(baselineMean)}, p10=${formatNumber(
      baselineP10
    )}, p90=${formatNumber(baselineP90)}.`,
    `do-распределение: mean=${formatNumber(doMean)}, p10=${formatNumber(
      doP10
    )}, p90=${formatNumber(doP90)}.`,
    `Эффект (do - baseline): mean=${formatNumber(effectMean)}, p10=${formatNumber(
      effectP10
    )}, p90=${formatNumber(effectP90)}, ширина=${formatNumber(effectWidth)}.`,
    `Ключевые рычаги: ${leverText}.`,
    confounders.length
      ? `Backdoor hint: общие предки X и Y → ${confounders.join(', ')}.`
      : 'Backdoor hint: общие предки X и Y не найдены.'
  ];

  if (parsed.notes.length) {
    details.push(...parsed.notes);
  }

  const actions = [
    {
      title: 'Проверьте веса ключевых ребер',
      impact: clamp(60 + Math.abs(effectMean) * 40, 40, 90),
      effort: 30,
      description:
        'Уточните наиболее влиятельные связи и обновите веса в DAG.'
    },
    {
      title: 'Соберите данные по конфаундерам',
      impact: confounders.length ? 65 : 40,
      effort: 35,
      description: confounders.length
        ? `Контролируйте: ${confounders.join(', ')}.`
        : 'Если появятся общие причины, добавьте их в DAG.'
    }
  ];

  const insights = [
    {
      title:
        effectWidth > 0.25
          ? 'Высокая неопределённость эффекта — нужны дополнительные данные'
          : 'Интервал эффекта умеренный, но держите его под контролем',
      severity: effectWidth > 0.3 ? 'risk' : 'warning'
    },
    {
      title:
        Math.abs(effectMean) > 0.1
          ? 'Есть заметный причинный рычаг'
          : 'Эффект слабый, возможно нужен другой рычаг',
      severity: Math.abs(effectMean) > 0.1 ? 'info' : 'warning'
    }
  ];

  return {
    id: 'causalDag',
    score: Math.round(score),
    confidence: Math.round(confidence),
    headline:
      Math.abs(effectMean) > 0.1
        ? `Причинный эффект на ${target} заметен`
        : `Эффект на ${target} слабый`,
    summary: `do(${interventionNode}=${formatNumber(
      interventionValue,
      2
    )}) → Δ${formatNumber(effectMean)} (p10=${formatNumber(
      effectP10
    )}, p90=${formatNumber(effectP90)}).`,
    details,
    actions,
    insights
  };
};
