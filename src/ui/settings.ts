import { exportState, importState, resetState } from '../core/store';
import { onUpdateReady, triggerUpdate } from '../core/pwaUpdate';

export const createSettingsScreen = () => {
  const container = document.createElement('div');
  container.className = 'screen settings';

  const header = document.createElement('header');
  header.className = 'screen-header';
  header.innerHTML = `
    <div>
      <h1>Настройки</h1>
      <p>Экспорт, импорт и обслуживание приложения.</p>
    </div>
  `;

  const exportBlock = document.createElement('section');
  exportBlock.className = 'settings-block';
  exportBlock.innerHTML = `
    <h2>Экспорт / Импорт</h2>
    <textarea class="settings-textarea" rows="8" placeholder="JSON появится здесь"></textarea>
    <div class="settings-actions">
      <button class="button" data-action="export">Экспортировать</button>
      <button class="button ghost" data-action="import">Импортировать</button>
    </div>
    <p class="settings-hint"></p>
  `;

  const maintenance = document.createElement('section');
  maintenance.className = 'settings-block';
  maintenance.innerHTML = `
    <h2>Maintenance</h2>
    <div class="settings-actions">
      <button class="button" data-action="update" disabled>Обновить</button>
      <button class="button ghost" data-action="reset">Сбросить данные</button>
    </div>
    <p class="settings-hint">Обновление появится как только новая версия будет готова.</p>
  `;

  const textarea = exportBlock.querySelector('textarea') as HTMLTextAreaElement;
  const hint = exportBlock.querySelector('.settings-hint') as HTMLParagraphElement;
  const updateButton = maintenance.querySelector('[data-action="update"]') as HTMLButtonElement;

  exportBlock.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'export') {
      textarea.value = exportState();
      hint.textContent = 'JSON готов. Сохраните его в надёжном месте.';
    }

    if (action === 'import') {
      try {
        const parsed = JSON.parse(textarea.value);
        const result = importState(parsed);
        hint.textContent = result.ok
          ? 'Импорт завершён.'
          : `Ошибка импорта: ${result.errors.join(' ')}`;
      } catch {
        hint.textContent = 'Введите корректный JSON перед импортом.';
      }
    }
  });

  maintenance.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'update') {
      triggerUpdate();
    }

    if (action === 'reset') {
      resetState();
      textarea.value = '';
      hint.textContent = 'Данные сброшены.';
    }
  });

  onUpdateReady((ready) => {
    updateButton.disabled = !ready;
  });

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = '<a class="button ghost" href="#/">К щиту</a>';

  container.append(header, exportBlock, maintenance, actions);
  return container;
};
