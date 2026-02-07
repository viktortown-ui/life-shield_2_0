import { GLPK } from 'glpk.js';
import {
  OptimizationActionInput,
  OptimizationInput,
  OptimizationSolution,
  OptimizationWorkerRequest,
  OptimizationWorkerResponse
} from '../islands/optimization';

const glpkPromise = GLPK();

const solveOptimization = (
  glpk: Awaited<ReturnType<typeof GLPK>>,
  input: OptimizationInput
): OptimizationSolution => {
  if (!input.actions.length) {
    return {
      status: 'error',
      selected: [],
      totalImpact: 0,
      totalHours: 0,
      totalMoney: 0,
      error: 'Список действий пуст.'
    };
  }

  const variables = input.actions.map((_, index) => `x${index}`);
  const bounds = variables.map((name, index) => {
    const action = input.actions[index];
    if (action.mandatory) {
      return { name, type: glpk.GLP_FX, lb: 1, ub: 1 };
    }
    return { name, type: glpk.GLP_DB, lb: 0, ub: 1 };
  });

  const lp = {
    name: 'life-shield-optimization',
    objective: {
      direction: glpk.GLP_MAX,
      name: 'totalImpact',
      vars: variables.map((name, index) => ({
        name,
        coef: input.actions[index].impactScore
      }))
    },
    subjectTo: [
      {
        name: 'hoursLimit',
        vars: variables.map((name, index) => ({
          name,
          coef: input.actions[index].hoursCost
        })),
        bnds: { type: glpk.GLP_UP, ub: input.maxHours, lb: 0 }
      },
      {
        name: 'moneyLimit',
        vars: variables.map((name, index) => ({
          name,
          coef: input.actions[index].moneyCost
        })),
        bnds: { type: glpk.GLP_UP, ub: input.maxMoney, lb: 0 }
      }
    ],
    bounds,
    binaries: variables
  };

  const result = glpk.solve(lp, { msgLevel: glpk.GLP_MSG_OFF });
  const status = result.result.status;

  if (status !== glpk.GLP_OPT && status !== glpk.GLP_FEAS) {
    return {
      status: 'infeasible',
      selected: [],
      totalImpact: 0,
      totalHours: 0,
      totalMoney: 0,
      error:
        status === glpk.GLP_NOFEAS
          ? 'Нет допустимых решений в рамках ограничений.'
          : 'Решатель не нашёл оптимального решения.'
    };
  }

  const selected: OptimizationActionInput[] = [];
  let totalImpact = 0;
  let totalHours = 0;
  let totalMoney = 0;

  variables.forEach((name, index) => {
    const value = result.result.vars[name] ?? 0;
    if (value >= 0.5) {
      const action = input.actions[index];
      selected.push(action);
      totalImpact += action.impactScore;
      totalHours += action.hoursCost;
      totalMoney += action.moneyCost;
    }
  });

  return {
    status: 'optimal',
    selected,
    totalImpact,
    totalHours,
    totalMoney
  };
};

self.onmessage = async (
  event: MessageEvent<OptimizationWorkerRequest>
) => {
  const { requestId, input } = event.data;
  try {
    const glpk = await glpkPromise;
    const solution = solveOptimization(glpk, input);
    const response: OptimizationWorkerResponse = {
      requestId,
      solution
    };
    self.postMessage(response);
  } catch (error) {
    const response: OptimizationWorkerResponse = {
      requestId,
      solution: {
        status: 'error',
        selected: [],
        totalImpact: 0,
        totalHours: 0,
        totalMoney: 0,
        error:
          error instanceof Error
            ? error.message
            : 'Неизвестная ошибка решателя.'
      }
    };
    self.postMessage(response);
  }
};
