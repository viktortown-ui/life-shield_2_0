import { buildStubReport } from '../core/verdict';

export const getDecisionTreeReport = (input: string) =>
  buildStubReport('decisionTree', input, 'Ветки решений выстроены логично');
