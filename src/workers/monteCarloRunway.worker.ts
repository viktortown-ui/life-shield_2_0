import {
  MonteCarloWorkerRequest,
  MonteCarloWorkerResponse,
  runMonteCarloRunway
} from '../islands/stressMonteCarlo';
import { reportCaughtError } from '../core/reportError';

self.onmessage = (event: MessageEvent<MonteCarloWorkerRequest>) => {
  const { requestId, input, finance } = event.data;

  try {
    const result = runMonteCarloRunway(finance, input);
    const response: MonteCarloWorkerResponse = { requestId, result };
    self.postMessage(response);
  } catch (error) {
    reportCaughtError(error);
    const response: MonteCarloWorkerResponse = {
      requestId,
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось выполнить Monte Carlo расчёт.'
    };
    self.postMessage(response);
  }
};
