import { buildStubReport } from '../core/verdict';

export const getHmmReport = (input: string) =>
  buildStubReport('hmm', input, 'Скрытые состояния под контролем');
