import ARIMAPromise from 'arima/async';
import {
  TimeseriesWorkerRequest,
  TimeseriesWorkerResponse,
  runTimeseriesAnalysis
} from '../islands/timeseries';

const arimaPromise = ARIMAPromise.then((Arima) => Arima);

self.onmessage = async (
  event: MessageEvent<TimeseriesWorkerRequest>
) => {
  const { requestId, input } = event.data;
  try {
    const Arima = await arimaPromise;
    const analysis = runTimeseriesAnalysis(input, Arima);
    const response: TimeseriesWorkerResponse = {
      requestId,
      analysis
    };
    self.postMessage(response);
  } catch (error) {
    const response: TimeseriesWorkerResponse = {
      requestId,
      error:
        error instanceof Error
          ? error.message
          : 'Не удалось построить прогноз.'
    };
    self.postMessage(response);
  }
};
