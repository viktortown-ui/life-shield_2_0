import { HmmInput, runHmmAnalysis } from '../islands/hmm';
import { reportCaughtError } from '../core/reportError';

export interface HmmWorkerRequest {
  type: 'run';
  requestId: string;
  input: HmmInput;
}

export interface HmmWorkerResponse {
  type: 'success' | 'error';
  requestId: string;
  result?: ReturnType<typeof runHmmAnalysis>;
  error?: string;
}

self.onmessage = (event: MessageEvent<HmmWorkerRequest>) => {
  const { type, requestId, input } = event.data;
  if (type !== 'run') return;

  try {
    const result = runHmmAnalysis(input);
    self.postMessage({ type: 'success', requestId, result } satisfies HmmWorkerResponse);
  } catch (error) {
    reportCaughtError(error);
    const message =
      error instanceof Error ? error.message : 'Неожиданная ошибка в HMM воркере.';
    self.postMessage({ type: 'error', requestId, error: message } satisfies HmmWorkerResponse);
  }
};
