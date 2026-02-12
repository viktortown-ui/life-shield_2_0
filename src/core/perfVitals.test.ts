import { describe, expect, it, vi, afterEach } from 'vitest';
import { initWebVitalsTelemetry } from './perfVitals';
import type { DiagnosticsController } from './diagnostics';

type ObserverConfig = { callback: PerformanceObserverCallback; type: string };

const createDiagnosticsMock = () => {
  const captureEvent = vi.fn();
  return {
    captureEvent,
    controller: {
      getEntries: vi.fn(),
      copy: vi.fn(async () => true),
      dumpUiState: vi.fn(),
      onEntry: vi.fn(),
      captureError: vi.fn(),
      captureOverlayInvocation: vi.fn(),
      captureOverlayProbe: vi.fn(),
      captureEvent,
      pushBreadcrumb: vi.fn(),
      setOverlayState: vi.fn(),
      downloadReport: vi.fn()
    } as unknown as DiagnosticsController
  };
};

describe('initWebVitalsTelemetry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes LCP/INP/CLS metrics into diagnostics store on observer callbacks', () => {
    const observers: ObserverConfig[] = [];

    class MockPerformanceObserver {
      callback: PerformanceObserverCallback;
      constructor(callback: PerformanceObserverCallback) {
        this.callback = callback;
      }
      observe(options: { type: string }) {
        observers.push({ callback: this.callback, type: options.type });
      }
      disconnect() {
        // noop
      }
      takeRecords() {
        return [];
      }
      static supportedEntryTypes = ['largest-contentful-paint', 'layout-shift', 'event'];
    }

    vi.stubGlobal('PerformanceObserver', MockPerformanceObserver as unknown as typeof PerformanceObserver);
    vi.stubGlobal('performance', {
      getEntriesByType: vi.fn(() => [{ type: 'navigate' }])
    });

    const { captureEvent, controller } = createDiagnosticsMock();

    initWebVitalsTelemetry(controller);

    const lcp = observers.find((item) => item.type === 'largest-contentful-paint');
    const cls = observers.find((item) => item.type === 'layout-shift');
    const inp = observers.find((item) => item.type === 'event');

    expect(lcp).toBeTruthy();
    expect(cls).toBeTruthy();
    expect(inp).toBeTruthy();

    lcp?.callback({ getEntries: () => [{ startTime: 1234 }] } as PerformanceObserverEntryList, {} as PerformanceObserver);
    cls?.callback(
      {
        getEntries: () => [{ value: 0.08, hadRecentInput: false }]
      } as PerformanceObserverEntryList,
      {} as PerformanceObserver
    );
    inp?.callback(
      {
        getEntries: () => [{ duration: 220 }]
      } as PerformanceObserverEntryList,
      {} as PerformanceObserver
    );

    expect(captureEvent).toHaveBeenCalledTimes(3);
    expect(captureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'perf',
        perfMetric: expect.objectContaining({ name: 'LCP', value: 1234 })
      })
    );
    expect(captureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'perf',
        perfMetric: expect.objectContaining({ name: 'CLS', value: 0.08 })
      })
    );
    expect(captureEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'perf',
        perfMetric: expect.objectContaining({ name: 'INP', value: 220 })
      })
    );
  });
});
