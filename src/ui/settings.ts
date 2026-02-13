import {
  exportState,
  getState,
  importState,
  resetState,
  setCosmosUiFlags,
  setHomeScreen
} from '../core/store';
import {
  applyUpdate,
  checkForUpdate,
  getUpdateState,
  onUpdateState,
  panicReset
} from '../core/pwaUpdate';
import { reportCaughtError } from '../core/reportError';
import { safeClear } from '../core/storage';

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
    <input class="settings-file" type="file" accept="application/json,.json" hidden />
    <div class="settings-actions">
      <button class="button" data-action="export">Экспортировать</button>
      <button class="button ghost" data-action="import">Импортировать</button>
    </div>
    <p class="settings-warning">Импорт перезапишет текущие данные.</p>
    <p class="settings-hint"></p>
  `;


  const homeSettings = document.createElement('section');
  homeSettings.className = 'settings-block';
  homeSettings.innerHTML = `
    <h2>Интерфейс</h2>
    <p class="settings-hint">Домашний экран по умолчанию.</p>
    <div class="settings-home-switch" role="radiogroup" aria-label="Домашний экран">
      <label>
        <input type="radio" name="home-screen" value="shield" />
        <span>Shield</span>
      </label>
      <label>
        <input type="radio" name="home-screen" value="cosmos" />
        <span>Cosmos</span>
      </label>
    </div>
  `;

  const cosmosFxSettings = document.createElement('section');
  cosmosFxSettings.className = 'settings-block';
  cosmosFxSettings.innerHTML = `
    <h2>Cosmos FX</h2>
    <div class="cosmos-controls">
      <label>
        <input type="checkbox" data-cosmos-fx="sound" aria-label="Включить звуковые эффекты Cosmos" />
        Sound FX
      </label>
      <label>
        Volume
        <input type="range" min="0" max="1" step="0.05" data-cosmos-fx="volume" aria-label="Громкость звуковых эффектов Cosmos" />
      </label>
      <label>
        <input type="checkbox" data-cosmos-fx="reduceMotion" aria-label="Сократить анимации Cosmos" />
        Reduce motion (override)
      </label>
    </div>
    <p class="settings-hint">Системная настройка prefers-reduced-motion учитывается автоматически.</p>
  `;

  const maintenance = document.createElement('section');
  maintenance.className = 'settings-block';
  maintenance.innerHTML = `
    <h2>Maintenance</h2>
    <div class="settings-actions">
      <button class="button ghost" data-action="check-update">Проверить обновление</button>
      <button class="button" data-action="apply-update" disabled>Обновить сейчас</button>
      <button class="button ghost" data-action="restart">Перезапустить приложение</button>
      <button class="button ghost" data-action="panic-reset">Panic reset cache</button>
      <button class="button ghost" data-action="reset">Сброс кэша/данных</button>
    </div>
    <p class="settings-hint">Обновление появится как только новая версия будет готова.</p>
  `;

  const textarea = exportBlock.querySelector('textarea') as HTMLTextAreaElement;
  const fileInput = exportBlock.querySelector(
    '.settings-file'
  ) as HTMLInputElement;
  const hint = exportBlock.querySelector('.settings-hint') as HTMLParagraphElement;
  const updateButton = maintenance.querySelector(
    '[data-action="apply-update"]'
  ) as HTMLButtonElement;
  const maintenanceHint = maintenance.querySelector(
    '.settings-hint'
  ) as HTMLParagraphElement;

  exportBlock.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'export') {
      const payload = exportState();
      textarea.value = payload;
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `life-shield-backup-${dateStamp}.json`;
      link.click();
      URL.revokeObjectURL(url);
      hint.textContent = 'JSON готов. Сохраните его в надёжном месте.';
    }

    if (action === 'import') {
      if (!textarea.value.trim()) {
        fileInput.value = '';
        fileInput.click();
        return;
      }
      try {
        const parsed = JSON.parse(textarea.value);
        const confirmed = window.confirm(
          'Импорт перезапишет текущие данные. Продолжить?'
        );
        if (!confirmed) {
          hint.textContent = 'Импорт отменён.';
          return;
        }
        const result = importState(parsed);
        hint.textContent = result.ok
          ? 'Импорт завершён.'
          : `Ошибка импорта: ${result.errors.join(' ')}`;
      } catch (error) {
        reportCaughtError(error);
        hint.textContent = 'Введите корректный JSON перед импортом.';
      }
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      textarea.value = text;
      const parsed = JSON.parse(text);
      const confirmed = window.confirm(
        'Импорт перезапишет текущие данные. Продолжить?'
      );
      if (!confirmed) {
        hint.textContent = 'Импорт отменён.';
        return;
      }
      const result = importState(parsed);
      hint.textContent = result.ok
        ? 'Импорт завершён.'
        : `Ошибка импорта: ${result.errors.join(' ')}`;
    } catch (error) {
      reportCaughtError(error);
      hint.textContent = 'Введите корректный JSON перед импортом.';
    }
  });

  maintenance.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'check-update') {
      maintenanceHint.textContent = 'Проверяем наличие обновлений...';
      try {
        checkForUpdate();
      } catch (error) {
        reportCaughtError(error);
        maintenanceHint.textContent = 'Не удалось проверить обновления.';
      }
      return;
    }

    if (action === 'apply-update') {
      try {
        applyUpdate();
      } catch (error) {
        reportCaughtError(error);
        maintenanceHint.textContent = 'Не удалось применить обновление.';
      }
      return;
    }

    if (action === 'restart') {
      window.location.reload();
      return;
    }

    if (action === 'panic-reset') {
      const confirmed = window.confirm(
        'Сбросить сервис-воркер и весь Cache Storage? Приложение перезагрузится.'
      );
      if (!confirmed) {
        return;
      }
      try {
        await panicReset();
      } catch (error) {
        reportCaughtError(error);
        maintenanceHint.textContent = 'Не удалось сбросить кеш.';
      }
      return;
    }

    if (action === 'reset') {
      const confirmed = window.confirm(
        'Сбросить данные приложения? Действие нельзя отменить.'
      );
      if (!confirmed) {
        return;
      }
      safeClear();
      resetState();
      textarea.value = '';
      hint.textContent = 'Данные сброшены.';
      maintenanceHint.textContent = 'Данные очищены. Перезапустите приложение.';
    }
  });


  const selectedHome = getState().flags.homeScreen;
  const flags = getState().flags;
  const homeInputs = homeSettings.querySelectorAll<HTMLInputElement>('input[name="home-screen"]');
  homeInputs.forEach((input) => {
    input.checked = input.value === selectedHome;
    input.addEventListener('change', () => {
      if (!input.checked) return;
      setHomeScreen(input.value === 'cosmos' ? 'cosmos' : 'shield');
    });
  });

  const soundInput = cosmosFxSettings.querySelector<HTMLInputElement>('input[data-cosmos-fx="sound"]');
  const volumeInput = cosmosFxSettings.querySelector<HTMLInputElement>('input[data-cosmos-fx="volume"]');
  const reduceMotionInput = cosmosFxSettings.querySelector<HTMLInputElement>('input[data-cosmos-fx="reduceMotion"]');
  if (soundInput && volumeInput && reduceMotionInput) {
    soundInput.checked = flags.cosmosSoundFxEnabled;
    volumeInput.value = String(flags.cosmosSfxVolume);
    reduceMotionInput.checked = flags.cosmosReduceMotionOverride === true;

    soundInput.addEventListener('change', () => {
      setCosmosUiFlags({ cosmosSoundFxEnabled: soundInput.checked });
    });
    volumeInput.addEventListener('input', () => {
      setCosmosUiFlags({ cosmosSfxVolume: Number(volumeInput.value) });
    });
    reduceMotionInput.addEventListener('change', () => {
      setCosmosUiFlags({ cosmosReduceMotionOverride: reduceMotionInput.checked ? true : null });
    });
  }

  const updateState = getUpdateState();
  updateButton.disabled = !updateState.ready;
  if (updateState.ready) {
    maintenanceHint.textContent = 'Доступно обновление.';
  }

  onUpdateState((state) => {
    updateButton.disabled = !state.ready;
    if (state.ready) {
      maintenanceHint.textContent = 'Доступно обновление.';
    } else if (state.offlineReady) {
      maintenanceHint.textContent = 'Приложение готово работать офлайн.';
    } else {
      maintenanceHint.textContent =
        'Обновление появится как только новая версия будет готова.';
    }
  });

  const actions = document.createElement('div');
  actions.className = 'screen-actions';
  actions.innerHTML = '<a class="button ghost" href="#/">К щиту</a>';

  container.append(header, homeSettings, cosmosFxSettings, exportBlock, maintenance, actions);
  return container;
};
