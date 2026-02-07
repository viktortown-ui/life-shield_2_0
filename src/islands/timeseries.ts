import { buildStubReport } from '../core/verdict';

export const getTimeseriesReport = (input: string) =>
  buildStubReport('timeseries', input, 'Тренд устойчив, сезонность умеренная');
