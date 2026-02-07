import { buildStubReport } from '../core/verdict';

export const getOptimizationReport = (input: string) =>
  buildStubReport('optimization', input, 'Цели и ограничения сбалансированы');
