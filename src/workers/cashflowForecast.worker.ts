import {
  CashflowForecastWorkerRequest,
  CashflowForecastWorkerResponse,
  runCashflowForecast
} from './cashflowForecast';
import { reportCaughtError } from '../core/reportError';

self.onmessage = (event: MessageEvent<CashflowForecastWorkerRequest>) => {
  const { requestId, input } = event.data;

  try {
    const result = runCashflowForecast(input);
    const response: CashflowForecastWorkerResponse = { requestId, result };
    self.postMessage(response);
  } catch (error) {
    reportCaughtError(error);
    const response: CashflowForecastWorkerResponse = {
      requestId,
      error: error instanceof Error ? error.message : 'Не удалось построить прогноз cashflow.'
    };
    self.postMessage(response);
  }
};
