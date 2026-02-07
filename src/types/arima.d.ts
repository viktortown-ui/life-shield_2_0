declare module 'arima' {
  export interface ArimaOptions {
    auto?: boolean;
    p?: number;
    d?: number;
    q?: number;
    P?: number;
    D?: number;
    Q?: number;
    s?: number;
    verbose?: boolean;
    approximation?: number;
    search?: number;
  }

  export interface ArimaModel {
    train(series: number[]): ArimaModel;
    predict(steps: number): [number[], number[]];
  }

  export default class ARIMA implements ArimaModel {
    constructor(options?: ArimaOptions);
    train(series: number[]): ArimaModel;
    predict(steps: number): [number[], number[]];
  }
}

declare module 'arima/async' {
  import type ARIMA from 'arima';
  const ARIMAPromise: Promise<typeof ARIMA>;
  export default ARIMAPromise;
}
