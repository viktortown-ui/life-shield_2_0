import { buildStubReport } from '../core/verdict';

export const getBayesReport = (input: string) =>
  buildStubReport('bayes', input, 'Байесовский прогноз стабилен');
