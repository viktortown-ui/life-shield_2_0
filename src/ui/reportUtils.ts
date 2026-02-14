import { islandRegistry } from '../core/registry';
import { AppState, IslandId, IslandReport, IslandRunHistoryEntry } from '../core/types';
import { formatDateTime } from './format';

export const STALE_AFTER_DAYS = 7;

export const clampMetric = (value: number) =>
  Math.min(100, Math.max(0, Math.round(value)));

export const getIslandStatus = (lastRunAt: string | null, hasReport: boolean) => {
  if (!hasReport) return { label: 'Нет данных', tone: 'status--new' };
  if (!lastRunAt) return { label: 'Есть данные', tone: 'status--fresh' };
  const diffDays =
    (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays >= STALE_AFTER_DAYS) {
    return { label: 'Нужно обновить', tone: 'status--stale' };
  }
  return { label: 'Есть данные', tone: 'status--fresh' };
};

export const formatLastRun = (value: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return formatDateTime(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatMetric = (report: IslandReport | null) => {
  if (!report) return 'нет результата';
  return `${clampMetric(report.score)}/${clampMetric(report.confidence)}%`;
};

export const getReportSummary = (state: AppState) => {
  const withReports = islandRegistry
    .map((island) => ({ island, report: state.islands[island.id].lastReport }))
    .filter((item) => item.report);
  if (withReports.length === 0) {
    return {
      total: 0,
      avgScore: 0,
      latestRun: null as string | null,
      text: 'Отчётов пока нет. Запустите любой остров, чтобы получить персональные рекомендации.'
    };
  }

  const avgScore = Math.round(
    withReports.reduce((sum, item) => sum + (item.report?.score ?? 0), 0) /
      withReports.length
  );

  const latestRun = islandRegistry
    .map((island) => state.islands[island.id].progress.lastRunAt)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    total: withReports.length,
    avgScore,
    latestRun,
    text: `Зафиксировано ${withReports.length} активных острова(ов), средний индекс устойчивости ${avgScore}/100. Приоритет — обновлять острова с индексом ниже 70 и фиксировать прогресс раз в неделю.`
  };
};

export const getTopMetrics = (report: IslandReport | null) => {
  if (!report) {
    return ['Нет ключевых метрик'];
  }
  const detailMetrics = report.details.slice(0, 2);
  if (detailMetrics.length > 0) {
    return detailMetrics;
  }
  return [formatMetric(report), report.summary];
};

export const getNextAction = (report: IslandReport | null) => {
  if (report?.actions?.[0]) {
    return report.actions[0].title;
  }
  return report?.summary ?? 'Запустить расчёт и сверить входные данные.';
};

export const buildSparklineSvg = (history: IslandRunHistoryEntry[]) => {
  const values = history.slice(-10).map((entry) => clampMetric(entry.score));
  if (values.length === 0) {
    return '<span class="muted">нет истории</span>';
  }
  if (values.length === 1) {
    return `<span class="sparkline-single">${values[0]}</span>`;
  }

  const width = 110;
  const height = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(1, max - min);
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / spread) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" role="img" aria-label="динамика результатов">
      <polyline points="${points}" />
    </svg>
  `;
};

export const getHistoryTail = (
  state: AppState,
  islandId: IslandId,
  count = 3
): number[] => {
  return state.islands[islandId].progress.history
    .slice(-count)
    .map((entry) => clampMetric(entry.score));
};
