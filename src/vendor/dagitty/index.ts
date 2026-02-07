import dagittySource from './dagitty-alg.js?raw';

export interface DagittyModule {
  Graph: unknown;
  GraphParser: {
    parseDot: (code: string) => DagittyGraph;
  };
  GraphAnalyzer: {
    listMsasTotalEffect: (graph: DagittyGraph) => DagittyNode[][];
    connectedComponents: (graph: DagittyGraph) => DagittyNode[][];
    containsCycle: (graph: DagittyGraph) => boolean;
  };
}

export interface DagittyNode {
  id: string;
}

export interface DagittyGraph {
  setSources: (nodes: DagittyNode[]) => void;
  setTargets: (nodes: DagittyNode[]) => void;
  setAdjustedNodes: (nodes: DagittyNode[]) => void;
  getVertex: (id: string) => DagittyNode | undefined;
}

let cachedDagitty: DagittyModule | null = null;

export const getDagitty = (): DagittyModule => {
  if (cachedDagitty) return cachedDagitty;
  const factory = new Function(
    `${dagittySource}; return typeof DAGitty !== 'undefined' ? DAGitty : undefined;`
  );
  const instance = factory() as DagittyModule | undefined;
  if (!instance) {
    throw new Error('Не удалось загрузить DAGitty (libdagitty).');
  }
  cachedDagitty = instance;
  return instance;
};
