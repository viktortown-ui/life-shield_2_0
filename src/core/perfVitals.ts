import type { DiagnosticsController } from './diagnostics';
import { reportCaughtError } from './reportError';

type PerfMetricName = 'LCP' | 'INP' | 'CLS';

type PerfMetric = {
  name: PerfMetricName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta?: number;
  navigationType?: string;
};

const ratings: Record<PerfMetricName, { good: number; poor: number }> = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 }
};

const resolveRating = (name: PerfMetricName, value: number): PerfMetric['rating'] => {
  const bounds = ratings[name];
  if (value <= bounds.good) return 'good';
  if (value > bounds.poor) return 'poor';
  return 'needs-improvement';
};

const emitMetric = (
  diagnostics: DiagnosticsController,
  metric: PerfMetric,
  previousValue?: number
) => {
  diagnostics.captureEvent({
    kind: 'perf',
    message: `${metric.name}:${metric.value.toFixed(metric.name === 'CLS' ? 3 : 0)}`,
    rawType: 'perf',
    perfMetric: {
      ...metric,
      delta:
        typeof previousValue === 'number'
          ? Number((metric.value - previousValue).toFixed(3))
          : metric.delta
    },
    jsonPreview: JSON.stringify(metric)
  });
};

export const initWebVitalsTelemetry = (diagnostics: DiagnosticsController) => {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  const latestValue: Partial<Record<PerfMetricName, number>> = {};
  const navigation = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  const navigationType = navigation?.type;

  const track = (name: PerfMetricName, value: number) => {
    const metric: PerfMetric = {
      name,
      value,
      rating: resolveRating(name, value),
      navigationType
    };
    emitMetric(diagnostics, metric, latestValue[name]);
    latestValue[name] = value;
  };

  try {
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry | undefined;
      if (!lastEntry) return;
      track('LCP', lastEntry.startTime);
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (error) {
    reportCaughtError(error);
  }

  try {
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>;
      entries.forEach((entry) => {
        if (entry.hadRecentInput) return;
        clsValue += entry.value ?? 0;
      });
      track('CLS', Number(clsValue.toFixed(3)));
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });
  } catch (error) {
    reportCaughtError(error);
  }

  try {
    let maxInteraction = 0;
    const inpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as Array<PerformanceEntry & { duration?: number }>;
      entries.forEach((entry) => {
        const duration = entry.duration ?? 0;
        if (duration > maxInteraction) {
          maxInteraction = duration;
        }
      });
      if (maxInteraction > 0) {
        track('INP', Math.round(maxInteraction));
      }
    });
    inpObserver.observe({ type: 'event', buffered: true, durationThreshold: 40 });
  } catch (error) {
    reportCaughtError(error);
  }
};
