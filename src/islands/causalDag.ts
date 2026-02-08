import { IslandReport } from '../core/types';
import { reportCaughtError } from '../core/reportError';
import {
  DagittyGraph,
  DagittyNode,
  DagittyModule,
  getDagitty
} from '../vendor/dagitty';

export interface DagEdgeInput {
  from: string;
  to: string;
}

export interface CausalDagInput {
  edges: DagEdgeInput[];
  exposure: string;
  outcome: string;
  controls: string[];
  mediators: string[];
}

export interface CausalDagAnalysis {
  nodes: string[];
  edges: DagEdgeInput[];
  exposure: string;
  outcome: string;
  adjustmentSets: string[][];
  colliders: string[];
  mediators: string[];
  badControls: {
    colliders: string[];
    mediators: string[];
  };
  levers: string[];
  isAcyclic: boolean;
  isConnected: boolean;
  isExposureOutcomeLinked: boolean;
  errors: string[];
  warnings: string[];
}

const NODE_NAME_REGEX = /^[A-Za-z0-9_-]+$/;

export const defaultCausalDagInput: CausalDagInput = {
  edges: [
    { from: 'Z', to: 'X' },
    { from: 'Z', to: 'Y' },
    { from: 'X', to: 'Y' }
  ],
  exposure: 'X',
  outcome: 'Y',
  controls: ['Z'],
  mediators: []
};

const uniq = (values: string[]) => Array.from(new Set(values));

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const normalizeName = (value: string) => value.trim();

const isValidName = (value: string) => NODE_NAME_REGEX.test(value);

const buildAdjacency = (edges: DagEdgeInput[]) => {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  edges.forEach((edge) => {
    if (!outgoing.has(edge.from)) outgoing.set(edge.from, []);
    if (!incoming.has(edge.from)) incoming.set(edge.from, []);
    if (!outgoing.has(edge.to)) outgoing.set(edge.to, []);
    if (!incoming.has(edge.to)) incoming.set(edge.to, []);
    outgoing.get(edge.from)?.push(edge.to);
    incoming.get(edge.to)?.push(edge.from);
  });
  return { outgoing, incoming };
};

const bfsReachable = (start: string, adjacency: Map<string, string[]>) => {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const current = queue.shift() as string;
    (adjacency.get(current) ?? []).forEach((next) => {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    });
  }
  return visited;
};

const shortestDistance = (
  start: string,
  goal: string,
  adjacency: Map<string, string[]>
) => {
  if (start === goal) return 0;
  const queue: Array<{ node: string; dist: number }> = [{ node: start, dist: 0 }];
  const visited = new Set<string>([start]);
  while (queue.length) {
    const { node, dist } = queue.shift() as { node: string; dist: number };
    for (const next of adjacency.get(node) ?? []) {
      if (visited.has(next)) continue;
      if (next === goal) return dist + 1;
      visited.add(next);
      queue.push({ node: next, dist: dist + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
};

const buildDotGraph = (edges: DagEdgeInput[], exposure: string, outcome: string) => {
  const lines = ['dag {'];
  if (exposure) lines.push(`  ${exposure} [exposure];`);
  if (outcome) lines.push(`  ${outcome} [outcome];`);
  edges.forEach((edge) => {
    lines.push(`  ${edge.from} -> ${edge.to};`);
  });
  lines.push('}');
  return lines.join('\n');
};

const mapVertices = (graph: DagittyGraph, nodes: string[]) =>
  nodes
    .map((node) => graph.getVertex(node))
    .filter((node): node is DagittyNode => Boolean(node));

const formatSet = (set: string[]) => `{${set.join(', ')}}`;

export const parseCausalDagInput = (raw: string): CausalDagInput => {
  if (!raw.trim()) return { ...defaultCausalDagInput };
  try {
    const parsed = JSON.parse(raw) as Partial<CausalDagInput>;
    return {
      edges: Array.isArray(parsed.edges)
        ? parsed.edges
            .map((edge) => ({
              from: normalizeName(String(edge.from ?? '')),
              to: normalizeName(String(edge.to ?? ''))
            }))
            .filter((edge) => edge.from && edge.to)
        : defaultCausalDagInput.edges,
      exposure: normalizeName(String(parsed.exposure ?? defaultCausalDagInput.exposure)),
      outcome: normalizeName(String(parsed.outcome ?? defaultCausalDagInput.outcome)),
      controls: Array.isArray(parsed.controls)
        ? parsed.controls.map((value) => normalizeName(String(value)))
        : defaultCausalDagInput.controls,
      mediators: Array.isArray(parsed.mediators)
        ? parsed.mediators.map((value) => normalizeName(String(value)))
        : defaultCausalDagInput.mediators
    };
  } catch (error) {
    reportCaughtError(error);
    return { ...defaultCausalDagInput };
  }
};

export const serializeCausalDagInput = (input: CausalDagInput) =>
  JSON.stringify(input, null, 2);

const detectColliders = (
  edges: DagEdgeInput[],
  exposure: string,
  outcome: string
) => {
  const incomingCounts = new Map<string, number>();
  edges.forEach((edge) => {
    incomingCounts.set(edge.to, (incomingCounts.get(edge.to) ?? 0) + 1);
  });
  return Array.from(incomingCounts.entries())
    .filter(([node, count]) => count >= 2 && node !== exposure && node !== outcome)
    .map(([node]) => node)
    .sort();
};

const detectMediators = (
  edges: DagEdgeInput[],
  exposure: string,
  outcome: string
) => {
  const { outgoing, incoming } = buildAdjacency(edges);
  const descendants = bfsReachable(exposure, outgoing);
  const ancestors = bfsReachable(outcome, incoming);
  return Array.from(descendants)
    .filter((node) => ancestors.has(node))
    .filter((node) => node !== exposure && node !== outcome)
    .sort();
};

const detectLevers = (
  edges: DagEdgeInput[],
  exposure: string,
  outcome: string,
  colliders: string[],
  mediators: string[]
) => {
  const { outgoing, incoming } = buildAdjacency(edges);
  const parentsOfOutcome = incoming.get(outcome) ?? [];
  const childrenOfExposure = outgoing.get(exposure) ?? [];
  const candidates = uniq([
    ...mediators,
    ...parentsOfOutcome,
    ...childrenOfExposure
  ]).filter((node) => node !== exposure && node !== outcome);

  const colliderSet = new Set(colliders);
  const scored = candidates.map((node) => {
    let score = 0;
    if (mediators.includes(node)) score += 3;
    if (parentsOfOutcome.includes(node)) score += 2;
    if (childrenOfExposure.includes(node)) score += 1;
    if (colliderSet.has(node)) score -= 2;

    const distanceToNode = shortestDistance(exposure, node, outgoing);
    const distanceToOutcome = shortestDistance(node, outcome, outgoing);
    const totalDistance =
      Number.isFinite(distanceToNode) && Number.isFinite(distanceToOutcome)
        ? distanceToNode + distanceToOutcome
        : Number.POSITIVE_INFINITY;
    return { node, score, totalDistance };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.totalDistance - b.totalDistance;
    })
    .map((item) => item.node)
    .slice(0, 3);
};

export const analyzeCausalDag = (input: CausalDagInput): CausalDagAnalysis => {
  const edges = input.edges
    .map((edge) => ({
      from: normalizeName(edge.from),
      to: normalizeName(edge.to)
    }))
    .filter((edge) => edge.from && edge.to);

  const exposure = normalizeName(input.exposure);
  const outcome = normalizeName(input.outcome);
  const controls = uniq(input.controls.map(normalizeName).filter(Boolean));
  const mediatorsHint = uniq(input.mediators.map(normalizeName).filter(Boolean));

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!edges.length) {
    errors.push('Добавьте хотя бы одно ребро A -> B.');
  }

  if (!exposure || !outcome) {
    errors.push('Задайте Exposure и Outcome.');
  }

  const nodes = uniq(edges.flatMap((edge) => [edge.from, edge.to])).sort();

  if (exposure && !nodes.includes(exposure)) {
    errors.push(`Exposure ${exposure} отсутствует в списке узлов.`);
  }

  if (outcome && !nodes.includes(outcome)) {
    errors.push(`Outcome ${outcome} отсутствует в списке узлов.`);
  }

  nodes.forEach((node) => {
    if (!isValidName(node)) {
      errors.push(`Недопустимое имя узла: ${node}. Используйте латиницу/цифры/_/-.`);
    }
  });

  let dagitty: DagittyModule | null = null;
  let graph: DagittyGraph | null = null;

  if (!errors.length) {
    try {
      dagitty = getDagitty();
      const dot = buildDotGraph(edges, exposure, outcome);
      graph = dagitty.GraphParser.parseDot(dot) as DagittyGraph;
      const source = graph.getVertex(exposure);
      const target = graph.getVertex(outcome);
      if (source) graph.setSources([source]);
      if (target) graph.setTargets([target]);
      graph.setAdjustedNodes(mapVertices(graph, controls));
    } catch (error) {
      reportCaughtError(error);
      errors.push(`Не удалось разобрать DAG: ${(error as Error).message}`);
    }
  }

  const isAcyclic = graph ? !dagitty?.GraphAnalyzer.containsCycle(graph) : false;
  if (graph && dagitty && !isAcyclic) {
    errors.push('Обнаружен цикл. DAG должен быть ацикличным.');
  }

  const colliders = detectColliders(edges, exposure, outcome);
  const mediators = detectMediators(edges, exposure, outcome);
  const badColliderControls = controls.filter((node) => colliders.includes(node));
  const badMediatorControls = controls.filter((node) => mediators.includes(node));

  const { outgoing } = buildAdjacency(edges);
  const reachable = bfsReachable(exposure, outgoing);
  const isExposureOutcomeLinked = reachable.has(outcome);

  const adjustmentSets: string[][] = [];
  let isConnected = false;

  if (graph && dagitty && !errors.length) {
    try {
      const sets = dagitty.GraphAnalyzer.listMsasTotalEffect(graph) ?? [];
      sets.forEach((set) => {
        adjustmentSets.push(set.map((node) => node.id).sort());
      });
      adjustmentSets.sort((a, b) => a.length - b.length || a.join(',').localeCompare(b.join(',')));
    } catch (error) {
      reportCaughtError(error);
      warnings.push(`Не удалось получить adjustment sets: ${(error as Error).message}`);
    }

    const components = dagitty.GraphAnalyzer.connectedComponents(graph);
    isConnected = components.length <= 1;
  }

  if (mediatorsHint.length) {
    const notOnPath = mediatorsHint.filter((node) => !mediators.includes(node));
    if (notOnPath.length) {
      warnings.push(`Проверьте медиаторы: ${notOnPath.join(', ')} не лежат на пути X→Y.`);
    }
  }

  const levers = detectLevers(edges, exposure, outcome, colliders, mediators);

  return {
    nodes,
    edges,
    exposure,
    outcome,
    adjustmentSets,
    colliders,
    mediators,
    badControls: {
      colliders: badColliderControls,
      mediators: badMediatorControls
    },
    levers,
    isAcyclic,
    isConnected,
    isExposureOutcomeLinked,
    errors,
    warnings
  };
};

const buildErrorReport = (errors: string[]): IslandReport => ({
  id: 'causalDag',
  score: 25,
  confidence: 25,
  headline: 'Причинный граф требует уточнений',
  summary: 'Проверьте структуру DAG и заданные роли Exposure/Outcome.',
  details: errors,
  actions: [
    {
      title: 'Уточнить структуру графа',
      impact: 70,
      effort: 30,
      description: 'Уберите циклы, добавьте недостающие связи и роли.'
    }
  ],
  insights: [
    {
      title: 'Без корректного DAG вычислить backdoor-наборы невозможно',
      severity: 'risk'
    }
  ]
});

const buildAdjustmentSummary = (sets: string[][]) => {
  if (!sets.length) return 'Минимальные adjustment sets не найдены.';
  const visible = sets.slice(0, 5).map(formatSet).join(', ');
  const hiddenCount = Math.max(0, sets.length - 5);
  return hiddenCount > 0
    ? `Минимальные adjustment sets: ${visible} и ещё ${hiddenCount}.`
    : `Минимальные adjustment sets: ${visible}.`;
};

const buildBadControlsSummary = (colliders: string[], mediators: string[]) => {
  if (!colliders.length && !mediators.length) {
    return 'Плохих контролей не обнаружено.';
  }
  const parts = [];
  if (colliders.length) {
    parts.push(`collider: ${colliders.join(', ')}`);
  }
  if (mediators.length) {
    parts.push(`mediator: ${mediators.join(', ')}`);
  }
  return `Плохие контроли: ${parts.join('; ')}.`;
};

const buildActions = (analysis: CausalDagAnalysis) => {
  const actions = [] as NonNullable<IslandReport['actions']>;

  if (analysis.badControls.colliders.length) {
    actions.push({
      title: 'Не контролируйте colliders',
      impact: 80,
      effort: 20,
      description: `Уберите из контролей: ${analysis.badControls.colliders.join(', ')}.`
    });
  }

  if (analysis.badControls.mediators.length) {
    actions.push({
      title: 'Не контролируйте mediators',
      impact: 75,
      effort: 25,
      description: `Исключите медиаторы: ${analysis.badControls.mediators.join(', ')}.`
    });
  }

  if (!analysis.adjustmentSets.length) {
    actions.push({
      title: 'Добавьте потенциальные конфаундеры',
      impact: 70,
      effort: 40,
      description: 'Расширьте граф общими причинами X и Y.'
    });
  }

  if (!analysis.isExposureOutcomeLinked) {
    actions.push({
      title: 'Проверьте путь X → Y',
      impact: 65,
      effort: 30,
      description: 'Убедитесь, что от Exposure есть направленный путь к Outcome.'
    });
  }

  if (!analysis.levers.length) {
    actions.push({
      title: 'Уточните рычаги воздействия',
      impact: 60,
      effort: 35,
      description: 'Добавьте переменные, которые влияют на Outcome напрямую.'
    });
  }

  if (actions.length < 2) {
    actions.push({
      title: 'Перепроверьте направления связей',
      impact: 50,
      effort: 25,
      description: 'Сфокусируйтесь на ключевых стрелках и их обосновании.'
    });
  }

  return actions.slice(0, 4);
};

export const getCausalDagReport = (input: string): IslandReport => {
  const parsed = parseCausalDagInput(input);
  const analysis = analyzeCausalDag(parsed);

  if (analysis.errors.length) {
    return buildErrorReport(analysis.errors);
  }

  const adjustmentSummary = buildAdjustmentSummary(analysis.adjustmentSets);
  const badControlsSummary = buildBadControlsSummary(
    analysis.badControls.colliders,
    analysis.badControls.mediators
  );

  const scoreBase =
    40 +
    (analysis.adjustmentSets.length ? 25 : 0) +
    (analysis.levers.length ? 20 : 0) -
    (analysis.badControls.colliders.length + analysis.badControls.mediators.length) * 10 -
    (analysis.isConnected ? 0 : 10) -
    (analysis.isExposureOutcomeLinked ? 0 : 15);

  const score = clamp(scoreBase, 0, 100);

  let confidence = 0.2;
  if (analysis.isAcyclic) confidence += 0.3;
  if (analysis.exposure && analysis.outcome) confidence += 0.2;
  if (analysis.isExposureOutcomeLinked) confidence += 0.2;
  if (analysis.adjustmentSets.length) confidence += 0.2;
  if (!analysis.isConnected) confidence -= 0.1;
  confidence = clamp(confidence, 0, 1);

  const leverText = analysis.levers.length
    ? analysis.levers.join(', ')
    : 'рычаги не найдены';

  const headline = analysis.levers.length
    ? `Рычаги найдены: ${analysis.exposure} → … → ${analysis.outcome}`
    : `Нужны рычаги для ${analysis.outcome}`;

  const details = [
    `Узлы: ${analysis.nodes.join(', ') || 'нет'}.`,
    `Exposure: ${analysis.exposure}. Outcome: ${analysis.outcome}.`,
    adjustmentSummary,
    badControlsSummary,
    `Рекомендуемые рычаги: ${leverText}.`
  ];

  if (analysis.warnings.length) {
    details.push(...analysis.warnings);
  }

  return {
    id: 'causalDag',
    score: Math.round(score),
    confidence: Math.round(confidence * 100),
    headline,
    summary: `Backdoor-наборы: ${analysis.adjustmentSets.length || 0}. Рычаги: ${analysis.levers.length}.`,
    details,
    actions: buildActions(analysis),
    insights: [
      {
        title: analysis.isExposureOutcomeLinked
          ? 'Exposure связан с Outcome — можно оценивать эффект'
          : 'Связь Exposure → Outcome не подтверждена',
        severity: analysis.isExposureOutcomeLinked ? 'info' : 'warning'
      },
      {
        title: analysis.badControls.colliders.length || analysis.badControls.mediators.length
          ? 'Есть риск смещения из-за плохих контролей'
          : 'Контрольные переменные выглядят безопасно',
        severity: analysis.badControls.colliders.length || analysis.badControls.mediators.length
          ? 'risk'
          : 'info'
      }
    ]
  };
};
