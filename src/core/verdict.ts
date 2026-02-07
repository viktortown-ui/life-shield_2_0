import { IslandId, IslandReport } from './types';

export const buildStubReport = (
  id: IslandId,
  input: string,
  hint: string
): IslandReport => {
  const trimmed = input.trim();
  const score = Math.min(100, Math.max(15, trimmed.length * 2));
  const confidence = Math.min(100, Math.max(25, 60 + trimmed.length));

  return {
    id,
    score,
    confidence,
    headline: hint,
    summary: trimmed
      ? `Получено ${trimmed.length} символов входных данных.`
      : 'Данных пока нет — используйте форму ниже.',
    details: [
      'Расчёты пока заглушка: подключите воркер для тяжёлой математики.',
      'Результат сохранится после нажатия «Сохранить».',
      'Контракт IslandReport остаётся единым для всех островов.'
    ]
  };
};
