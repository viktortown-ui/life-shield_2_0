import { buildStubReport } from '../core/verdict';

export const getCausalDagReport = (input: string) =>
  buildStubReport('causalDag', input, 'Причинные связи выглядят непротиворечиво');
