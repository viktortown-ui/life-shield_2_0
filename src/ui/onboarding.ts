import { loadDemoData, setOnboarded } from '../core/store';

export const createOnboardingModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.innerHTML = `
    <div class="onboarding-card">
      <h2>Добро пожаловать в Life‑Shield</h2>
      <ol>
        <li><strong>Что это:</strong> личный менеджер устойчивости: деньги, обязательства, доход, энергия, опора и гибкость.</li>
        <li><strong>Что сделать:</strong> введите базовые данные или загрузите демо.</li>
        <li><strong>Что получите:</strong> индекс устойчивости и подсказку по 2–3 следующим действиям.</li>
      </ol>
      <div class="onboarding-actions">
        <button class="button" data-action="quick">Быстрый старт</button>
        <button class="button ghost" data-action="demo">Загрузить демо</button>
        <button class="button ghost" data-action="skip">Пропустить</button>
      </div>
    </div>
  `;

  overlay.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const action = target.getAttribute('data-action');
    if (!action) return;

    if (action === 'demo') {
      loadDemoData();
      window.location.hash = '#/';
    } else if (action === 'quick') {
      setOnboarded(true);
      window.location.hash = '#/island/bayes';
    } else {
      setOnboarded(true);
      window.location.hash = '#/';
    }

    overlay.remove();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  return overlay;
};
